<script setup lang="tsx">
import { computed, nextTick, reactive, ref, toRaw } from 'vue';
import { NButton } from 'naive-ui';
import type { DataTableColumns, UploadFileInfo } from 'naive-ui';
import hljs from 'highlight.js/lib/core';
import python from 'highlight.js/lib/languages/python';
import { useNDataTable } from 'pro-naive-ui';
import type { ProDataTableColumns } from 'pro-naive-ui';
import {
  fetchAddScriptInfo,
  fetchDeleteScriptInfo,
  fetchGetScriptContent,
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
    key: 'mandatory',
    title: $t('page.scheduleManage.scriptManage.mandatory'),
    align: 'center',
    width: 80,
    render: row => (row.mandatory ? $t('common.yesOrNo.yes') : $t('common.yesOrNo.no'))
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
  /** true = required, false = optional (inverted from the old optional flag) */
  mandatory: boolean;
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

/** script repo dir (backend convention, repo-relative) */

const SCRIPT_DIR = 'app/schedule/scripts_custom/';

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
  return { param_name: '', description: '', param_type: 'String', mandatory: true, default: '' };
}

function handleAdd() {
  isEdit.value = false;
  Object.assign(scriptModel, createDefaultScriptModel());
  uploadFileList.value = [];
  paramRows.value = [];
  resetScriptContentState();
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
  // always clear the previous session's cached script content (confirmed or not)
  resetScriptContentState();
  paramRows.value = (row.params ?? []).map(param => ({
    param_name: param.param_name,
    description: param.description,
    param_type: param.param_type,
    mandatory: param.mandatory,
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
      mandatory: param.mandatory,
      default: param.default === null || param.default === undefined ? '' : String(param.default)
    }));
  }
}

function collectParams(): Api.ScheduleManage.ScriptParam[] {
  return paramRows.value.map(row => ({
    param_name: row.param_name.trim(),
    description: row.description.trim(),
    param_type: row.param_type ?? 'String',
    mandatory: row.mandatory,
    default: row.default === '' ? null : row.default
  }));
}

/** every param row must have name/description/type filled (optional flag & default value are not required) */
function validateParamRows(): boolean {
  const invalid = paramRows.value.some(row => !row.param_name.trim() || !row.description.trim() || !row.param_type);

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
        params,
        // send the script content only when it was actually modified; omit = backend keeps the file
        ...(scriptContentCache.value !== null && scriptContentCache.value !== scriptContentOriginal.value
          ? { content: scriptContentCache.value }
          : {})
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

/** ---------- script content editing (edit mode only) ---------- */
/** cached content to submit; null = unmodified (nothing sent to backend) */
const scriptContentCache = ref<string | null>(null);
/** content fetched from the server when the code modal opened (baseline for change detection) */
const scriptContentOriginal = ref<string | null>(null);
const codeModalVisible = ref(false);
const codeModalLoading = ref(false);
/** editing buffer inside the code modal */
const codeModalContent = ref('');
/** local upload control beside 脚本路径 (edit mode) */
const editUploadFileList = ref<UploadFileInfo[]>([]);

function resetScriptContentState() {
  scriptContentCache.value = null;
  scriptContentOriginal.value = null;
  codeModalContent.value = '';
  editUploadFileList.value = [];
}

/** open the code modal: prefer the local cache; only fetch from the backend when uncached */
async function handleOpenCodeModal() {
  if (scriptContentCache.value !== null) {
    codeModalContent.value = scriptContentCache.value;
    codeModalVisible.value = true;
    return;
  }
  codeModalVisible.value = true;
  codeModalLoading.value = true;
  const { error, data } = await fetchGetScriptContent(scriptModel.scriptName);
  codeModalLoading.value = false;
  if (error || !data) {
    codeModalVisible.value = false;
    return;
  }
  scriptContentOriginal.value = data.content;
  codeModalContent.value = data.content;
}

/** 保存 in the code modal: cache the edited content */
function handleCodeModalSave() {
  scriptContentCache.value = codeModalContent.value;
  codeModalVisible.value = false;
}

/** 取消 in the code modal: just close; the cache keeps its previous value */
function handleCodeModalCancel() {
  codeModalVisible.value = false;
}

/** ---------- python highlight editor (highlight layer + transparent textarea overlay) ---------- */
hljs.registerLanguage('python', python);

/** highlight theme options (persisted in localStorage) */
const CODE_THEME_KEY = 'tm-code-theme';
const codeThemeOptions = [
  { label: 'GitHub Dark', value: 'code-theme-github-dark' },
  { label: 'Monokai', value: 'code-theme-monokai' },
  { label: 'One Dark', value: 'code-theme-one-dark' },
  { label: 'One Light', value: 'code-theme-one-light' }
];

function loadCodeTheme(): string {
  try {
    const saved = localStorage.getItem(CODE_THEME_KEY);
    if (saved && codeThemeOptions.some(o => o.value === saved)) {
      return saved;
    }
  } catch {
    // localStorage unavailable - fall back to the default
  }
  return 'code-theme-github-dark';
}

const codeTheme = ref(loadCodeTheme());

function handleCodeThemeChange(value: string) {
  codeTheme.value = value;
  try {
    localStorage.setItem(CODE_THEME_KEY, value);
  } catch {
    // ignore persistence failures
  }
}

const codeHighlightCache = new Map<string, string>();

function highlightPythonCode(text: string) {
  let html = codeHighlightCache.get(text);
  if (!html) {
    html = hljs.highlight(text, { language: 'python' }).value;
    // cap the cache to keep memory bounded on very large edits
    if (codeHighlightCache.size > 500) {
      codeHighlightCache.clear();
    }
    codeHighlightCache.set(text, html);
  }
  return html;
}

/** trailing newline kept visible at the end of the highlight layer */
const codeHighlightedHtml = computed(() => `${highlightPythonCode(codeModalContent.value)}\n`);

const codeEditorFullscreen = ref(false);
const codeTextareaRef = ref<HTMLTextAreaElement | null>(null);
const codeHighlightLayerRef = ref<HTMLElement | null>(null);

/** mirror the textarea scroll position onto the highlight layer */
function handleCodeScroll() {
  const ta = codeTextareaRef.value;
  if (codeHighlightLayerRef.value && ta) {
    codeHighlightLayerRef.value.scrollTop = ta.scrollTop;
    codeHighlightLayerRef.value.scrollLeft = ta.scrollLeft;
  }
}

function toggleCodeFullscreen() {
  codeEditorFullscreen.value = !codeEditorFullscreen.value;
  // re-sync scroll after the size change
  nextTick(handleCodeScroll);
}

function handleCodeModalClose() {
  codeEditorFullscreen.value = false;
  codeHighlightCache.clear();
}

/** local .py upload beside 脚本路径: validate name, open the code modal with the file content.
 * nothing is cached here - caching only happens on 保存 in the modal */
function handleEditUploadChange({ fileList }: { fileList: UploadFileInfo[] }) {
  const info = fileList[0];
  const file = info?.file;
  // naive-ui may emit change events without an attached file (e.g. removal) - ignore those
  if (!info || !file) {
    return;
  }
  const rawName = info.name || file.name;
  if (!/\.py$/i.test(rawName)) {
    window.$message?.error(`${$t('page.scheduleManage.scriptManage.uploadTip')}（收到: ${rawName}）`);
    editUploadFileList.value = [];
    return;
  }
  if (rawName.replace(/\.py$/i, '') !== scriptModel.scriptName) {
    window.$message?.error(`文件名必须与脚本名一致: ${scriptModel.scriptName}.py（收到: ${rawName}）`);
    editUploadFileList.value = [];
    return;
  }
  file.text().then(text => {
    // clear the internal file list so max=1 doesn't block subsequent uploads
    editUploadFileList.value = [];
    codeModalContent.value = text;
    codeModalVisible.value = true;
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
      class="edit-script-modal w-1500px"
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
          <div class="w-full flex items-center gap-4px">
            <NInput v-model:value="scriptModel.scriptPath" disabled class="min-w-0 flex-1" style="min-width: 300px" />
            <template v-if="isEdit">
              <NTooltip>
                <template #trigger>
                  <NButton size="small" quaternary type="primary" @click="handleOpenCodeModal">
                    <template #icon>
                      <icon-ic-round-edit class="text-icon" />
                    </template>
                  </NButton>
                </template>
                编辑脚本内容
              </NTooltip>
              <NUpload
                v-model:file-list="editUploadFileList"
                accept=".py"
                :max="1"
                :default-upload="false"
                :show-file-list="false"
                class="w-auto flex-none"
                @change="handleEditUploadChange"
              >
                <NButton size="small" quaternary>
                  <template #icon>
                    <icon-ic-round-file-upload class="text-icon" />
                  </template>
                </NButton>
              </NUpload>
            </template>
          </div>
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
            <NCheckbox v-model:checked="value.mandatory" size="small" style="width: 50px" class="whitespace-nowrap">
              {{ $t('page.scheduleManage.scriptManage.mandatory') }}
            </NCheckbox>
            <NInput
              v-model:value="value.description"
              size="small"
              class="min-w-0 flex-1"
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

    <!-- python code editor modal (black background, python highlight) -->
    <NModal
      v-model:show="codeModalVisible"
      :title="`${scriptModel.scriptName}.py`"
      preset="card"
      class="code-modal w-1000px"
      :class="{ 'code-modal-fullscreen': codeEditorFullscreen }"
      @after-leave="handleCodeModalClose"
    >
      <template #header-extra>
        <div class="flex-y-center gap-8px">
          <NSelect
            size="small"
            :value="codeTheme"
            :options="codeThemeOptions"
            class="w-130px"
            @update:value="handleCodeThemeChange"
          />
          <NTooltip>
            <template #trigger>
              <NButton size="small" quaternary @click="toggleCodeFullscreen">
                <template #icon>
                  <icon-ic-round-fullscreen-exit v-if="codeEditorFullscreen" class="text-icon" />
                  <icon-ic-round-fullscreen v-else class="text-icon" />
                </template>
              </NButton>
            </template>
            {{ codeEditorFullscreen ? '退出全屏' : '全屏' }}
          </NTooltip>
        </div>
      </template>
      <div class="code-editor-wrap" :class="[codeTheme, { fullscreen: codeEditorFullscreen }]">
        <pre ref="codeHighlightLayerRef" class="code-highlight" aria-hidden="true"><code
          v-html="codeHighlightedHtml"
        /></pre>
        <textarea
          ref="codeTextareaRef"
          v-model="codeModalContent"
          class="code-textarea"
          spellcheck="false"
          autocapitalize="off"
          autocomplete="off"
          @scroll="handleCodeScroll"
        />
        <div v-if="codeModalLoading" class="code-loading-mask">加载中...</div>
      </div>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="handleCodeModalCancel">{{ $t('common.cancel') }}</NButton>
          <NButton type="primary" @click="handleCodeModalSave">{{ $t('common.save') }}</NButton>
        </NSpace>
      </template>
    </NModal>
  </ConfigProvider>
</template>

<style scoped>
/* python highlight editor: highlight layer under a transparent textarea */
.code-editor-wrap {
  position: relative;
  height: 60vh;
  overflow: hidden;
  background-color: var(--code-bg);
  border-radius: 4px;
}
.code-highlight,
.code-textarea {
  position: absolute;
  inset: 0;
  margin: 0;
  border: 0;
  padding: 12px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre;
  overflow: auto;
  tab-size: 4;
}
.code-highlight {
  z-index: 1;
  color: var(--code-fg);
  pointer-events: none;
  overflow: hidden;
}
.code-highlight code {
  font: inherit;
}
.code-textarea {
  z-index: 2;
  background-color: transparent;
  color: transparent;
  caret-color: var(--code-caret);
  resize: none;
  outline: none;
}
.code-textarea::selection {
  background-color: var(--code-selection);
  color: transparent;
}
.code-loading-mask {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(13, 17, 23, 80%);
  color: #8b949e;
  font-size: 13px;
}
</style>
<style>
/* the code modal is teleported to body: non-scoped styles.
   fit the viewport and let the card content flex */
.code-modal {
  max-width: 96vw;
}
.code-modal-fullscreen {
  width: 100vw !important;
  max-width: 100vw;
  height: 96vh;
  max-height: 96vh;
}
/* collapse every reserved gap: theme paddings, header, content, footer.
   !important is required: naive-ui writes the theme paddings as INLINE custom
   properties on the card element, which beat normal stylesheet declarations */
.code-modal.n-card {
  --n-padding-left: 12px !important;
  --n-padding-bottom: 8px !important;
}
.code-modal.n-card {
  padding: 0;
}
.code-modal-fullscreen > .n-card-header {
  padding: 8px 12px 0;
}
.code-modal-fullscreen .n-card__content {
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-height: 0;
  padding: 8px 12px 0 !important;
}
.code-modal-fullscreen .code-editor-wrap {
  /* deterministic height: 96vh card - header(~44px) - footer(~44px) - content padding(8px) - slack */
  height: calc(96vh - 110px) !important;
  min-height: 400px;
  border-radius: 0;
}
.code-modal-fullscreen .n-card__footer {
  padding: 8px 12px !important;
}
/* hljs token colors: driven by theme variables */
.code-highlight .hljs-keyword,
.code-highlight .hljs-selector-tag,
.code-highlight .hljs-literal {
  color: var(--hl-keyword);
}
.code-highlight .hljs-string {
  color: var(--hl-string);
}
.code-highlight .hljs-title,
.code-highlight .hljs-name,
.code-highlight .hljs-title.function_ {
  color: var(--hl-title);
}
.code-highlight .hljs-comment {
  color: var(--hl-comment);
  font-style: italic;
}
.code-highlight .hljs-number {
  color: var(--hl-number);
}
.code-highlight .hljs-built_in,
.code-highlight .hljs-attr,
.code-highlight .hljs-attribute {
  color: var(--hl-built-in);
}
.code-highlight .hljs-meta,
.code-highlight .hljs-symbol {
  color: var(--hl-built-in);
}
.code-highlight .hljs-type,
.code-highlight .hljs-class .hljs-title {
  color: var(--hl-built-in);
}
/* theme palettes */
.code-theme-github-dark {
  --code-bg: #0d1117;
  --code-fg: #c9d1d9;
  --code-caret: #58a6ff;
  --code-selection: rgba(56, 139, 253, 40%);
  --hl-keyword: #ff7b72;
  --hl-string: #a5d6ff;
  --hl-title: #d2a8ff;
  --hl-comment: #8b949e;
  --hl-number: #79c0ff;
  --hl-built-in: #ffa657;
}
.code-theme-monokai {
  --code-bg: #272822;
  --code-fg: #f8f8f2;
  --code-caret: #f8f8f0;
  --code-selection: rgba(73, 72, 62, 80%);
  --hl-keyword: #f92672;
  --hl-string: #e6db74;
  --hl-title: #a6e22e;
  --hl-comment: #75715e;
  --hl-number: #ae81ff;
  --hl-built-in: #66d9ef;
}
.code-theme-one-dark {
  --code-bg: #282c34;
  --code-fg: #abb2bf;
  --code-caret: #528bff;
  --code-selection: rgba(82, 139, 255, 30%);
  --hl-keyword: #c678dd;
  --hl-string: #98c379;
  --hl-title: #61afef;
  --hl-comment: #5c6370;
  --hl-number: #d19a66;
  --hl-built-in: #e5c07b;
}
.code-theme-one-light {
  --code-bg: #fafafa;
  --code-fg: #383a42;
  --code-caret: #526fff;
  --code-selection: rgba(64, 120, 242, 20%);
  --hl-keyword: #a626a4;
  --hl-string: #50a14f;
  --hl-title: #4078f2;
  --hl-comment: #a0a1a7;
  --hl-number: #986801;
  --hl-built-in: #c18401;
}
</style>
<style>
/* edit-script modal is teleported to body: cap it to the viewport size */
.edit-script-modal {
  max-width: 92vw;
  max-height: 92vh;
}
.edit-script-modal .n-card__content {
  max-height: calc(92vh - 120px);
  overflow: auto;
}
</style>
