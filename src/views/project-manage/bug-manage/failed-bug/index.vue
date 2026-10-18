<script setup lang="tsx">
import { computed, ref, toRaw } from 'vue';
import { NButton, NTag } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { useNDataTable } from 'pro-naive-ui';
import type { ProDataTableColumns } from 'pro-naive-ui';
import { fetchGetBugCommentDetail, fetchGetBugCommentList, fetchGetFailedBugList } from '@/service/api';
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
        <NButton type="primary" ghost size="small" onClick={() => handleViewComments(row)}>
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
  run
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

/** failure reason category dictionary (backend has no dict endpoint, maintained here) */
const failureReasonCategoryLabels = computed(() => {
  const map: Record<string, App.I18n.I18nKey> = {
    1: 'page.projectManage.failedBug.comment.category.1',
    12: 'page.projectManage.failedBug.comment.category.12',
    2: 'page.projectManage.failedBug.comment.category.2',
    3: 'page.projectManage.failedBug.comment.category.3',
    4: 'page.projectManage.failedBug.comment.category.4',
    5: 'page.projectManage.failedBug.comment.category.5',
    6: 'page.projectManage.failedBug.comment.category.6',
    7: 'page.projectManage.failedBug.comment.category.7',
    8: 'page.projectManage.failedBug.comment.category.8',
    9: 'page.projectManage.failedBug.comment.category.9',
    10: 'page.projectManage.failedBug.comment.category.10',
    11: 'page.projectManage.failedBug.comment.category.11'
  };
  return Object.fromEntries(Object.entries(map).map(([code, key]) => [code, $t(key)])) as Record<string, string>;
});

const commentColumns = computed<DataTableColumns<Api.ProjectManage.FailedBugComment>>(() => [
  {
    key: 'seqNo',
    title: $t('page.projectManage.failedBug.comment.seqNo'),
    align: 'center',
    width: 64
  },
  {
    key: 'commentDate',
    title: $t('page.projectManage.failedBug.comment.commentDate'),
    align: 'center',
    width: 170
  },
  {
    key: 'commentedBy',
    title: $t('page.projectManage.failedBug.comment.commentedBy'),
    align: 'center',
    width: 110
  },
  {
    key: 'failureReasonCategory',
    title: $t('page.projectManage.failedBug.comment.failureReasonCategory'),
    align: 'center',
    width: 170,
    render: row => failureReasonCategoryLabels.value[row.failureReasonCategory] ?? row.failureReasonCategory
  },
  {
    key: 'failureReason',
    title: $t('page.projectManage.failedBug.comment.failureReason'),
    align: 'left',
    minWidth: 200
  },
  {
    key: 'isCausedByFixing',
    title: $t('page.projectManage.failedBug.comment.isCausedByFixing'),
    align: 'center',
    width: 110,
    render: row => (row.isCausedByFixing ? $t('common.yesOrNo.yes') : $t('common.yesOrNo.no'))
  },
  {
    key: 'suggestion',
    title: $t('page.projectManage.failedBug.comment.suggestion'),
    align: 'left',
    minWidth: 180
  }
]);

const commentModalVisible = ref(false);
const commentLoading = ref(false);
const commentList = ref<Api.ProjectManage.FailedBugComment[]>([]);
const commentBugId = ref('');

const commentModalTitle = computed(() => `${$t('page.projectManage.failedBug.comment.title')}: ${commentBugId.value}`);

/** open comment modal and load comments of the clicked bug */
async function handleViewComments(row: Api.ProjectManage.FailedBugRecord) {
  commentBugId.value = row.bugId;
  commentList.value = [];
  commentModalVisible.value = true;
  commentLoading.value = true;

  const { error, data } = await fetchGetBugCommentList({
    current: 1,
    pageSize: 100,
    projectId: row.projectId,
    bugId: row.bugId
  });

  if (!error) {
    const records = data?.records ?? [];

    // the list api keeps light (no reason/suggestion/commenter), fetch details to fill the modal
    const details = await Promise.all(
      records.map(item => fetchGetBugCommentDetail({ projectId: item.projectId, bugId: item.bugId, seqNo: item.seqNo }))
    );

    commentList.value = details
      .map((detail, index) => ({ ...records[index], ...(detail.error ? {} : detail.data) }))
      .sort((a, b) => b.seqNo - a.seqNo);
  }

  commentLoading.value = false;
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
        :row-key="(row: Api.ProjectManage.FailedBugRecord) => `${row.projectId}_${row.bugId}`"
        class="flex-1"
        v-bind="tableProps"
      />
    </div>

    <NModal v-model:show="commentModalVisible" :title="commentModalTitle" preset="card" class="w-1000px">
      <NDataTable
        :columns="commentColumns"
        :data="commentList"
        :loading="commentLoading"
        :row-key="(row: Api.ProjectManage.FailedBugComment) => row.seqNo"
        size="small"
        max-height="420"
        class="mb-12px"
      />
    </NModal>
  </ConfigProvider>
</template>
