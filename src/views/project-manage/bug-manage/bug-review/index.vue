<script setup lang="tsx">
import { computed, reactive, ref, toRaw } from 'vue';
import { NButton, NTag } from 'naive-ui';
import { useNDataTable } from 'pro-naive-ui';
import type { ProDataTableColumns } from 'pro-naive-ui';
import { fetchGetBugCommentDetail, fetchGetBugCommentList, fetchUpdateBugComment } from '@/service/api';
import { $t } from '@/locales';
import { useFormRules, useNaiveForm } from '@/hooks/common/form';
import ConfigProvider from '@/views/pro-naive/ConfigProvider.vue';

defineOptions({
  name: 'ProjectManageBugManageBugReview'
});

interface BugCommentSearchValues {
  projectId: string | null;
  bugId: string | null;
  testFailureDate: number | null;
  /** "1" analyzed, "2" not analyzed — client-side only */
  hasAnalysis: string | null;
}

async function fetchList(params: any, values: BugCommentSearchValues | Record<string, any>) {
  const { data, error } = await fetchGetBugCommentList({
    current: params.current,
    pageSize: params.pageSize,
    // qs serializes null/'' as empty string which fails fastapi int parsing, use undefined to skip them
    projectId: values.projectId || undefined,
    bugId: values.bugId || undefined,
    testFailureDate: values.testFailureDate ?? undefined
  });

  if (error) {
    return { total: 0, list: [] };
  }

  // has-analysis is derived from failureReasonCategory, backend has no such param (filters current page only)
  let records = data.records;
  if (values.hasAnalysis === '1') {
    records = records.filter(row => row.failureReasonCategory != null);
  } else if (values.hasAnalysis === '2') {
    records = records.filter(row => row.failureReasonCategory == null);
  }

  return { total: data.total, list: records };
}

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

/** pms bug detail page, e.g. BUG-37624 -> https://pms.hisunglobal.com/bug-view-37624.html */
function bugViewUrl(bugId: string): string | null {
  const match = bugId.match(/(\d+)\s*$/);
  return match ? `https://pms.hisunglobal.com/bug-view-${Number(match[1])}.html` : null;
}

const columns = computed<ProDataTableColumns<Api.ProjectManage.FailedBugComment>>(() => {
  return [
    {
      key: 'projectId',
      title: $t('page.projectManage.failedBug.projectId'),
      align: 'center',
      width: 90
    },
    {
      key: 'bugId',
      title: $t('page.projectManage.failedBug.bugId'),
      align: 'center',
      width: 90,
      render: row => {
        const url = bugViewUrl(row.bugId);
        return url ? (
          <a class="text-primary hover:underline" href={url} target="_blank" rel="noopener noreferrer">
            {row.bugId}
          </a>
        ) : (
          row.bugId
        );
      }
    },
    {
      key: 'bugTitle',
      title: $t('page.projectManage.failedBug.bugTitle'),
      align: 'left',
      minWidth: 130,
      ellipsis: { tooltip: true },
      render: row => row.bugTitle ?? '-'
    },
    {
      key: 'bugStatus',
      title: $t('page.projectManage.failedBug.bugCurrentStatus'),
      align: 'center',
      width: 110,
      render: row => row.bugStatus ?? '-'
    },
    {
      key: 'seqNo',
      title: $t('page.projectManage.failedBug.comment.seqNo'),
      align: 'center',
      width: 100
    },
    {
      key: 'testFailureDate',
      title: $t('page.projectManage.failedBug.testFailDate'),
      align: 'center',
      width: 120
    },
    {
      key: 'lastResolver',
      title: $t('page.projectManage.failedBug.bugLastResolver'),
      align: 'center',
      width: 150,
      ellipsis: { tooltip: true }
    },
    {
      key: 'qaOwner',
      title: $t('page.projectManage.failedBug.bugQa'),
      align: 'center',
      width: 110
    },
    {
      key: 'failureReasonCategory',
      title: $t('page.projectManage.failedBug.comment.failureReasonCategory'),
      align: 'center',
      minWidth: 180,
      ellipsis: { tooltip: true },
      render: row => failureReasonCategoryLabels.value[row.failureReasonCategory] ?? row.failureReasonCategory
    },
    {
      key: 'hasAnalysis',
      title: $t('page.projectManage.failedBug.hasAnalysis'),
      align: 'center',
      width: 120,
      render: row => (
        <NTag type={row.failureReasonCategory != null ? 'success' : 'warning'}>
          {row.failureReasonCategory != null ? $t('common.yesOrNo.yes') : $t('common.yesOrNo.no')}
        </NTag>
      )
    },
    {
      key: 'reviewStatus',
      title: $t('page.projectManage.failedBug.bugReviewStatus'),
      align: 'center',
      width: 100,
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
      width: 180,
      render: row => (
        <div class="flex-center justify-center gap-8px">
          <NButton type="primary" ghost size="small" onClick={() => handleReview(row)}>
            {$t('page.projectManage.failedBug.review')}
          </NButton>
          <NButton type="primary" ghost size="small" onClick={() => handleComment(row)}>
            {$t('page.projectManage.failedBug.comment.addComment')}
          </NButton>
        </div>
      )
    }
  ];
});

/** review button placeholder: no api call for now */
function handleReview(row: Api.ProjectManage.FailedBugComment) {
  console.log('review', row);
  window.$message?.success(`${$t('page.projectManage.failedBug.review')}: ${row.bugId} #${row.seqNo}`);
}

const defaultSearchValues: BugCommentSearchValues = {
  projectId: null,
  bugId: null,
  testFailureDate: null,
  hasAnalysis: null
};

const hasAnalysisOptions = [
  { label: $t('common.yesOrNo.yes'), value: '1' },
  { label: $t('common.yesOrNo.no'), value: '2' }
];

const searchValues = ref<BugCommentSearchValues>({ ...defaultSearchValues });

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

/** ---------- comment (update) modal ---------- */
interface CommentFormModel {
  projectId: string;
  bugId: string;
  seqNo: number;
  /** display only */
  testFailureDate: string;
  failureReasonCategory: string | null;
  isCausedByFixing: boolean;
  failureReason: string;
  suggestion: string;
}

const commentModalVisible = ref(false);
const commentDetailLoading = ref(false);
const submitLoading = ref(false);

const { formRef, validate, restoreValidation } = useNaiveForm();
const { defaultRequiredRule } = useFormRules();

const commentModel = reactive<CommentFormModel>(createDefaultCommentModel());

function createDefaultCommentModel(): CommentFormModel {
  return {
    projectId: '',
    bugId: '',
    seqNo: 0,
    testFailureDate: '',
    failureReasonCategory: null,
    isCausedByFixing: false,
    failureReason: '',
    suggestion: ''
  };
}

/** rich-text era content -> plain text for the textarea fields */
function htmlToText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .trim();
}

type CommentRuleKey = 'failureReasonCategory';

const commentRules: Record<CommentRuleKey, App.Global.FormRule> = {
  failureReasonCategory: defaultRequiredRule
};

/** dropdown order: keep 12 (提出新需求) right after 1, numeric key order would push it to the end */
const categoryOrder = ['1', '12', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];

const categoryOptions = computed(() =>
  categoryOrder
    .filter(code => failureReasonCategoryLabels.value[code])
    .map(value => ({ label: failureReasonCategoryLabels.value[value], value }))
);

/** fullscreen toggle for the analysis modal */
const analysisFullscreen = ref(false);
const analysisModalStyle = computed(() =>
  analysisFullscreen.value
    ? { width: '100vw', height: '100vh', maxWidth: '100vw', borderRadius: '0' }
    : { maxWidth: '96vw' }
);
const analysisContentStyle = computed(() =>
  analysisFullscreen.value ? 'max-height: calc(100vh - 180px); overflow: auto' : 'max-height: 72vh; overflow: auto'
);

/** open the comment modal: prefill from row, then load detail for full fields */
async function handleComment(row: Api.ProjectManage.FailedBugComment) {
  Object.assign(commentModel, createDefaultCommentModel(), {
    projectId: row.projectId,
    bugId: row.bugId,
    seqNo: row.seqNo,
    testFailureDate: row.testFailureDate,
    failureReasonCategory: row.failureReasonCategory
  });
  restoreValidation();
  commentModalVisible.value = true;

  // the list api keeps light, fetch the detail to prefill reason/suggestion/etc.
  commentDetailLoading.value = true;
  const { error, data } = await fetchGetBugCommentDetail({
    projectId: row.projectId,
    bugId: row.bugId,
    seqNo: row.seqNo
  });
  commentDetailLoading.value = false;

  if (!error && data) {
    Object.assign(commentModel, {
      failureReasonCategory: data.failureReasonCategory,
      isCausedByFixing: data.isCausedByFixing ?? false,
      failureReason: htmlToText(data.failureReason ?? ''),
      suggestion: htmlToText(data.suggestion ?? '')
    });
  }
}

async function handleSubmitComment() {
  await validate();

  // all fields required except suggestion
  if (!commentModel.failureReason.trim()) {
    window.$message?.error($t('page.projectManage.failedBug.comment.reasonRequired'));
    return;
  }

  submitLoading.value = true;

  const { error } = await fetchUpdateBugComment({
    projectId: commentModel.projectId,
    bugId: commentModel.bugId,
    seqNo: commentModel.seqNo,
    failureReasonCategory: commentModel.failureReasonCategory!,
    failureReason: commentModel.failureReason.trim(),
    isCausedByFixing: commentModel.isCausedByFixing,
    suggestion: commentModel.suggestion.trim()
  });

  submitLoading.value = false;

  if (!error) {
    window.$message?.success($t('common.updateSuccess'));
    commentModalVisible.value = false;
    refresh();
  }
}
</script>

<template>
  <ConfigProvider>
    <div class="h-full flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
      <NCard :bordered="false" size="small" class="card-wrapper">
        <NCollapse :default-expanded-names="['bug-review-search']">
          <NCollapseItem :title="$t('common.search')" name="bug-review-search">
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
                  :label="$t('page.projectManage.failedBug.bugId')"
                  path="bugId"
                  class="pr-24px"
                >
                  <NInput
                    v-model:value="searchValues.bugId"
                    clearable
                    :placeholder="$t('page.projectManage.failedBug.bugId')"
                  />
                </NFormItemGi>
                <NFormItemGi
                  span="24 s:12 m:8"
                  :label="$t('page.projectManage.failedBug.testFailDate')"
                  path="testFailureDate"
                  class="pr-24px"
                >
                  <NDatePicker
                    v-model:value="searchValues.testFailureDate"
                    type="date"
                    clearable
                    class="w-full"
                    :placeholder="$t('page.projectManage.failedBug.testFailDate')"
                  />
                </NFormItemGi>
                <NFormItemGi
                  span="24 s:12 m:8"
                  :label="$t('page.projectManage.failedBug.hasAnalysis')"
                  path="hasAnalysis"
                  class="pr-24px"
                >
                  <NSelect
                    v-model:value="searchValues.hasAnalysis"
                    clearable
                    :options="hasAnalysisOptions"
                    :placeholder="$t('page.projectManage.failedBug.hasAnalysis')"
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
        :title="$t('page.projectManage.failedBug.pendingAnalysisList')"
        size="small"
        flex-height
        :columns="columns"
        :row-key="(row: Api.ProjectManage.FailedBugComment) => `${row.projectId}_${row.bugId}_${row.seqNo}`"
        class="flex-1"
        v-bind="tableProps"
      />
    </div>

    <NModal
      v-model:show="commentModalVisible"
      preset="card"
      class="w-1200px"
      :style="analysisModalStyle"
      :content-style="analysisContentStyle"
      :mask-closable="false"
      display-directive="show"
    >
      <template #header>
        <div class="flex w-full items-center justify-between">
          <span>{{ $t('page.projectManage.failedBug.comment.addComment') }}</span>
          <NButton size="tiny" quirk circle class="mr-24px" @click="analysisFullscreen = !analysisFullscreen">
            <template #icon>
              <icon-ic-round-fullscreen v-if="!analysisFullscreen" class="text-icon" />
              <icon-ic-round-fullscreen-exit v-else class="text-icon" />
            </template>
          </NButton>
        </div>
      </template>
      <NForm ref="formRef" :model="commentModel" :rules="commentRules" label-placement="left" :label-width="140">
        <NFormItem :label="$t('page.projectManage.failedBug.projectId')" path="projectId">
          <NInput v-model:value="commentModel.projectId" disabled />
        </NFormItem>
        <NFormItem :label="$t('page.projectManage.failedBug.bugId')" path="bugId">
          <NInput v-model:value="commentModel.bugId" disabled />
        </NFormItem>
        <NFormItem :label="$t('page.projectManage.failedBug.comment.seqNo')" path="seqNo">
          <NInputNumber :value="commentModel.seqNo" disabled class="w-full" :show-button="false" />
        </NFormItem>
        <NFormItem :label="$t('page.projectManage.failedBug.testFailDate')" path="testFailureDate">
          <NInput :value="commentModel.testFailureDate" disabled />
        </NFormItem>
        <NFormItem
          :label="$t('page.projectManage.failedBug.comment.failureReasonCategory')"
          path="failureReasonCategory"
        >
          <NSelect
            v-model:value="commentModel.failureReasonCategory"
            :options="categoryOptions"
            :loading="commentDetailLoading"
            :placeholder="$t('page.projectManage.failedBug.comment.failureReasonCategory')"
          />
        </NFormItem>
        <NFormItem :label="$t('page.projectManage.failedBug.comment.isCausedByFixing')" path="isCausedByFixing">
          <NRadioGroup v-model:value="commentModel.isCausedByFixing">
            <NRadio :value="false">{{ $t('common.yesOrNo.no') }}</NRadio>
            <NRadio :value="true">{{ $t('common.yesOrNo.yes') }}</NRadio>
          </NRadioGroup>
        </NFormItem>
        <NFormItem :label="$t('page.projectManage.failedBug.comment.failureReason')" path="failureReason">
          <NInput
            v-model:value="commentModel.failureReason"
            type="textarea"
            :rows="8"
            :loading="commentDetailLoading"
            :placeholder="$t('page.projectManage.failedBug.comment.failureReason')"
          />
        </NFormItem>
        <NFormItem :label="$t('page.projectManage.failedBug.comment.suggestion')" path="suggestion">
          <NInput
            v-model:value="commentModel.suggestion"
            type="textarea"
            :rows="8"
            :loading="commentDetailLoading"
            :placeholder="$t('page.projectManage.failedBug.comment.suggestion')"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="commentModalVisible = false">{{ $t('common.cancel') }}</NButton>
          <NButton type="primary" :loading="submitLoading" @click="handleSubmitComment">
            {{ $t('common.confirm') }}
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </ConfigProvider>
</template>

<style scoped></style>
