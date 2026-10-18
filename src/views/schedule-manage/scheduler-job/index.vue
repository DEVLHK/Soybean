<script setup lang="tsx">
import { computed, reactive, ref, toRaw } from 'vue';
import { NButton, NTag } from 'naive-ui';
import { useNDataTable } from 'pro-naive-ui';
import type { ProDataTableColumns } from 'pro-naive-ui';
import {
  fetchAddSchedulerJob,
  fetchDeleteSchedulerJob,
  fetchGetSchedulerJobDetail,
  fetchGetSchedulerJobList,
  fetchUpdateSchedulerJob
} from '@/service/api';
import { $t } from '@/locales';
import { useFormRules, useNaiveForm } from '@/hooks/common/form';
import ConfigProvider from '@/views/pro-naive/ConfigProvider.vue';

defineOptions({
  name: 'ScheduleManageSchedulerJob'
});

interface SchedulerJobSearchValues {
  jobName: string | null;
  scriptName: string | null;
}

async function fetchList(params: any, values: SchedulerJobSearchValues | Record<string, any>) {
  const { data, error } = await fetchGetSchedulerJobList({
    current: params.current,
    pageSize: params.pageSize,
    // qs serializes null/'' as empty string which fails fastapi str parsing, use undefined to skip them
    jobName: values.jobName || undefined,
    scriptName: values.scriptName || undefined
  });

  if (error) {
    return { total: 0, list: [] };
  }

  return { total: data.total, list: data.records };
}

/** normalize backend timedelta string like "0 days 06:30:00" to "06:30:00" */
function normalizeTime(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  return value.includes(' ') ? value.split(' ').pop()! : value;
}

const periodTypeOptions = computed(() =>
  (['second', 'minute', 'hour', 'day', 'week', 'month', 'quarter', 'year'] as const).map(type => ({
    label: $t(`page.scheduleManage.schedulerJob.periodUnit.${type}`),
    value: type
  }))
);

function periodTypeLabel(type: string) {
  return periodTypeOptions.value.find(option => option.value === type)?.label ?? type;
}

const columns = computed<ProDataTableColumns<Api.ScheduleManage.SchedulerJobRecord>>(() => {
  return [
    {
      key: 'index',
      title: $t('common.index'),
      align: 'center',
      width: 64,
      render: (_, index) => index + 1
    },
    {
      key: 'jobName',
      title: $t('page.scheduleManage.schedulerJob.jobName'),
      align: 'center',
      width: 150
    },
    {
      key: 'scriptName',
      title: $t('page.scheduleManage.schedulerJob.scriptName'),
      align: 'left',
      minWidth: 220,
      ellipsis: { tooltip: true }
    },
    {
      key: 'description',
      title: $t('page.scheduleManage.schedulerJob.description'),
      align: 'left',
      minWidth: 180,
      ellipsis: { tooltip: true }
    },
    {
      key: 'period',
      title: $t('page.scheduleManage.schedulerJob.period'),
      align: 'center',
      width: 130,
      render: row => `${row.periodInterval} ${periodTypeLabel(row.periodType)}`
    },
    {
      key: 'firstRun',
      title: $t('page.scheduleManage.schedulerJob.firstRun'),
      align: 'center',
      width: 170,
      render: row => {
        const date = row.firstRunDate ?? '-';
        const time = row.firstRunTime ? normalizeTime(row.firstRunTime) : '';
        return time ? `${date} ${time}` : date;
      }
    },
    {
      key: 'lastRun',
      title: $t('page.scheduleManage.schedulerJob.lastRun'),
      align: 'center',
      width: 170,
      render: row => {
        if (!row.lastRunDate) {
          return '-';
        }
        const time = row.lastRunTime ? normalizeTime(row.lastRunTime) : '';
        return time ? `${row.lastRunDate} ${time}` : row.lastRunDate;
      }
    },
    {
      key: 'updateTime',
      title: $t('page.scheduleManage.schedulerJob.updateTime'),
      align: 'center',
      width: 170
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 200,
      render: row => (
        <div class="flex-center justify-center gap-8px">
          <NButton type="primary" ghost size="small" onClick={() => handleDetail(row)}>
            {$t('page.scheduleManage.schedulerJob.detail')}
          </NButton>
          <NButton type="primary" ghost size="small" onClick={() => handleEdit(row)}>
            {$t('common.edit')}
          </NButton>
          <NButton type="error" ghost size="small" onClick={() => handleDelete(row)}>
            {$t('common.delete')}
          </NButton>
        </div>
      )
    }
  ];
});

const defaultSearchValues: SchedulerJobSearchValues = {
  jobName: null,
  scriptName: null
};

const searchValues = ref<SchedulerJobSearchValues>({ ...defaultSearchValues });

const {
  table: { tableProps },
  pagination,
  run,
  refresh
} = useNDataTable(({ current, pageSize, filters, sorter }, values) =>
  fetchList({ current, pageSize, filters, sorter }, values)
);

/** query with current search values (page 1, keep page size) */
function handleSearch() {
  run({ current: 1, pageSize: pagination.pageSize.value, sorter: null, filters: {} }, { ...toRaw(searchValues.value) });
}

function resetSearch() {
  Object.assign(searchValues.value, { ...defaultSearchValues });
  handleSearch();
}

/** ---------- detail modal ---------- */
const detailModalVisible = ref(false);
const detailLoading = ref(false);
const detailRecord = ref<Api.ScheduleManage.SchedulerJobRecord>();

async function handleDetail(row: Api.ScheduleManage.SchedulerJobRecord) {
  detailModalVisible.value = true;
  detailLoading.value = true;

  const { error, data } = await fetchGetSchedulerJobDetail(row.id);
  detailLoading.value = false;

  if (!error) {
    detailRecord.value = data;
  }
}

/** ---------- add/edit modal ---------- */
interface JobFormModel {
  jobName: string;
  scriptName: string;
  description: string;
  periodType: Api.ScheduleManage.SchedulerJobPeriodType | null;
  periodInterval: number | null;
  firstRunDate: string | null;
  firstRunTime: string | null;
}

const operateModalVisible = ref(false);
const submitLoading = ref(false);
/** null = add, number = edit id */
const editingId = ref<number | null>(null);

const operateModalTitle = computed(() =>
  editingId.value === null
    ? $t('page.scheduleManage.schedulerJob.addJob')
    : $t('page.scheduleManage.schedulerJob.editJob')
);

const { formRef, validate, restoreValidation } = useNaiveForm();
const { defaultRequiredRule } = useFormRules();

type JobRuleKey = 'jobName' | 'scriptName' | 'periodType';

const jobRules: Record<JobRuleKey, App.Global.FormRule> = {
  jobName: defaultRequiredRule,
  scriptName: defaultRequiredRule,
  periodType: defaultRequiredRule
};

const jobModel = reactive<JobFormModel>(createDefaultJobModel());

function createDefaultJobModel(): JobFormModel {
  return {
    jobName: '',
    scriptName: '',
    description: '',
    periodType: 'day',
    periodInterval: 1,
    firstRunDate: null,
    firstRunTime: null
  };
}

function handleAdd() {
  editingId.value = null;
  Object.assign(jobModel, createDefaultJobModel());
  restoreValidation();
  operateModalVisible.value = true;
}

function handleEdit(row: Api.ScheduleManage.SchedulerJobRecord) {
  editingId.value = row.id;
  Object.assign(jobModel, createDefaultJobModel(), {
    jobName: row.jobName,
    scriptName: row.scriptName,
    description: row.description ?? '',
    periodType: row.periodType,
    periodInterval: row.periodInterval,
    firstRunDate: row.firstRunDate,
    firstRunTime: row.firstRunTime ? normalizeTime(row.firstRunTime) : null
  });
  restoreValidation();
  operateModalVisible.value = true;
}

async function handleSubmit() {
  await validate();

  submitLoading.value = true;

  const payload = {
    jobName: jobModel.jobName,
    scriptName: jobModel.scriptName,
    description: jobModel.description,
    periodType: jobModel.periodType!,
    periodInterval: jobModel.periodInterval ?? 1,
    firstRunDate: jobModel.firstRunDate,
    firstRunTime: jobModel.firstRunTime
  };

  const { error } =
    editingId.value === null
      ? await fetchAddSchedulerJob(payload)
      : await fetchUpdateSchedulerJob({ id: editingId.value, ...payload });

  submitLoading.value = false;

  if (!error) {
    window.$message?.success(editingId.value === null ? $t('common.addSuccess') : $t('common.updateSuccess'));
    operateModalVisible.value = false;
    refresh();
  }
}

async function handleDelete(row: Api.ScheduleManage.SchedulerJobRecord) {
  window.$dialog?.warning({
    title: $t('common.delete'),
    content: `${$t('page.scheduleManage.schedulerJob.deleteConfirm')}: ${row.jobName}`,
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      const { error } = await fetchDeleteSchedulerJob(row.id);
      if (!error) {
        window.$message?.success($t('common.deleteSuccess'));
        refresh();
      }
    }
  });
}
</script>

<template>
  <ConfigProvider>
    <div class="h-full flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
      <NCard :bordered="false" size="small" class="card-wrapper">
        <NCollapse>
          <NCollapseItem :title="$t('common.search')" name="scheduler-job-search">
            <NForm :model="searchValues" label-placement="left" :label-width="100">
              <NGrid responsive="screen" item-responsive>
                <NFormItemGi
                  span="24 s:12 m:8"
                  :label="$t('page.scheduleManage.schedulerJob.jobName')"
                  path="jobName"
                  class="pr-24px"
                >
                  <NInput
                    v-model:value="searchValues.jobName"
                    clearable
                    :placeholder="$t('page.scheduleManage.schedulerJob.jobName')"
                  />
                </NFormItemGi>
                <NFormItemGi
                  span="24 s:12 m:8"
                  :label="$t('page.scheduleManage.schedulerJob.scriptName')"
                  path="scriptName"
                  class="pr-24px"
                >
                  <NInput
                    v-model:value="searchValues.scriptName"
                    clearable
                    :placeholder="$t('page.scheduleManage.schedulerJob.scriptName')"
                  />
                </NFormItemGi>
                <NFormItemGi span="24" class="pr-24px">
                  <NSpace class="w-full" justify="end">
                    <NButton @click="resetSearch">
                      <template #icon>
                        <icon-ic-round-refresh class="text-icon" />
                      </template>
                      {{ $t('common.reset') }}
                    </NButton>
                    <NButton type="primary" ghost @click="handleSearch()">
                      <template #icon>
                        <icon-ic-round-search class="text-icon" />
                      </template>
                      {{ $t('common.search') }}
                    </NButton>
                  </NSpace>
                </NFormItemGi>
              </NGrid>
            </NForm>
          </NCollapseItem>
        </NCollapse>
      </NCard>
      <ProDataTable
        :title="$t('route.schedule-manage_scheduler-job')"
        size="small"
        flex-height
        :columns="columns"
        :row-key="(row: Api.ScheduleManage.SchedulerJobRecord) => row.id"
        class="flex-1"
        v-bind="tableProps"
      >
        <template #toolbar>
          <NButton type="primary" ghost size="small" @click="handleAdd">
            <template #icon>
              <icon-ic-round-plus class="text-icon" />
            </template>
            {{ $t('common.add') }}
          </NButton>
        </template>
      </ProDataTable>
    </div>

    <NModal
      v-model:show="detailModalVisible"
      :title="$t('page.scheduleManage.schedulerJob.detail')"
      preset="card"
      class="w-680px"
    >
      <NSpin :show="detailLoading">
        <NDescriptions v-if="detailRecord" label-placement="left" bordered :column="2" size="small" class="mb-12px">
          <NDescriptionsItem :label="$t('page.scheduleManage.schedulerJob.jobName')" :span="2">
            {{ detailRecord.jobName }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('page.scheduleManage.schedulerJob.scriptName')" :span="2">
            {{ detailRecord.scriptName }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('page.scheduleManage.schedulerJob.description')" :span="2">
            {{ detailRecord.description || '-' }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('page.scheduleManage.schedulerJob.period')">
            {{ detailRecord.periodInterval }} {{ periodTypeLabel(detailRecord.periodType) }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('page.scheduleManage.schedulerJob.firstRun')">
            {{ detailRecord.firstRunDate ?? '-' }}
            {{ detailRecord.firstRunTime ? normalizeTime(detailRecord.firstRunTime) : '' }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('page.scheduleManage.schedulerJob.lastRun')">
            {{ detailRecord.lastRunDate ?? '-' }}
            {{ detailRecord.lastRunTime ? normalizeTime(detailRecord.lastRunTime) : '' }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('page.scheduleManage.schedulerJob.lastRunStatus')">
            {{ detailRecord.lastRunStatus }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('page.scheduleManage.schedulerJob.createBy')">
            {{ detailRecord.createBy }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('page.scheduleManage.schedulerJob.createTime')">
            {{ detailRecord.createTime }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('page.scheduleManage.schedulerJob.updateBy')">
            {{ detailRecord.updateBy }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('page.scheduleManage.schedulerJob.updateTime')" :span="2">
            {{ detailRecord.updateTime }}
          </NDescriptionsItem>
        </NDescriptions>
      </NSpin>
    </NModal>

    <NModal
      v-model:show="operateModalVisible"
      :title="operateModalTitle"
      preset="card"
      class="w-600px"
      display-directive="show"
    >
      <NForm ref="formRef" :model="jobModel" :rules="jobRules" label-placement="left" :label-width="110">
        <NFormItem :label="$t('page.scheduleManage.schedulerJob.jobName')" path="jobName">
          <NInput v-model:value="jobModel.jobName" :placeholder="$t('page.scheduleManage.schedulerJob.jobName')" />
        </NFormItem>
        <NFormItem :label="$t('page.scheduleManage.schedulerJob.scriptName')" path="scriptName">
          <NInput
            v-model:value="jobModel.scriptName"
            :placeholder="$t('page.scheduleManage.schedulerJob.scriptName')"
          />
        </NFormItem>
        <NFormItem :label="$t('page.scheduleManage.schedulerJob.description')" path="description">
          <NInput
            v-model:value="jobModel.description"
            type="textarea"
            :rows="2"
            :placeholder="$t('page.scheduleManage.schedulerJob.description')"
          />
        </NFormItem>
        <NFormItem :label="$t('page.scheduleManage.schedulerJob.periodType')" path="periodType">
          <NSelect
            v-model:value="jobModel.periodType"
            :options="periodTypeOptions"
            :placeholder="$t('page.scheduleManage.schedulerJob.periodType')"
          />
        </NFormItem>
        <NFormItem :label="$t('page.scheduleManage.schedulerJob.periodInterval')" path="periodInterval">
          <NInputNumber
            v-model:value="jobModel.periodInterval"
            :min="1"
            class="w-full"
            :placeholder="$t('page.scheduleManage.schedulerJob.periodInterval')"
          />
        </NFormItem>
        <NFormItem :label="$t('page.scheduleManage.schedulerJob.firstRunDate')" path="firstRunDate">
          <NDatePicker
            v-model:formatted-value="jobModel.firstRunDate"
            type="date"
            clearable
            class="w-full"
            value-format="yyyy-MM-dd"
            :placeholder="$t('page.scheduleManage.schedulerJob.firstRunDate')"
          />
        </NFormItem>
        <NFormItem :label="$t('page.scheduleManage.schedulerJob.firstRunTime')" path="firstRunTime">
          <NTimePicker
            v-model:formatted-value="jobModel.firstRunTime"
            format="HH:mm:ss"
            clearable
            class="w-full"
            :placeholder="$t('page.scheduleManage.schedulerJob.firstRunTime')"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="operateModalVisible = false">{{ $t('common.cancel') }}</NButton>
          <NButton type="primary" :loading="submitLoading" @click="handleSubmit">{{ $t('common.confirm') }}</NButton>
        </NSpace>
      </template>
    </NModal>
  </ConfigProvider>
</template>
