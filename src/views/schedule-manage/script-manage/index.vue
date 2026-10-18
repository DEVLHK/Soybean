<script setup lang="tsx">
import { computed, reactive, ref, toRaw } from 'vue';
import { NButton } from 'naive-ui';
import type { DataTableColumns, UploadFileInfo } from 'naive-ui';
import { useNDataTable } from 'pro-naive-ui';
import type { ProDataTableColumns } from 'pro-naive-ui';
import {
  fetchAddScriptInfo,
  fetchDeleteScriptInfo,
  fetchGetScriptInfoDetail,
  fetchGetScriptInfoList,
  fetchUpdateScriptInfo
} from '@/service/api';
import { $t } from '@/locales';
import { useFormRules, useNaiveForm } from '@/hooks/common/form';
import ConfigProvider from '@/views/pro-naive/ConfigProvider.vue';

defineOptions({
  name: 'ScheduleManageScriptManage'
});

interface ScriptSearchValues {
  scriptName: string | null;
}

async function fetchList(params: any, values: ScriptSearchValues | Record<string, any>) {
  const { data, error } = await fetchGetScriptInfoList({
    current: params.current,
    pageSize: params.pageSize,
    // qs serializes null/'' as empty string which fails fastapi str parsing, use undefined to skip them
    scriptName: values.scriptName || undefined
  });

  if (error) {
    return { total: 0, list: [] };
  }

  return { total: data.total, list: data.records };
}

const paramTypeOptions = computed(() => ['String', 'INT'].map(type => ({ label: type, value: type })));

const columns = computed<ProDataTableColumns<Api.ScheduleManage.ScriptInfoRecord>>(() => {
  return [
    {
      key: 'index',
      title: $t('common.index'),
      align: 'center',
      width: 64,
      render: (_, index) => index + 1
    },
    {
      key: 'scriptName',
      title: $t('page.scheduleManage.scriptManage.scriptName'),
      align: 'center',
      width: 180,
      ellipsis: { tooltip: true }
    },
    {
      key: 'scriptPath',
      title: $t('page.scheduleManage.scriptManage.scriptPath'),
      align: 'left',
      minWidth: 240,
      ellipsis: { tooltip: true }
    },
    {
      key: 'description',
      title: $t('page.scheduleManage.scriptManage.description'),
      align: 'left',
      minWidth: 180,
      ellipsis: { tooltip: true }
    },
    {
      key: 'paramCount',
      title: $t('page.scheduleManage.scriptManage.paramCount'),
      align: 'center',
      width: 90,
      render: row => row.params?.length ?? 0
    },
    {
      key: 'updateTime',
      title: $t('page.scheduleManage.scriptManage.updateTime'),
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
            {$t('page.scheduleManage.scriptManage.detail')}
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

const defaultSearchValues: ScriptSearchValues = {
  scriptName: null
};

const searchValues = ref<ScriptSearchValues>({ ...defaultSearchValues });

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
const detailRecord = ref<Api.ScheduleManage.ScriptInfoRecord>();

const paramColumns = computed<DataTableColumns<Api.ScheduleManage.ScriptParam>>(() => [
  {
    key: 'param_name',
    title: $t('page.scheduleManage.scriptManage.paramName'),
    align: 'center'
  },
  {
    key: 'description',
    title: $t('page.scheduleManage.scriptManage.paramDescription'),
    align: 'left'
  },
  {
    key: 'param_type',
    title: $t('page.scheduleManage.scriptManage.paramType'),
    align: 'center',
    width: 80
  },
  {
    key: 'optional',
    title: $t('page.scheduleManage.scriptManage.optional'),
    align: 'center',
    width: 80,
    render: row => (row.optional ? $t('common.yesOrNo.yes') : $t('common.yesOrNo.no'))
  },
  {
    key: 'default',
    title: $t('page.scheduleManage.scriptManage.defaultValue'),
    align: 'center',
    width: 90,
    render: row => (row.default === null || row.default === undefined ? '-' : String(row.default))
  }
]);

async function handleDetail(row: Api.ScheduleManage.ScriptInfoRecord) {
  detailModalVisible.value = true;
  detailLoading.value = true;

  const { error, data } = await fetchGetScriptInfoDetail(row.scriptName);
  detailLoading.value = false;

  if (!error) {
    detailRecord.value = data;
  }
}

/** ---------- add/edit modal ---------- */
interface ScriptFormModel {
  scriptName: string;
  scriptPath: string;
  description: string;
  params: Api.ScheduleManage.ScriptParam[];
}

/** local editing row for the dynamic param editor (default kept as string input) */
interface ParamEditRow {
  param_name: string;
  description: string;
  param_type: string | null;
  optional: boolean;
  default: string;
}

const operateModalVisible = ref(false);
const submitLoading = ref(false);
/** false = add, true = edit */
const isEdit = ref(false);

const operateModalTitle = computed(() =>
  isEdit.value ? $t('page.scheduleManage.scriptManage.editScript') : $t('page.scheduleManage.scriptManage.addScript')
);

const { formRef, validate, restoreValidation } = useNaiveForm();
const { defaultRequiredRule } = useFormRules();

type ScriptRuleKey = 'scriptName' | 'scriptPath' | 'description';

const scriptRules: Record<ScriptRuleKey, App.Global.FormRule> = {
  scriptName: defaultRequiredRule,
  scriptPath: defaultRequiredRule,
  description: defaultRequiredRule
};

const scriptModel = reactive<ScriptFormModel>(createDefaultScriptModel());
const paramRows = ref<ParamEditRow[]>([]);
const uploadFileList = ref<UploadFileInfo[]>([]);

/** script repo dir (backend convention) */
const SCRIPT_DIR = '/app/schedule/scripts/';

/** derive scriptName / scriptPath from the picked .py file */
function handleFileChange({ fileList }: { fileList: UploadFileInfo[] }) {
  const file = fileList[0];

  if (!file) {
    scriptModel.scriptName = '';
    scriptModel.scriptPath = '';
    return;
  }

  if (!/\.py$/i.test(file.name)) {
    window.$message?.error($t('page.scheduleManage.scriptManage.uploadTip'));
    uploadFileList.value = [];
    return;
  }

  const scriptName = file.name.replace(/\.py$/i, '');
  scriptModel.scriptName = scriptName;
  scriptModel.scriptPath = `${SCRIPT_DIR}${scriptName}.py`;
}

function createDefaultScriptModel(): ScriptFormModel {
  return {
    scriptName: '',
    scriptPath: '',
    description: '',
    params: []
  };
}

function createDefaultParamRow(): ParamEditRow {
  return { param_name: '', description: '', param_type: 'String', optional: false, default: '' };
}

function handleAdd() {
  isEdit.value = false;
  Object.assign(scriptModel, createDefaultScriptModel());
  uploadFileList.value = [];
  paramRows.value = [createDefaultParamRow()];
  restoreValidation();
  operateModalVisible.value = true;
}

async function handleEdit(row: Api.ScheduleManage.ScriptInfoRecord) {
  isEdit.value = true;
  Object.assign(scriptModel, createDefaultScriptModel(), {
    scriptName: row.scriptName,
    scriptPath: row.scriptPath,
    description: row.description ?? '',
    params: row.params ?? []
  });
  paramRows.value = (row.params ?? []).map(param => ({
    param_name: param.param_name,
    description: param.description,
    param_type: param.param_type,
    optional: param.optional,
    default: param.default === null || param.default === undefined ? '' : String(param.default)
  }));
  restoreValidation();
  operateModalVisible.value = true;

  // detail is authoritative for full params
  const { error, data } = await fetchGetScriptInfoDetail(row.scriptName);
  if (!error && data) {
    Object.assign(scriptModel, {
      scriptPath: data.scriptPath,
      description: data.description ?? ''
    });
    paramRows.value = (data.params ?? []).map(param => ({
      param_name: param.param_name,
      description: param.description,
      param_type: param.param_type,
      optional: param.optional,
      default: param.default === null || param.default === undefined ? '' : String(param.default)
    }));
  }
}

function collectParams(): Api.ScheduleManage.ScriptParam[] {
  return paramRows.value.map(row => ({
    param_name: row.param_name.trim(),
    description: row.description.trim(),
    param_type: row.param_type ?? 'String',
    optional: row.optional,
    default: row.default === '' ? null : row.default
  }));
}

/** every param row must have all fields filled */
function validateParamRows(): boolean {
  const invalid = paramRows.value.some(
    row => !row.param_name.trim() || !row.description.trim() || !row.param_type || row.default.trim() === ''
  );

  if (invalid) {
    window.$message?.error($t('page.scheduleManage.scriptManage.paramRequired'));
    return false;
  }

  return true;
}

async function handleSubmit() {
  await validate();

  if (!validateParamRows()) {
    return;
  }

  let uploadFile: File | null = null;
  if (!isEdit.value) {
    uploadFile = uploadFileList.value[0]?.file ?? null;
    if (!uploadFile) {
      window.$message?.error($t('page.scheduleManage.scriptManage.uploadTip'));
      return;
    }
  }
  // guarded above: add mode always has a file here
  const fileToAdd = uploadFile as File;

  submitLoading.value = true;

  const params = collectParams();

  const { error } = isEdit.value
    ? await fetchUpdateScriptInfo({
        scriptName: scriptModel.scriptName,
        scriptPath: scriptModel.scriptPath,
        description: scriptModel.description,
        params
      })
    : await fetchAddScriptInfo(
        {
          scriptName: scriptModel.scriptName,
          scriptPath: scriptModel.scriptPath,
          description: scriptModel.description,
          params
        },
        fileToAdd
      );

  submitLoading.value = false;

  if (!error) {
    window.$message?.success(isEdit.value ? $t('common.updateSuccess') : $t('common.addSuccess'));
    operateModalVisible.value = false;
    refresh();
  }
}

async function handleDelete(row: Api.ScheduleManage.ScriptInfoRecord) {
  window.$dialog?.warning({
    title: $t('common.delete'),
    content: `${$t('page.scheduleManage.scriptManage.deleteConfirm')}: ${row.scriptName}`,
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      const { error } = await fetchDeleteScriptInfo(row.scriptName);
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
          <NCollapseItem :title="$t('common.search')" name="script-manage-search">
            <NForm :model="searchValues" label-placement="left" :label-width="100">
              <NGrid responsive="screen" item-responsive>
                <NFormItemGi
                  span="24 s:12 m:8"
                  :label="$t('page.scheduleManage.scriptManage.scriptName')"
                  path="scriptName"
                  class="pr-24px"
                >
                  <NInput
                    v-model:value="searchValues.scriptName"
                    clearable
                    :placeholder="$t('page.scheduleManage.scriptManage.scriptName')"
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
        :title="$t('route.schedule-manage_script-manage')"
        size="small"
        flex-height
        :columns="columns"
        :row-key="(row: Api.ScheduleManage.ScriptInfoRecord) => row.scriptName"
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
      :title="$t('page.scheduleManage.scriptManage.detail')"
      preset="card"
      class="w-860px"
    >
      <NSpin :show="detailLoading">
        <NDescriptions v-if="detailRecord" label-placement="left" bordered :column="2" size="small" class="mb-12px">
          <NDescriptionsItem :label="$t('page.scheduleManage.scriptManage.scriptName')">
            {{ detailRecord.scriptName }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('page.scheduleManage.scriptManage.updateBy')">
            {{ detailRecord.updateBy }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('page.scheduleManage.scriptManage.scriptPath')" :span="2">
            {{ detailRecord.scriptPath }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('page.scheduleManage.scriptManage.description')" :span="2">
            {{ detailRecord.description || '-' }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('page.scheduleManage.scriptManage.createBy')">
            {{ detailRecord.createBy }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('page.scheduleManage.scriptManage.createTime')">
            {{ detailRecord.createTime }}
          </NDescriptionsItem>
        </NDescriptions>
        <NDataTable
          v-if="detailRecord"
          :columns="paramColumns"
          :data="detailRecord.params ?? []"
          :row-key="(row: Api.ScheduleManage.ScriptParam) => row.param_name"
          size="small"
          max-height="260"
        />
      </NSpin>
    </NModal>

    <NModal
      v-model:show="operateModalVisible"
      :title="operateModalTitle"
      preset="card"
      class="w-1500px"
      display-directive="show"
    >
      <NForm ref="formRef" :model="scriptModel" :rules="scriptRules" label-placement="left" :label-width="90">
        <NFormItem v-if="!isEdit" :label="$t('page.scheduleManage.scriptManage.uploadScript')" path="upload">
          <div class="w-full">
            <NUpload
              v-model:file-list="uploadFileList"
              accept=".py"
              :max="1"
              :default-upload="false"
              :show-file-list="true"
              @change="handleFileChange"
            >
              <NButton type="primary" ghost size="small">
                <template #icon>
                  <icon-ic-round-file-upload class="text-icon" />
                </template>
                {{ $t('page.scheduleManage.scriptManage.selectFile') }}
              </NButton>
            </NUpload>
            <div class="mt-2px text-12px text-red-500">
              {{ $t('page.scheduleManage.scriptManage.uploadTip') }}
            </div>
          </div>
        </NFormItem>
        <NFormItem :label="$t('page.scheduleManage.scriptManage.scriptName')" path="scriptName">
          <NInput v-model:value="scriptModel.scriptName" disabled />
        </NFormItem>
        <NFormItem :label="$t('page.scheduleManage.scriptManage.scriptPath')" path="scriptPath">
          <NInput v-model:value="scriptModel.scriptPath" disabled />
        </NFormItem>
        <NFormItem :label="$t('page.scheduleManage.scriptManage.description')" path="description">
          <NInput
            v-model:value="scriptModel.description"
            type="textarea"
            :rows="2"
            :placeholder="$t('page.scheduleManage.scriptManage.description')"
          />
        </NFormItem>
      </NForm>
      <div class="mb-8px text-14px font-medium">
        {{ $t('page.scheduleManage.scriptManage.params') }}
      </div>
      <NDynamicInput v-model:value="paramRows" :on-create="() => createDefaultParamRow()">
        <template #default="{ value }">
          <div class="flex w-full items-center gap-8px pr-8px">
            <NInput
              v-model:value="value.param_name"
              size="small"
              style="width: 150px"
              :placeholder="$t('page.scheduleManage.scriptManage.paramName')"
            />
            <NSelect
              v-model:value="value.param_type"
              size="small"
              style="width: 100px"
              :options="paramTypeOptions"
              :placeholder="$t('page.scheduleManage.scriptManage.paramType')"
            />
            <NInput
              v-model:value="value.default"
              size="small"
              style="width: 150px"
              :placeholder="$t('page.scheduleManage.scriptManage.defaultValue')"
            />
            <NCheckbox v-model:checked="value.optional" size="small" style="width: 50px" class="whitespace-nowrap">
              {{ $t('page.scheduleManage.scriptManage.optional') }}
            </NCheckbox>
            <NInput
              v-model:value="value.description"
              size="small"
              style="width: 870px"
              :placeholder="$t('page.scheduleManage.scriptManage.paramDescription')"
            />
          </div>
        </template>
      </NDynamicInput>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="operateModalVisible = false">{{ $t('common.cancel') }}</NButton>
          <NButton type="primary" :loading="submitLoading" @click="handleSubmit">{{ $t('common.confirm') }}</NButton>
        </NSpace>
      </template>
    </NModal>
  </ConfigProvider>
</template>
