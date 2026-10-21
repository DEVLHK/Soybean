<script setup lang="tsx">
import { computed, onMounted, reactive, ref, toRaw, watch } from 'vue';
import { NButton, NTag } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { fetchGetMemberTaskDetail, fetchGetMemberTaskSummary } from '@/service/api';
import ConfigProvider from '@/views/pro-naive/ConfigProvider.vue';

defineOptions({
  name: 'ProjectManageTaskMonitor'
});

interface TaskSearchValues {
  project: string | null;
  member: string | null;
  team: string | null;
  /** "1" yes, "0" no */
  overdue: string | null;
  dueDate: number | null;
  execution: string | null;
}

/** show the per-member aggregated summary table (checked) or the flat task list */
const showSummary = ref(true);

function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const defaultSearchValues: TaskSearchValues = {
  project: null,
  member: null,
  team: null,
  overdue: null,
  dueDate: null,
  execution: null
};

/** form binding */
const searchValues = ref<TaskSearchValues>({ ...defaultSearchValues });
/** filters take effect on 搜索 click */
const appliedFilters = ref<TaskSearchValues>({ ...defaultSearchValues });
/** currently expanded member rows (controlled) */
const expandedKeys = ref<Array<string | number>>([]);

const overdueOptions = [
  { label: '是', value: '1' },
  { label: '否', value: '0' }
];

const executionOptions = [
  { label: '第一轮执行', value: '第一轮执行' },
  { label: '第二轮执行', value: '第二轮执行' },
  { label: '第三轮执行', value: '第三轮执行' }
];

const teamOptions = [
  { label: '研发一组', value: '研发一组' },
  { label: '研发二组', value: '研发二组' },
  { label: '测试组', value: '测试组' }
];

/** build the common filter params (null/'' dropped: qs serializes them as empty strings) */
function buildFilterParams() {
  const { project, member, team, overdue, execution } = toRaw(appliedFilters.value);

  return {
    projectId: project || undefined,
    member: member || undefined,
    team: team || undefined,
    isOverdue: overdue === null ? undefined : overdue === '1',
    execution: execution || undefined
  };
}

/** ---------- 汇总列表 ---------- */
const summaryData = ref<Api.ProjectManage.MemberTaskSummaryRecord[]>([]);
const summaryLoading = ref(false);

const summaryPagination = reactive({
  page: 1,
  pageSize: 10,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: [10, 20, 50],
  onChange: (page: number) => {
    summaryPagination.page = page;
    loadSummary();
  },
  onUpdatePageSize: (pageSize: number) => {
    summaryPagination.pageSize = pageSize;
    summaryPagination.page = 1;
    loadSummary();
  }
});

async function loadSummary() {
  summaryLoading.value = true;

  const { project, member, team, overdue, dueDate } = toRaw(appliedFilters.value);

  const { error, data } = await fetchGetMemberTaskSummary({
    current: summaryPagination.page,
    pageSize: summaryPagination.pageSize,
    projectId: project || undefined,
    member: member || undefined,
    team: team || undefined,
    isOverdue: overdue === null ? undefined : overdue === '1',
    // summary api expects the date as "YYYY-MM-DD"
    dueDate: dueDate ? formatDate(new Date(dueDate)) : undefined
  });

  summaryLoading.value = false;

  if (!error && data) {
    summaryData.value = data.records;
    summaryPagination.itemCount = data.total;
  }
}

/** ---------- 非汇总列表 ---------- */
const detailData = ref<Api.ProjectManage.MemberTaskDetailRecord[]>([]);
const detailLoading = ref(false);

const detailPagination = reactive({
  page: 1,
  pageSize: 10,
  itemCount: 0,
  onChange: (page: number) => {
    detailPagination.page = page;
    loadDetail();
  },
  onUpdatePageSize: (pageSize: number) => {
    detailPagination.pageSize = pageSize;
    detailPagination.page = 1;
    loadDetail();
  }
});

async function loadDetail() {
  detailLoading.value = true;

  const { error, data } = await fetchGetMemberTaskDetail({
    current: detailPagination.page,
    pageSize: detailPagination.pageSize,
    ...buildFilterParams()
  });

  detailLoading.value = false;

  if (!error && data) {
    detailData.value = data.records;
    detailPagination.itemCount = data.total;
  }
}

/** ---------- expand detail of the summary row ---------- */
/** detail of the currently expanded member (paginated) */
const expandedMember = computed(() => (expandedKeys.value[0] as string | undefined) ?? null);

const memberDetailRecords = ref<Api.ProjectManage.MemberTaskDetailRecord[]>([]);
const memberDetailLoading = ref(false);

const memberDetailPagination = reactive({
  page: 1,
  pageSize: 10,
  itemCount: 0,
  onChange: (page: number) => {
    memberDetailPagination.page = page;
    loadMemberDetailPage();
  },
  onUpdatePageSize: (pageSize: number) => {
    memberDetailPagination.pageSize = pageSize;
    memberDetailPagination.page = 1;
    loadMemberDetailPage();
  }
});

async function loadMemberDetailPage() {
  if (!expandedMember.value) {
    return;
  }

  memberDetailLoading.value = true;

  const { error, data } = await fetchGetMemberTaskDetail({
    current: memberDetailPagination.page,
    pageSize: memberDetailPagination.pageSize,
    member: expandedMember.value
  });

  memberDetailLoading.value = false;

  if (!error && data) {
    memberDetailRecords.value = data.records;
    memberDetailPagination.itemCount = data.total;
  }
}

/** load the expanded member's detail page when the expanded row changes */
watch(expandedMember, member => {
  if (member) {
    memberDetailPagination.page = 1;
    loadMemberDetailPage();
  }
});

/** expanded detail table columns */
const detailColumns: DataTableColumns<Api.ProjectManage.MemberTaskDetailRecord> = [
  { key: 'projectId', title: '项目编号', align: 'center', width: 140 },
  { key: 'id', title: 'ID', align: 'center', width: 70 },
  { key: 'taskType', title: '任务类型', align: 'center', width: 110 },
  { key: 'taskSource', title: '任务来源', align: 'center', width: 110 },
  { key: 'execution', title: '所属执行', align: 'center', width: 120 },
  {
    key: 'isOverdue',
    title: '是否超时',
    align: 'center',
    width: 100,
    render: row => (row.isOverdue ? <NTag type="error">是</NTag> : <NTag type="success">否</NTag>)
  },
  { key: 'createTime', title: '创建日期', align: 'center', width: 180 },
  { key: 'dueDate', title: '到期日期', align: 'center', width: 120 }
];

const columns = computed<DataTableColumns<Api.ProjectManage.MemberTaskSummaryRecord>>(() => [
  {
    type: 'expand',
    renderExpand: () => (
      <NDataTable
        columns={detailColumns}
        data={memberDetailRecords.value}
        loading={memberDetailLoading.value}
        remote
        size="small"
        pagination={memberDetailPagination}
        rowKey={(task: Api.ProjectManage.MemberTaskDetailRecord) => task.id}
      />
    )
  },
  {
    key: 'member',
    title: '成员',
    align: 'center',
    width: 120
  },
  {
    key: 'team',
    title: '团队',
    align: 'center',
    width: 100
  },
  {
    key: 'uncompleted',
    title: '未完成任务总数',
    align: 'center',
    width: 130
  },
  {
    key: 'overdue',
    title: '超时任务',
    align: 'center',
    width: 100,
    render: row => (row.overdue > 0 ? <NTag type="error">{row.overdue}</NTag> : row.overdue)
  },
  {
    key: 'dueToday',
    title: '今天到期任务',
    align: 'center',
    width: 120,
    render: row => (row.dueToday > 0 ? <NTag type="warning">{row.dueToday}</NTag> : row.dueToday)
  },
  {
    key: 'notDue',
    title: '未到期任务',
    align: 'center',
    width: 110,
    render: row => (row.notDue > 0 ? <NTag type="info">{row.notDue}</NTag> : row.notDue)
  },
  {
    key: 'completedYesterday',
    title: '上日完成任务数',
    align: 'center',
    width: 130,
    render: row =>
      row.completedYesterday > 0 ? <NTag type="success">{row.completedYesterday}</NTag> : row.completedYesterday
  },
  {
    key: 'completedLast7Days',
    title: '过去7天完成任务数',
    align: 'center',
    width: 150,
    render: row =>
      row.completedLast7Days > 0 ? <NTag type="info">{row.completedLast7Days}</NTag> : row.completedLast7Days
  }
]);

function handleExpandedKeys(keys: Array<string | number>) {
  // only allow one row expanded at a time (accordion)
  expandedKeys.value = keys.slice(-1);
}

function handleSummaryToggle(checked: boolean) {
  showSummary.value = checked;
  expandedKeys.value = [];
}

function handleSearch() {
  expandedKeys.value = [];
  appliedFilters.value = { ...toRaw(searchValues.value) };
  summaryPagination.page = 1;
  loadSummary();
  detailPagination.page = 1;
  loadDetail();
}

function handleReset() {
  expandedKeys.value = [];
  Object.assign(searchValues.value, { ...defaultSearchValues });
  handleSearch();
}

onMounted(() => {
  loadSummary();
  loadDetail();
});
</script>

<template>
  <ConfigProvider>
    <div class="h-full flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
      <NCard :bordered="false" size="small" class="card-wrapper">
        <NCollapse>
          <NCollapseItem title="搜索" name="task-monitor-search">
            <NForm :model="searchValues" label-placement="left" :label-width="80">
              <NGrid responsive="screen" item-responsive>
                <NFormItemGi label="项目编号" path="project" span="24 s:12 m:6" class="pr-24px">
                  <NInput v-model:value="searchValues.project" clearable placeholder="请输入项目编号" />
                </NFormItemGi>
                <NFormItemGi label="成员名字" path="member" span="24 s:12 m:6" class="pr-24px">
                  <NInput v-model:value="searchValues.member" clearable placeholder="请输入成员名字" />
                </NFormItemGi>
                <NFormItemGi label="团队" path="team" span="24 s:12 m:6" class="pr-24px">
                  <NSelect
                    v-model:value="searchValues.team"
                    clearable
                    :options="teamOptions"
                    placeholder="请选择团队"
                  />
                </NFormItemGi>
                <NFormItemGi label="是否超时" path="overdue" span="24 s:12 m:6" class="pr-24px">
                  <NSelect
                    v-model:value="searchValues.overdue"
                    clearable
                    :options="overdueOptions"
                    placeholder="请选择"
                  />
                </NFormItemGi>
                <NFormItemGi label="到期日期" path="dueDate" span="24 s:12 m:6" class="pr-24px">
                  <NDatePicker
                    v-model:value="searchValues.dueDate"
                    type="date"
                    clearable
                    class="w-full"
                    placeholder="请选择到期日期"
                  />
                </NFormItemGi>
                <NFormItemGi label="所属执行" path="execution" span="24 s:12 m:6" class="pr-24px">
                  <NSelect
                    v-model:value="searchValues.execution"
                    clearable
                    :options="executionOptions"
                    placeholder="请选择所属执行"
                  />
                </NFormItemGi>
                <NFormItemGi span="24" class="pr-24px">
                  <NSpace class="w-full" justify="end">
                    <NButton @click="handleReset">
                      <template #icon>
                        <icon-ic-round-refresh class="text-icon" />
                      </template>
                      重置
                    </NButton>
                    <NButton type="primary" ghost @click="handleSearch">
                      <template #icon>
                        <icon-ic-round-search class="text-icon" />
                      </template>
                      搜索
                    </NButton>
                  </NSpace>
                </NFormItemGi>
              </NGrid>
            </NForm>
          </NCollapseItem>
        </NCollapse>
      </NCard>
      <NCard :bordered="false" size="small" class="task-monitor-table-card card-wrapper flex-1 min-h-0">
        <div class="mb-8px flex-y-center flex-none">
          <NCheckbox :checked="showSummary" @update:checked="handleSummaryToggle">汇总</NCheckbox>
        </div>
        <NDataTable
          v-if="showSummary"
          :columns="columns"
          :data="summaryData"
          :loading="summaryLoading"
          remote
          flex-height
          class="flex-1"
          size="small"
          :pagination="summaryPagination"
          :row-key="(row: Api.ProjectManage.MemberTaskSummaryRecord) => row.member"
          :expanded-row-keys="expandedKeys"
          @update:expanded-row-keys="handleExpandedKeys"
        />
        <NDataTable
          v-else
          :columns="detailColumns"
          :data="detailData"
          :loading="detailLoading"
          remote
          flex-height
          class="flex-1"
          size="small"
          :pagination="detailPagination"
          :row-key="(row: Api.ProjectManage.MemberTaskDetailRecord) => row.id"
        />
      </NCard>
    </div>
  </ConfigProvider>
</template>

<style scoped>
/* the checkbox row and the table share the card vertically; the table fills the rest */
:deep(.task-monitor-table-card.n-card > .n-card-content) {
  display: flex;
  flex-direction: column;
}
</style>
