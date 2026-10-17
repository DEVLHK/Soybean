<script setup lang="tsx">
import { computed, ref, toRaw } from 'vue';
import { NButton, NTag } from 'naive-ui';
import { useNDataTable } from 'pro-naive-ui';
import type { ProDataTableColumns } from 'pro-naive-ui';
import { fetchGetFailedBugList, fetchReviewBug } from '@/service/api';
import { $t } from '@/locales';
import ConfigProvider from '@/views/pro-naive/ConfigProvider.vue';

interface FailedBugSearchValues {
  projectId: string | null;
  testFailDate: number | null;
  bugReviewStatus: string | null;
}

async function fetchList(params: any, values: FailedBugSearchValues | Record<string, any>) {
  const { data, error } = await fetchGetFailedBugList({
    current: params.current,
    pageSize: params.pageSize,
    // qs serializes null/'' as empty string which fails fastapi int parsing, use undefined to skip them
    projectId: values.projectId || undefined,
    testFailDate: values.testFailDate ?? undefined,
    bugReviewStatus: values.bugReviewStatus ?? undefined
  });

  if (error) {
    return { total: 0, list: [] };
  }

  return { total: data.total, list: data.records };
}

const columns = computed<ProDataTableColumns<Api.ProjectManage.FailedBugRecord>>(() => {
  return [
    {
      key: 'index',
      title: $t('common.index'),
      align: 'center',
      width: 64,
      render: (_, index) => index + 1
    },
    {
      key: 'bugId',
      title: $t('page.projectManage.failedBug.bugId'),
      align: 'center',
      width: 150
    },
    {
      key: 'projectId',
      title: $t('page.projectManage.failedBug.projectId'),
      align: 'center',
      width: 130
    },
    {
      key: 'bugTitle',
      title: $t('page.projectManage.failedBug.bugTitle'),
      align: 'center',
      minWidth: 180
    },
    {
      key: 'testFailDate',
      title: $t('page.projectManage.failedBug.testFailDate'),
      align: 'center',
      width: 170
    },
    {
      key: 'bugStatus',
      title: $t('page.projectManage.failedBug.bugCurrentStatus'),
      align: 'center',
      width: 110
    },
    {
      key: 'bugCreateTime',
      title: $t('page.projectManage.failedBug.bugCreateTime'),
      align: 'center',
      width: 170
    },
    {
      key: 'lastResolver',
      title: $t('page.projectManage.failedBug.bugLastResolver'),
      align: 'center',
      width: 130
    },
    {
      key: 'qaOwner',
      title: $t('page.projectManage.failedBug.bugQa'),
      align: 'center',
      width: 110
    },
    {
      key: 'reviewStatus',
      title: $t('page.projectManage.failedBug.bugReviewStatus'),
      align: 'center',
      width: 110,
      render: row => {
        if (row.reviewStatus === null) {
          return null;
        }

        const tagMap: Record<'1' | '2', NaiveUI.ThemeColor> = {
          1: 'success',
          2: 'warning'
        };
        const labelMap: Record<'1' | '2', App.I18n.I18nKey> = {
          1: 'page.projectManage.failedBug.reviewStatus.reviewed',
          2: 'page.projectManage.failedBug.reviewStatus.notReviewed'
        };

        return <NTag type={tagMap[row.reviewStatus]}>{$t(labelMap[row.reviewStatus])}</NTag>;
      }
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 80,
      render: row => (
        <NButton type="primary" ghost size="small" onClick={() => handleReview(row)}>
          {$t('page.projectManage.failedBug.review')}
        </NButton>
      )
    }
  ];
});

const defaultSearchValues: FailedBugSearchValues = {
  projectId: null,
  testFailDate: null,
  bugReviewStatus: null
};

const searchValues = ref<FailedBugSearchValues>({ ...defaultSearchValues });

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

const reviewStatusOptions = computed(() => [
  { label: $t('page.projectManage.failedBug.reviewStatus.reviewed'), value: '1' },
  { label: $t('page.projectManage.failedBug.reviewStatus.notReviewed'), value: '2' }
]);

async function handleReview(row: Api.ProjectManage.FailedBugRecord) {
  const { error } = await fetchReviewBug(row.id);

  if (!error) {
    window.$message?.success(`${$t('page.projectManage.failedBug.review')}: ${row.bugId}`);
    refresh();
  }
}
</script>

<template>
  <ConfigProvider>
    <div class="h-full flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
      <NCard :bordered="false" size="small" class="card-wrapper">
        <NCollapse>
          <NCollapseItem :title="$t('common.search')" name="failed-bug-search">
            <NForm :model="searchValues" label-placement="left" :label-width="120">
              <NGrid responsive="screen" item-responsive>
                <NFormItemGi
                  span="24 s:12 m:8"
                  :label="$t('page.projectManage.failedBug.projectId')"
                  path="projectId"
                  class="pr-24px"
                >
                  <NInput
                    v-model:value="searchValues.projectId"
                    clearable
                    :placeholder="$t('page.projectManage.failedBug.projectId')"
                  />
                </NFormItemGi>
                <NFormItemGi
                  span="24 s:12 m:8"
                  :label="$t('page.projectManage.failedBug.testFailDate')"
                  path="testFailDate"
                  class="pr-24px"
                >
                  <NDatePicker
                    v-model:value="searchValues.testFailDate"
                    type="date"
                    clearable
                    class="w-full"
                    :placeholder="$t('page.projectManage.failedBug.testFailDate')"
                  />
                </NFormItemGi>
                <NFormItemGi
                  span="24 s:12 m:8"
                  :label="$t('page.projectManage.failedBug.bugReviewStatus')"
                  path="bugReviewStatus"
                  class="pr-24px"
                >
                  <NSelect
                    v-model:value="searchValues.bugReviewStatus"
                    clearable
                    :options="reviewStatusOptions"
                    :placeholder="$t('page.projectManage.failedBug.bugReviewStatus')"
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
        :title="$t('page.projectManage.failedBug.bugList')"
        size="small"
        flex-height
        :columns="columns"
        row-key="id"
        class="flex-1"
        v-bind="tableProps"
      />
    </div>
  </ConfigProvider>
</template>
