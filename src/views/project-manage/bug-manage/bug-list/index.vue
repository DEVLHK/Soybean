<script setup lang="tsx">
import { computed, nextTick, reactive, ref, toRaw } from 'vue';
import { NButton, NTag } from 'naive-ui';
import { useNDataTable } from 'pro-naive-ui';
import type { ProDataTableColumns } from 'pro-naive-ui';
import WangEditor from 'wangeditor';
import { fetchGetBugCommentDetail, fetchGetBugCommentList, fetchUpdateBugComment } from '@/service/api';
import { $t } from '@/locales';
import { useFormRules, useNaiveForm } from '@/hooks/common/form';
import ConfigProvider from '@/views/pro-naive/ConfigProvider.vue';

defineOptions({
  name: 'ProjectManageBugManageBugList'
});

interface BugCommentSearchValues {
  projectId: string | null;
  bugId: string | null;
  testFailureDate: number | null;
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

  return { total: data.total, list: data.records };
}

/** failure reason category dictionary (backend has no dict endpoint, maintained here) */
const failureReasonCategoryLabels = computed(() => {
  const map: Record<string, App.I18n.I18nKey> = {
    1: 'page.projectManage.failedBug.comment.category.1',
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

const columns = computed<ProDataTableColumns<Api.ProjectManage.FailedBugComment>>(() => {
  return [
    {
      key: 'index',
      title: $t('common.index'),
      align: 'center',
      width: 64,
      render: (_, index) => index + 1
    },
    {
      key: 'projectId',
      title: $t('page.projectManage.failedBug.projectId'),
      align: 'center',
      width: 130
    },
    {
      key: 'bugId',
      title: $t('page.projectManage.failedBug.bugId'),
      align: 'center',
      width: 150
    },
    {
      key: 'testFailureDate',
      title: $t('page.projectManage.failedBug.testFailDate'),
      align: 'center',
      width: 120
    },
    {
      key: 'failureReasonCategory',
      title: $t('page.projectManage.failedBug.comment.failureReasonCategory'),
      align: 'center',
      width: 180,
      ellipsis: { tooltip: true },
      render: row => failureReasonCategoryLabels.value[row.failureReasonCategory] ?? row.failureReasonCategory
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
  testFailureDate: null
};

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
    isCausedByFixing: false
  };
}

/** rich text editors for failureReason / suggestion */
const reasonDomRef = ref<HTMLElement>();
const suggestionDomRef = ref<HTMLElement>();
const reasonEditor = ref<WangEditor>();
const suggestionEditor = ref<WangEditor>();

/** editors live inside the modal, create them lazily after the modal dom is rendered */
let editorsReady = false;

function ensureEditors() {
  if (editorsReady) {
    return Promise.resolve();
  }

  return nextTick().then(() => {
    if (reasonDomRef.value && !reasonEditor.value) {
      reasonEditor.value = createEditor(reasonDomRef.value);
    }
    if (suggestionDomRef.value && !suggestionEditor.value) {
      suggestionEditor.value = createEditor(suggestionDomRef.value);
    }
    editorsReady = Boolean(reasonEditor.value && suggestionEditor.value);
  });
}

function createEditor(dom: HTMLElement) {
  const editor = new WangEditor(dom);
  editor.config.zIndex = 10;
  editor.config.height = 200;
  editor.config.placeholder = '';
  editor.create();
  return editor;
}

function setEditorHtml(editor: WangEditor | undefined, html: string) {
  editor?.txt.html(html ?? '');
}

function getEditorHtml(editor: WangEditor | undefined) {
  const html = editor?.txt.html() ?? '';
  // wangEditor's empty content
  return html === '<p><br></p>' ? '' : html;
}

type CommentRuleKey = 'failureReasonCategory';

const commentRules: Record<CommentRuleKey, App.Global.FormRule> = {
  failureReasonCategory: defaultRequiredRule
};

const categoryOptions = computed(() =>
  Object.entries(failureReasonCategoryLabels.value).map(([value, label]) => ({ label, value }))
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
  setEditorHtml(reasonEditor.value, '');
  setEditorHtml(suggestionEditor.value, '');
  restoreValidation();
  commentModalVisible.value = true;

  // create editors after the modal content is in the dom
  await ensureEditors();

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
      isCausedByFixing: data.isCausedByFixing ?? false
    });
    setEditorHtml(reasonEditor.value, data.failureReason ?? '');
    setEditorHtml(suggestionEditor.value, data.suggestion ?? '');
  }
}

async function handleSubmitComment() {
  await validate();

  submitLoading.value = true;

  const { error } = await fetchUpdateBugComment({
    projectId: commentModel.projectId,
    bugId: commentModel.bugId,
    seqNo: commentModel.seqNo,
    failureReasonCategory: commentModel.failureReasonCategory!,
    failureReason: getEditorHtml(reasonEditor.value),
    isCausedByFixing: commentModel.isCausedByFixing,
    suggestion: getEditorHtml(suggestionEditor.value)
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
        <NCollapse>
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
        :title="$t('route.project-manage_bug-manage_bug-list')"
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
      :title="$t('page.projectManage.failedBug.comment.addComment')"
      preset="card"
      class="w-760px"
      display-directive="show"
    >
      <NForm ref="formRef" :model="commentModel" :rules="commentRules" label-placement="left" :label-width="110">
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
        <NFormItem :label="$t('page.projectManage.failedBug.comment.failureReason')" path="failureReason">
          <div ref="reasonDomRef" class="w-full bg-white dark:bg-dark"></div>
        </NFormItem>
        <NFormItem :label="$t('page.projectManage.failedBug.comment.isCausedByFixing')" path="isCausedByFixing">
          <NRadioGroup v-model:value="commentModel.isCausedByFixing">
            <NRadio :value="false">{{ $t('common.yesOrNo.no') }}</NRadio>
            <NRadio :value="true">{{ $t('common.yesOrNo.yes') }}</NRadio>
          </NRadioGroup>
        </NFormItem>
        <NFormItem :label="$t('page.projectManage.failedBug.comment.suggestion')" path="suggestion">
          <div ref="suggestionDomRef" class="w-full bg-white dark:bg-dark"></div>
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

<style scoped>
:deep(.w-e-toolbar) {
  background: inherit !important;
  border-color: #999 !important;
}

:deep(.w-e-text-container) {
  background: inherit;
  border-color: #999 !important;
}
</style>
