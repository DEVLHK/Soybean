<script setup lang="tsx">
import { computed, nextTick, onMounted, reactive, ref, toRaw, watch } from 'vue';
import { NButton, NTag, NTooltip } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import {
  fetchGetMemberTaskDetail,
  fetchGetMemberTaskSummary,
  fetchGetMemberYesterdayTaskList,
  fetchGetTaskMonitorFilterOptions
} from '@/service/api';
import ConfigProvider from '@/views/pro-naive/ConfigProvider.vue';

defineOptions({
  name: 'ProjectManageTaskMonitor'
});

interface TaskSearchValues {
  /** cascader selection: "p-<project_id>" or "e-<execution_id>" values */
  projectExecutions: string[] | null;
  /** selected member accounts (multi-select) */
  members: string[] | null;
  /** selected team names (multi-select) */
  teams: string[] | null;
  /** "1" yes, "0" no */
  overdue: string | null;
  dueDate: number | null;
}

/** show the per-member aggregated summary table (checked) or the flat task list */
const showSummary = ref(true);

function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const defaultSearchValues: TaskSearchValues = {
  projectExecutions: [],
  members: [],
  teams: [],
  overdue: null,
  dueDate: null
};

/** form binding */
const searchValues = ref<TaskSearchValues>({ ...defaultSearchValues });
/** filters take effect on 搜索 click */
const appliedFilters = ref<TaskSearchValues>({ ...defaultSearchValues });

/** shared pagination size picker options (max 100 per page) */
const pageSizeOptions = [10, 20, 50, 100];

/** shared pagination prefix: total record count */
const paginationTotalPrefix = (info: { itemCount?: number }) => `共 ${info.itemCount ?? 0} 条`;

/** dropdown options loaded once from getFilterOptions on page init */
const teamOptions = ref<Api.ProjectManage.FilterOption[]>([]);
const projectExecutionOptions = ref<Api.ProjectManage.ProjectExecutionOption[]>([]);
const memberOptions = ref<Api.ProjectManage.FilterOption[]>([]);

async function loadFilterOptions() {
  const { error, data } = await fetchGetTaskMonitorFilterOptions();
  if (!error && data) {
    teamOptions.value = data.teams || [];
    projectExecutionOptions.value = data.projectExecutions || [];
    memberOptions.value = data.members || [];
  }
}

/** summary rows only carry realname (display); map it back to the account for querying */
function accountOfRow(row: Api.ProjectManage.MemberTaskSummaryRecord) {
  return memberOptions.value.find(o => o.label === row.member)?.value ?? row.member;
}

/** fuzzy filter select options by label and value, case-insensitive (member/team dropdowns) */
function filterFuzzyOption(pattern: string, option: Api.ProjectManage.FilterOption) {
  const keyword = pattern.trim().toLowerCase();
  if (!keyword) {
    return true;
  }
  return option.label.toLowerCase().includes(keyword) || option.value.toLowerCase().includes(keyword);
}

/** fuzzy filter: match project/execution label or id */
function filterProjectExecution(pattern: string, option: { label?: string; value?: string | number }) {
  const keyword = pattern.trim().toLowerCase();
  if (!keyword) {
    return true;
  }
  return (
    String(option.label ?? '')
      .toLowerCase()
      .includes(keyword) || String(option.value ?? '').includes(keyword)
  );
}

/** projects with a selection (itself or any child) float to the top of the dropdown */
const orderedProjectExecutionOptions = computed<Api.ProjectManage.ProjectExecutionOption[]>(() => {
  const options = projectExecutionOptions.value;
  const selected = new Set(searchValues.value.projectExecutions ?? []);
  if (!selected.size) {
    return options;
  }
  const isPicked = (o: Api.ProjectManage.ProjectExecutionOption) =>
    selected.has(String(o.value)) || o.children.some(c => selected.has(String(c.value)));
  return [...options].sort((a, b) => Number(isPicked(a) ? 0 : 1) - Number(isPicked(b) ? 0 : 1));
});

/** select all / deselect all level-1 project nodes (action bar).
 * naive-ui cascades: a parent value in the model implies ALL its children checked,
 * so a full deselect must drop parent AND children values together */
function selectAllProjects() {
  searchValues.value.projectExecutions = projectExecutionOptions.value.flatMap(o => [
    String(o.value),
    ...o.children.map(c => String(c.value))
  ]);
}

function deselectAllProjects() {
  const projSet = new Set(
    projectExecutionOptions.value.flatMap(o => [String(o.value), ...o.children.map(c => String(c.value))])
  );
  searchValues.value.projectExecutions = (searchValues.value.projectExecutions ?? []).filter(v => !projSet.has(v));
}

/** the project whose submenu is currently opened (label/arrow click); reset when menu closes */
const activeExecProjectId = ref<string | null>(null);

function setActiveExecProject(value: string | number) {
  activeExecProjectId.value = String(value);
}

function handleCascaderShow(show: boolean) {
  if (!show) {
    activeExecProjectId.value = null;
    return;
  }
  // publish the trigger width as a CSS var; the teleported menu reads it from the
  // stylesheet, so Vue's inline style patching can never wipe it
  nextTick(() => {
    const triggerEl = document.querySelector('.n-cascader .n-base-selection') as HTMLElement | null;
    const w = triggerEl?.offsetWidth ?? 0;
    if (w > 0) {
      document.documentElement.style.setProperty('--tm-cascader-menu-width', `${w}px`);
    }
  });
}

/** whether every level-1 project node is selected (drives 全选项目 vs 全不选项目) */
const allProjectsSelected = computed(() => {
  const opts = projectExecutionOptions.value;
  if (!opts.length) {
    return false;
  }
  const selected = new Set(searchValues.value.projectExecutions ?? []);
  return opts.every(o => selected.has(String(o.value)));
});

/** resolve which project the execution batch buttons target:
 * 1) the submenu last opened; 2) the unique project owning the current selection;
 * 3) fallback: global (all executions) */
function resolveActiveExecProject(): { proj: Api.ProjectManage.ProjectExecutionOption | null; global: boolean } {
  if (activeExecProjectId.value) {
    const proj = projectExecutionOptions.value.find(o => String(o.value) === activeExecProjectId.value);
    if (proj) {
      return { proj, global: false };
    }
  }
  const selected = new Set(searchValues.value.projectExecutions ?? []);
  if (selected.size) {
    const owner = projectExecutionOptions.value.find(
      o => selected.has(String(o.value)) || o.children.some(c => selected.has(String(c.value)))
    );
    if (owner) {
      const allBelong = [...selected].every(
        v => v === String(owner.value) || owner.children.some(c => String(c.value) === v)
      );
      if (allBelong) {
        return { proj: owner, global: false };
      }
    }
  }
  return { proj: null, global: true };
}

/** whether every execution under the target scope is selected (drives 全选执行 vs 全不选执行) */
const activeExecAllSelected = computed(() => {
  const { proj, global } = resolveActiveExecProject();
  const selected = new Set(searchValues.value.projectExecutions ?? []);
  if (global) {
    const all = projectExecutionOptions.value.flatMap(o => o.children.map(c => String(c.value)));
    return all.length > 0 && all.every(v => selected.has(v));
  }
  if (!proj || !proj.children.length) {
    return false;
  }
  return proj.children.every(c => selected.has(String(c.value)));
});

/** select all / deselect all executions of the resolved target scope.
 * MUST keep the model cascade-consistent: drop the parent value on deselect-all,
 * otherwise naive-ui re-expands the parent into all children (deselect seems ignored) */
function toggleActiveExecAll(selectAll: boolean) {
  const { proj, global } = resolveActiveExecProject();
  const current = new Set(searchValues.value.projectExecutions ?? []);

  if (global) {
    projectExecutionOptions.value.forEach(o => {
      o.children.forEach(c => (selectAll ? current.add(String(c.value)) : current.delete(String(c.value))));
      if (selectAll) {
        current.add(String(o.value));
      } else {
        current.delete(String(o.value));
      }
    });
    searchValues.value.projectExecutions = [...current];
    return;
  }

  if (!proj) {
    return;
  }
  const projValue = String(proj.value);
  const execValues = proj.children.map(c => String(c.value));
  if (selectAll) {
    execValues.forEach(v => current.add(v));
    current.add(projValue);
  } else {
    execValues.forEach(v => current.delete(v));
    current.delete(projValue);
  }
  searchValues.value.projectExecutions = [...current];
}

/** cascader label renderer: record the opened project on label click (naive-ui still
 * handles navigation because we don't stop propagation). block-level so the WHOLE
 * label area is clickable, not just the text; truncated names reveal via tooltip;
 * leaves render plain label */
function renderProjectExecutionLabel(option: { label?: string; value?: string | number; children?: unknown[] }) {
  const label = String(option.label ?? '');
  if (option.children?.length) {
    return (
      <NTooltip>
        {{
          trigger: () => (
            <div
              class="w-full"
              style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
              onClick={() => {
                setActiveExecProject(option.value!);
              }}
            >
              {label}
            </div>
          ),
          default: () => label
        }}
      </NTooltip>
    );
  }
  return label;
}

/** custom expand arrow for parent rows: record the opened project when navigating via the arrow */
function renderProjectExecutionSuffix(option: { value?: string | number; children?: unknown[] }) {
  if (!option.children?.length) {
    return null;
  }
  return (
    <span
      class="text-14px"
      style="padding: 0 6px; cursor: pointer;"
      onClick={() => {
        setActiveExecProject(option.value!);
      }}
    >
      ›
    </span>
  );
}

/** split cascader selection into projectIds (level-1 values) and executionIds (level-2 values);
 * zt_project.id is the PK so project/execution ids never collide.
 * fallback: if the options tree is not loaded, treat every selected value as projectIds
 * so a selection ALWAYS reaches the backend instead of being dropped */
function splitProjectExecution(values: string[] | null | undefined) {
  const options = projectExecutionOptions.value;
  const projectValues = new Set(options.map(o => String(o.value)));
  const projectIds: string[] = [];
  const executionIds: string[] = [];
  for (const v of values ?? []) {
    if (options.length === 0 || projectValues.has(v)) {
      projectIds.push(v);
    } else {
      executionIds.push(v);
    }
  }
  return { projectIds, executionIds };
}

/** overdue segmented control: '' = all (no filter), '1' = overdue, '0' = not overdue.
 * toggling applies ALL current form conditions immediately, so pending edits
 * (e.g. project/execution) are never lost when this filter re-queries */
function handleOverdueChange(value: string) {
  searchValues.value.overdue = value === '' ? null : value;
  handleSearch();
}

/** build the common filter params (null/'' dropped: qs serializes them as empty strings) */
function buildFilterParams() {
  const { projectExecutions, members, teams, overdue } = toRaw(appliedFilters.value);
  const { projectIds, executionIds } = splitProjectExecution(projectExecutions);

  return {
    projectIds: projectIds.length ? projectIds.join(',') : undefined,
    executionIds: executionIds.length ? executionIds.join(',') : undefined,
    members: members?.length ? members.join(',') : undefined,
    teams: teams?.length ? teams.join(',') : undefined,
    isOverdue: overdue === null ? undefined : overdue === '1'
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
  pageSizes: pageSizeOptions,
  prefix: paginationTotalPrefix,
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

/** server-side sorter states (remote tables: sort applied by backend) */
const summarySorter = ref<{ field: string | null; order: 'ascend' | 'descend' | null }>({
  field: null,
  order: null
});
const detailSorter = ref<{ field: string | null; order: 'ascend' | 'descend' | null }>({
  field: null,
  order: null
});

function handleSummarySorter(sorter: {
  columnKey?: string | number;
  field?: string;
  order: 'ascend' | 'descend' | false;
}) {
  summarySorter.value = {
    field: sorter.order ? String(sorter.columnKey ?? sorter.field ?? '') || null : null,
    order: sorter.order ? sorter.order : null
  };
  summaryPagination.page = 1;
  loadSummary();
}

function handleDetailSorter(sorter: {
  columnKey?: string | number;
  field?: string;
  order: 'ascend' | 'descend' | false;
}) {
  detailSorter.value = {
    field: sorter.order ? String(sorter.columnKey ?? sorter.field ?? '') || null : null,
    order: sorter.order ? sorter.order : null
  };
  detailPagination.page = 1;
  loadDetail();
}

async function loadSummary() {
  summaryLoading.value = true;

  const { projectExecutions, members, teams, overdue, dueDate } = toRaw(appliedFilters.value);
  const { projectIds, executionIds } = splitProjectExecution(projectExecutions);

  const { error, data } = await fetchGetMemberTaskSummary({
    current: summaryPagination.page,
    pageSize: summaryPagination.pageSize,
    projectIds: projectIds.length ? projectIds.join(',') : undefined,
    executionIds: executionIds.length ? executionIds.join(',') : undefined,
    members: members?.length ? members.join(',') : undefined,
    teams: teams?.length ? teams.join(',') : undefined,
    isOverdue: overdue === null ? undefined : overdue === '1',
    // summary api expects the date as "YYYY-MM-DD"
    dueDate: dueDate ? formatDate(new Date(dueDate)) : undefined,
    sortField: summarySorter.value.field || undefined,
    sortOrder: summarySorter.value.order ? (summarySorter.value.order === 'ascend' ? 'asc' : 'desc') : undefined
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
  showSizePicker: true,
  pageSizes: pageSizeOptions,
  prefix: paginationTotalPrefix,
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
    ...buildFilterParams(),
    sortField: detailSorter.value.field || undefined,
    sortOrder: detailSorter.value.order ? (detailSorter.value.order === 'ascend' ? 'asc' : 'desc') : undefined
  });

  detailLoading.value = false;

  if (!error && data) {
    detailData.value = data.records;
    detailPagination.itemCount = data.total;
  }
}

/** ---------- expand detail of the summary row ---------- */
/** summary row opened in the right drawer */
const activeSummaryRow = ref<Api.ProjectManage.MemberTaskSummaryRecord | null>(null);
const drawerVisible = ref(false);

/** detail of the currently opened member (paginated); query by account, not realname */
const expandedMember = computed(() => (activeSummaryRow.value ? accountOfRow(activeSummaryRow.value) : null));

const memberDetailRecords = ref<Api.ProjectManage.MemberTaskDetailRecord[]>([]);
const memberDetailLoading = ref(false);

const memberDetailPagination = reactive({
  page: 1,
  pageSize: 10,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: pageSizeOptions,
  prefix: paginationTotalPrefix,
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

/** due-range filter inside the member detail modal: all / overdue / dueToday / notDue */
type DueRangeFilter = 'all' | 'overdue' | 'dueToday' | 'notDue';

const memberDetailDueRange = ref<DueRangeFilter>('all');

function handleMemberDetailDueRange(value: DueRangeFilter) {
  memberDetailDueRange.value = value;
  memberDetailPagination.page = 1;
  loadMemberDetailPage();
}

async function loadMemberDetailPage() {
  if (!expandedMember.value) {
    return;
  }

  memberDetailLoading.value = true;

  const { projectExecutions, teams, overdue } = toRaw(appliedFilters.value);
  const { projectIds, executionIds } = splitProjectExecution(projectExecutions);

  const { error, data } = await fetchGetMemberTaskDetail({
    current: memberDetailPagination.page,
    pageSize: memberDetailPagination.pageSize,
    member: expandedMember.value,
    projectIds: projectIds.length ? projectIds.join(',') : undefined,
    executionIds: executionIds.length ? executionIds.join(',') : undefined,
    teams: teams?.length ? teams.join(',') : undefined,
    isOverdue: overdue === null ? undefined : overdue === '1',
    dueRange: memberDetailDueRange.value === 'all' ? undefined : memberDetailDueRange.value
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

/** detail table columns; the main flat table enables remote sorting, modal tables don't */
function buildDetailColumns(sortable: boolean): DataTableColumns<Api.ProjectManage.MemberTaskDetailRecord> {
  return [
    { key: 'projectId', title: '项目编号', align: 'center', width: 140, sorter: sortable },
    { key: 'member', title: '成员', align: 'center', width: 120, sorter: sortable },
    { key: 'team', title: '团队', align: 'center', width: 100, sorter: sortable },
    {
      key: 'id',
      title: 'ID',
      align: 'center',
      width: 70,
      sorter: sortable,
      render: row => {
        const url =
          row.taskType === 'BUG'
            ? `https://pms.hisunglobal.com/bug-view-${row.id}.html`
            : `https://pms.hisunglobal.com/task-view-${row.id}.html`;
        return (
          <a href={url} target="_blank" rel="noopener noreferrer" style="color: #1890ff; text-decoration: underline;">
            {row.id}
          </a>
        );
      }
    },
    { key: 'taskType', title: '任务类型', align: 'center', width: 110, sorter: sortable },
    { key: 'taskSource', title: '任务来源', align: 'center', width: 110, sorter: sortable },
    { key: 'execution', title: '所属执行', align: 'center', width: 120, sorter: sortable },
    {
      key: 'isOverdue',
      title: '是否逾期',
      align: 'center',
      width: 100,
      sorter: sortable,
      render: row => (row.isOverdue ? <NTag type="error">是</NTag> : <NTag type="success">否</NTag>)
    },
    { key: 'createTime', title: '创建日期', align: 'center', width: 180, sorter: sortable },
    { key: 'dueDate', title: '到期日期', align: 'center', width: 120, sorter: sortable }
  ];
}

/** modal detail tables (member detail modal / yesterday list modal) */
const detailColumns = buildDetailColumns(false);
/** main flat detail table with remote sorting */
const mainDetailColumns = buildDetailColumns(true);

const columns = computed<DataTableColumns<Api.ProjectManage.MemberTaskSummaryRecord>>(() => [
  {
    key: 'member',
    title: '成员',
    align: 'center',
    width: 120,
    sorter: true
  },
  {
    key: 'team',
    title: '团队',
    align: 'center',
    width: 100,
    sorter: true
  },
  {
    key: 'uncompleted',
    title: '未完成任务总数',
    align: 'center',
    width: 130,
    sorter: true
  },
  {
    key: 'overdue',
    title: '当前逾期任务数',
    align: 'center',
    width: 100,
    sorter: true,
    render: row => (row.overdue > 0 ? <NTag type="error">{row.overdue}</NTag> : row.overdue)
  },
  {
    key: 'dueToday',
    title: '今天到期任务',
    align: 'center',
    width: 120,
    sorter: true,
    render: row => (row.dueToday > 0 ? <NTag type="warning">{row.dueToday}</NTag> : row.dueToday)
  },
  {
    key: 'notDue',
    title: '未到期任务',
    align: 'center',
    width: 110,
    sorter: true,
    render: row => (row.notDue > 0 ? <NTag type="info">{row.notDue}</NTag> : row.notDue)
  },
  {
    key: 'dueYesterday',
    title: '上日逾期任务',
    align: 'center',
    width: 120,
    sorter: true,
    render: row =>
      row.dueYesterday > 0 ? (
        <a
          style="color: #1890ff; text-decoration: underline; cursor: pointer;"
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
            openYesterdayList(row, 'overdue');
          }}
        >
          {row.dueYesterday}
        </a>
      ) : (
        row.dueYesterday
      )
  },
  {
    key: 'completedYesterday',
    title: '上日完成任务数',
    align: 'center',
    width: 130,
    sorter: true,
    render: row =>
      row.completedYesterday > 0 ? (
        <a
          style="color: #1890ff; text-decoration: underline; cursor: pointer;"
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
            openYesterdayList(row, 'completed');
          }}
        >
          {row.completedYesterday}
        </a>
      ) : (
        row.completedYesterday
      )
  }
]);

/** click a summary row to open the detail modal */
function handleSummaryRowClick(row: Api.ProjectManage.MemberTaskSummaryRecord) {
  activeSummaryRow.value = row;
  memberDetailDueRange.value = 'all';
  drawerVisible.value = true;
}

/** ---------- yesterday overdue/completed task list modal ---------- */
type YesterdayListType = 'overdue' | 'completed';

const yesterdayListVisible = ref(false);
const yesterdayListType = ref<YesterdayListType>('overdue');
/** query key: account; label: realname for the title */
const yesterdayListMember = ref('');
const yesterdayListMemberLabel = ref('');
const yesterdayListRecords = ref<Api.ProjectManage.MemberTaskDetailRecord[]>([]);
const yesterdayListLoading = ref(false);

const yesterdayListPagination = reactive({
  page: 1,
  pageSize: 10,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: pageSizeOptions,
  prefix: paginationTotalPrefix,
  onChange: (page: number) => {
    yesterdayListPagination.page = page;
    loadYesterdayList();
  },
  onUpdatePageSize: (pageSize: number) => {
    yesterdayListPagination.pageSize = pageSize;
    yesterdayListPagination.page = 1;
    loadYesterdayList();
  }
});

async function loadYesterdayList() {
  yesterdayListLoading.value = true;

  const { error, data } = await fetchGetMemberYesterdayTaskList({
    current: yesterdayListPagination.page,
    pageSize: yesterdayListPagination.pageSize,
    member: yesterdayListMember.value,
    type: yesterdayListType.value
  });

  yesterdayListLoading.value = false;

  if (!error && data) {
    yesterdayListRecords.value = data.records;
    yesterdayListPagination.itemCount = data.total;
  }
}

function openYesterdayList(row: Api.ProjectManage.MemberTaskSummaryRecord, type: YesterdayListType) {
  yesterdayListType.value = type;
  yesterdayListMember.value = accountOfRow(row);
  yesterdayListMemberLabel.value = row.member;
  yesterdayListVisible.value = true;
  yesterdayListPagination.page = 1;
  loadYesterdayList();
}

/** summary row props: cursor + click to open drawer */
const summaryRowProps = (row: Api.ProjectManage.MemberTaskSummaryRecord) => ({
  style: 'cursor: pointer;',
  onClick: () => handleSummaryRowClick(row)
});

function handleSummaryToggle(checked: boolean) {
  showSummary.value = checked;
  if (checked) {
    // 汇总模式只保留成员和团队搜索条件
    searchValues.value.dueDate = null;
  }
  handleSearch();
}

function handleSearch() {
  appliedFilters.value = { ...toRaw(searchValues.value) };
  summaryPagination.page = 1;
  loadSummary();
  detailPagination.page = 1;
  loadDetail();
  // clear the modal detail cache so the next open re-fetches with the new filters
  activeSummaryRow.value = null;
  memberDetailRecords.value = [];
  memberDetailPagination.page = 1;
  memberDetailPagination.itemCount = 0;
}

/** reset only clears the form controls; results refresh on 搜索 click (no auto search) */
function handleReset() {
  Object.assign(searchValues.value, { ...defaultSearchValues });
}

onMounted(() => {
  loadFilterOptions();
  loadSummary();
  loadDetail();
});
</script>

<template>
  <ConfigProvider>
    <div class="h-full flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
      <NCard :bordered="false" size="small" class="card-wrapper">
        <NCollapse :default-expanded-names="['task-monitor-search']">
          <NCollapseItem title="搜索" name="task-monitor-search">
            <NForm :model="searchValues" label-placement="left" :label-width="80">
              <!-- row 1: project/execution cascader + (detail mode) due date -->
              <NGrid responsive="screen" item-responsive class="mb-4px">
                <NFormItemGi label="项目/执行" path="projectExecutions" span="24 s:24 m:12" class="pr-24px">
                  <NCascader
                    v-model:value="searchValues.projectExecutions"
                    multiple
                    check-strategy="all"
                    filterable
                    :filter="filterProjectExecution"
                    clearable
                    :max-tag-count="1"
                    :options="orderedProjectExecutionOptions"
                    :render-label="renderProjectExecutionLabel"
                    :render-suffix="renderProjectExecutionSuffix"
                    placeholder="请选择项目或其下执行"
                    @update:show="handleCascaderShow"
                  >
                    <template #action>
                      <NSpace size="small">
                        <NButton
                          v-if="!allProjectsSelected"
                          size="tiny"
                          quaternary
                          type="primary"
                          @click="selectAllProjects"
                        >
                          全选项目
                        </NButton>
                        <NButton v-else size="tiny" quaternary @click="deselectAllProjects">全不选项目</NButton>
                        <NButton
                          v-if="!activeExecAllSelected"
                          size="tiny"
                          quaternary
                          type="primary"
                          @click="toggleActiveExecAll(true)"
                        >
                          全选执行
                        </NButton>
                        <NButton v-else size="tiny" quaternary @click="toggleActiveExecAll(false)">全不选执行</NButton>
                      </NSpace>
                    </template>
                  </NCascader>
                </NFormItemGi>
                <NFormItemGi v-if="!showSummary" label="到期日期" path="dueDate" span="24 s:12 m:6" class="pr-24px">
                  <NDatePicker
                    v-model:value="searchValues.dueDate"
                    type="date"
                    clearable
                    class="w-full"
                    placeholder="请选择到期日期"
                  />
                </NFormItemGi>
              </NGrid>
              <!-- row 2: member / team / overdue -->
              <NGrid responsive="screen" item-responsive>
                <NFormItemGi label="团队" path="teams" span="24 s:12 m:6" class="pr-24px">
                  <NSelect
                    v-model:value="searchValues.teams"
                    multiple
                    filterable
                    :filter="filterFuzzyOption"
                    clearable
                    :max-tag-count="1"
                    :options="teamOptions"
                    placeholder="请选择团队"
                  />
                </NFormItemGi>
                <NFormItemGi label="成员名字" path="members" span="24 s:12 m:6" class="pr-24px">
                  <NSelect
                    v-model:value="searchValues.members"
                    multiple
                    filterable
                    :filter="filterFuzzyOption"
                    clearable
                    :max-tag-count="1"
                    :options="memberOptions"
                    placeholder="请选择成员"
                  />
                </NFormItemGi>
                <NFormItemGi label="是否逾期" path="overdue" span="24 s:12 m:6" class="pr-24px">
                  <NRadioGroup :value="searchValues.overdue ?? ''" size="small" @update:value="handleOverdueChange">
                    <NRadioButton value="">全部</NRadioButton>
                    <NRadioButton value="1">逾期</NRadioButton>
                    <NRadioButton value="0">未逾期</NRadioButton>
                  </NRadioGroup>
                </NFormItemGi>
                <NFormItemGi span="24 s:12 m:6" class="pr-24px">
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
        <div class="mb-8px flex-y-center justify-end flex-none">
          <NSwitch v-model:value="showSummary" class="view-switch" @update:value="handleSummaryToggle">
            <template #checked>汇总</template>
            <template #unchecked>明细</template>
          </NSwitch>
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
          :row-props="summaryRowProps"
          @update:sorter="handleSummarySorter"
        />
        <NDataTable
          v-else
          :columns="mainDetailColumns"
          :data="detailData"
          :loading="detailLoading"
          remote
          flex-height
          class="flex-1"
          size="small"
          :pagination="detailPagination"
          :row-key="(row: Api.ProjectManage.MemberTaskDetailRecord) => row.id"
          @update:sorter="handleDetailSorter"
        />
      </NCard>
    </div>
    <!-- member detail modal: summary pinned on top, detail table scrolls below -->
    <NModal
      v-model:show="drawerVisible"
      preset="card"
      :title="`成员任务明细 - ${activeSummaryRow?.member ?? ''}`"
      class="w-1350px"
    >
      <div v-if="activeSummaryRow" class="flex flex-col gap-12px">
        <NDescriptions bordered :column="3" size="small" class="flex-none" label-placement="left">
          <NDescriptionsItem label="成员">{{ activeSummaryRow.member }}</NDescriptionsItem>
          <NDescriptionsItem label="团队">{{ activeSummaryRow.team }}</NDescriptionsItem>
          <NDescriptionsItem label="未完成任务总数">{{ activeSummaryRow.uncompleted }}</NDescriptionsItem>
          <NDescriptionsItem label="当前逾期任务数">{{ activeSummaryRow.overdue }}</NDescriptionsItem>
          <NDescriptionsItem label="今天到期任务">{{ activeSummaryRow.dueToday }}</NDescriptionsItem>
          <NDescriptionsItem label="未到期任务">{{ activeSummaryRow.notDue }}</NDescriptionsItem>
          <NDescriptionsItem label="上日逾期任务">{{ activeSummaryRow.dueYesterday }}</NDescriptionsItem>
          <NDescriptionsItem label="上日完成任务数">{{ activeSummaryRow.completedYesterday }}</NDescriptionsItem>
        </NDescriptions>
        <NRadioGroup
          :value="memberDetailDueRange"
          size="small"
          class="flex-none"
          @update:value="handleMemberDetailDueRange"
        >
          <NRadioButton value="all">全部({{ activeSummaryRow.uncompleted }})</NRadioButton>
          <NRadioButton value="overdue">逾期({{ activeSummaryRow.overdue }})</NRadioButton>
          <NRadioButton value="dueToday">今天到期({{ activeSummaryRow.dueToday }})</NRadioButton>
          <NRadioButton value="notDue">未到期({{ activeSummaryRow.notDue }})</NRadioButton>
        </NRadioGroup>
        <NDataTable
          class="flex-1"
          :columns="detailColumns"
          :data="memberDetailRecords"
          :loading="memberDetailLoading"
          remote
          size="small"
          max-height="420"
          :pagination="memberDetailPagination"
          :row-key="(row: Api.ProjectManage.MemberTaskDetailRecord) => row.id"
        />
      </div>
    </NModal>
    <!-- yesterday overdue/completed task list modal -->
    <NModal
      v-model:show="yesterdayListVisible"
      preset="card"
      :title="`上日${yesterdayListType === 'overdue' ? '逾期' : '完成'}任务清单 - ${yesterdayListMemberLabel}`"
      class="w-1350px"
    >
      <NDataTable
        :columns="detailColumns"
        :data="yesterdayListRecords"
        :loading="yesterdayListLoading"
        remote
        size="small"
        max-height="420"
        :pagination="yesterdayListPagination"
        :row-key="(row: Api.ProjectManage.MemberTaskDetailRecord) => row.id"
      />
    </NModal>
  </ConfigProvider>
</template>

<style scoped>
/* the checkbox row and the table share the card vertically; the table fills the rest */
:deep(.task-monitor-table-card.n-card > .n-card-content) {
  display: flex;
  flex-direction: column;
}

/* 项目/执行 cascader: keep the selection on a single line, overflow hidden */
:deep(.n-cascader .n-base-selection-tags) {
  flex-wrap: nowrap;
  overflow: hidden;
}
</style>

<style>
/* the cascader dropdown is teleported to body, so this must NOT be scoped.
   make the submenu columns stretch to fill the panel width set from the trigger */
.n-cascader-submenu-wrapper > .n-cascader-submenu {
  flex: 1 1 auto;
}
/* dropdown menu width follows the trigger input via the --tm-cascader-menu-width var
   (set on open from the trigger's measured width); survives Vue style patching */
.n-cascader-menu {
  width: var(--tm-cascader-menu-width, auto);
  min-width: var(--tm-cascader-menu-width, 182px);
}
</style>
