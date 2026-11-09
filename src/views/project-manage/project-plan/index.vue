<script setup lang="tsx">
import { computed, onMounted, onUnmounted, reactive, ref, shallowRef, watch } from 'vue';
import { gantt } from 'dhtmlx-gantt';
import type { GanttConfigOptions, ZoomLevel } from 'dhtmlx-gantt';
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css';

defineOptions({
  name: 'ProjectManageProjectPlan'
});

/** ---------- data model (pure frontend, persisted in localStorage) ---------- */
interface Phase {
  id: string;
  name: string;
}

interface Timeline {
  id: string;
  /** parent phase id */
  parentId: string;
  name: string;
  /** "YYYY-MM-DD" */
  start: string;
  /** "YYYY-MM-DD" (inclusive) */
  end: string;
  color: string;
}

interface PlanData {
  phases: Phase[];
  timelines: Timeline[];
}

const PLAN_STORAGE_KEY = 'project-plan-data';
const BAR_COLORS = ['#4098fc', '#18a058', '#f0a020', '#d03050', '#8a2be2', '#13c2c2'];

function todayStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function nextDay(dateStr: string, offsetDays = 1) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

let uidSeed = Date.now();
function nextId(prefix: string) {
  uidSeed += 1;
  return `${prefix}${uidSeed.toString(36)}`;
}

const phases = ref<Phase[]>([]);
const timelines = ref<Timeline[]>([]);

/** end date is inclusive: store end = start + duration - 1 for the gantt */
function ganttEndDate(endStr: string) {
  return nextDay(endStr, 1);
}

/** phase span = min(start) / max(end) of its timelines */
function phaseSpan(phaseId: string) {
  const rows = timelines.value.filter(t => t.parentId === phaseId);
  if (!rows.length) {
    return { start: todayStr(), end: ganttEndDate(todayStr(7)) };
  }
  const starts = rows.map(r => r.start).sort();
  const ends = rows.map(r => r.end).sort();
  return { start: starts[0], end: ganttEndDate(ends[ends.length - 1]) };
}

/** ---------- gantt instance ---------- */
const ganttRef = shallowRef<HTMLElement>();
const timeType = ref<'day' | 'week' | 'month' | 'quarter' | 'year'>('month');

function initGantt() {
  if (!ganttRef.value) return;

  const config: Partial<GanttConfigOptions> = {
    grid_width: 300,
    add_column: false,
    autofit: false,
    row_height: 44,
    bar_height: 26,
    auto_types: true,
    xml_date: '%Y-%m-%d',
    fit_tasks: true,
    details_on_dblclick: false,
    details_on_create: false,
    columns: [
      { name: 'text', label: '名称', tree: true, width: '*' },
      { name: 'start_date', label: '开始', align: 'center', width: 90 }
    ]
  };
  Object.assign(gantt.config, config);
  gantt.i18n.setLocale('cn');
  gantt.init(ganttRef.value);

  const zoomLevels: ZoomLevel[] = [
    { name: 'day', scale_height: 48, scales: [{ unit: 'day', step: 1, format: '%d %M' }] },
    {
      name: 'week',
      scale_height: 48,
      scales: [
        {
          unit: 'week',
          step: 1,
          format(date: Date) {
            const fmt = gantt.date.date_to_str('%m-%d');
            return `${fmt(gantt.date.add(date, -6, 'day'))} 至 ${fmt(date)}`;
          }
        },
        { unit: 'day', step: 1, format: '%d' }
      ]
    },
    {
      name: 'month',
      scale_height: 48,
      min_column_width: 18,
      scales: [
        { unit: 'month', format: '%Y-%m' },
        { unit: 'day', step: 1, format: '%d' }
      ]
    },
    {
      name: 'quarter',
      scale_height: 48,
      min_column_width: 110,
      scales: [
        {
          unit: 'quarter',
          step: 1,
          format(date: Date) {
            const yearStr = `${new Date(date).getFullYear()}年`;
            const fmt = gantt.date.date_to_str('%M');
            const endDate = gantt.date.add(gantt.date.add(date, 3, 'month'), -1, 'day');
            return `${yearStr + fmt(date)} - ${fmt(endDate)}`;
          }
        },
        { unit: 'week', step: 1, format: '%m-%d' }
      ]
    },
    {
      name: 'year',
      scale_height: 48,
      min_column_width: 150,
      scales: [
        { unit: 'year', format: '%Y年' },
        { unit: 'month', format: '%Y-%m' }
      ]
    }
  ];
  gantt.ext.zoom.init({ levels: zoomLevels });
  gantt.ext.zoom.setLevel(timeType.value);

  // sync drag/resize results back into the local state
  gantt.attachEvent('onAfterTaskDrag', (id: string | number) => {
    const task = gantt.getTask(id);
    if (task.$type !== 'task' || !task.parent) return true;
    const row = timelines.value.find(t => t.id === String(task.id));
    if (!row) return true;
    const fmt = gantt.date.date_to_str('%Y-%m-%d');
    // gantt end_date is exclusive; display end = last day
    row.start = fmt(task.start_date);
    row.end = fmt(gantt.date.add(task.end_date, -1, 'day'));
    return true;
  });
}

function renderGantt() {
  if (!ganttRef.value) return;
  const data = [
    ...phases.value.map(p => {
      const span = phaseSpan(p.id);
      return {
        id: p.id,
        text: p.name,
        type: gantt.config.types.project,
        start_date: span.start,
        end_date: span.end,
        open: true
      };
    }),
    ...timelines.value.map(t => ({
      id: t.id,
      text: t.name,
      parent: t.parentId,
      start_date: t.start,
      end_date: ganttEndDate(t.end),
      color: t.color
    }))
  ];
  gantt.clearAll();
  gantt.parse({ data });
}

watch([phases, timelines], () => renderGantt(), { deep: true });

watch(timeType, value => {
  gantt.ext.zoom.setLevel(value);
});

/** ---------- phase management ---------- */
const phaseName = ref('');

function handleAddPhase() {
  const name = phaseName.value.trim();
  if (!name) {
    window.$message?.warning('请输入阶段名称');
    return;
  }
  phases.value.push({ id: nextId('phase'), name });
  phaseName.value = '';
}

function handleRemovePhase(phaseId: string) {
  timelines.value = timelines.value.filter(t => t.parentId !== phaseId);
  phases.value = phases.value.filter(p => p.id !== phaseId);
}

/** ---------- timeline management ---------- */
const timelineForm = reactive({
  parentId: '',
  name: '',
  range: [todayStr(), todayStr(6)] as [string, string] | null,
  color: BAR_COLORS[0]
});

function handleAddTimeline() {
  const name = timelineForm.name.trim();
  if (!timelineForm.parentId) {
    window.$message?.warning('请选择所属阶段');
    return;
  }
  if (!name) {
    window.$message?.warning('请输入时间线名称');
    return;
  }
  if (!timelineForm.range || timelineForm.range.length !== 2) {
    window.$message?.warning('请选择开始和结束日期');
    return;
  }
  const [start, end] = timelineForm.range;
  if (end < start) {
    window.$message?.warning('结束日期不能早于开始日期');
    return;
  }
  timelines.value.push({
    id: nextId('tl'),
    parentId: timelineForm.parentId,
    name,
    start,
    end,
    color: timelineForm.color
  });
  timelineForm.name = '';
}

const timelineRows = computed(() => {
  const phaseNameById = new Map(phases.value.map(p => [p.id, p.name]));
  return [
    ...phases.value.map(p => ({
      id: p.id,
      kind: '阶段',
      name: p.name,
      phaseName: '-',
      start: phaseSpan(p.id).start,
      end: phaseSpan(p.id).end
    })),
    ...timelines.value.map(t => ({
      id: t.id,
      kind: '时间线',
      name: t.name,
      phaseName: phaseNameById.get(t.parentId) ?? '-',
      start: t.start,
      end: t.end
    }))
  ];
});

const entryColumns = [
  { title: '类型', key: 'kind', width: 80, align: 'center' as const },
  { title: '名称', key: 'name', align: 'left' as const },
  { title: '所属阶段', key: 'phaseName', width: 140, align: 'center' as const },
  { title: '开始', key: 'start', width: 110, align: 'center' as const },
  { title: '结束', key: 'end', width: 110, align: 'center' as const },
  {
    title: '操作',
    key: 'actions',
    width: 70,
    align: 'center' as const,
    render(row) {
      return (
        <NButton size="tiny" quaternary type="error" onClick={() => handleRemoveRow(row.id, row.kind)}>
          删除
        </NButton>
      );
    }
  }
];

function handleRemoveRow(id: string, kind: string) {
  if (kind === '阶段') {
    handleRemovePhase(id);
  } else {
    timelines.value = timelines.value.filter(t => t.id !== id);
  }
}

function handleClearAll() {
  window.$dialog?.warning({
    title: '清空确认',
    content: '确定清空所有阶段和时间线吗？',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => {
      phases.value = [];
      timelines.value = [];
    }
  });
}

/** ---------- persistence ---------- */
function saveToLocal() {
  try {
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify({ phases: phases.value, timelines: timelines.value }));
  } catch {
    // ignore storage failures - data stays in memory
  }
}

function loadFromLocal() {
  try {
    const raw = localStorage.getItem(PLAN_STORAGE_KEY);
    if (!raw) {
      return false;
    }
    const saved = JSON.parse(raw) as PlanData;
    phases.value = saved.phases ?? [];
    timelines.value = saved.timelines ?? [];
    return true;
  } catch {
    return false;
  }
}

watch([phases, timelines], () => saveToLocal(), { deep: true });

/** seed a sample plan on first visit */
function seedSample() {
  const p1 = nextId('phase');
  const p2 = nextId('phase');
  phases.value = [
    { id: p1, name: '示例阶段一' },
    { id: p2, name: '示例阶段二' }
  ];
  timelines.value = [
    { id: nextId('tl'), parentId: p1, name: '需求梳理', start: todayStr(-7), end: todayStr(-1), color: BAR_COLORS[0] },
    { id: nextId('tl'), parentId: p1, name: '方案设计', start: todayStr(), end: todayStr(6), color: BAR_COLORS[1] },
    { id: nextId('tl'), parentId: p2, name: '开发实施', start: todayStr(7), end: todayStr(20), color: BAR_COLORS[2] }
  ];
}

onMounted(() => {
  initGantt();
  if (!loadFromLocal()) {
    seedSample();
  }
  renderGantt();
});

onUnmounted(() => {
  gantt.clearAll();
});
</script>

<template>
  <div class="h-full flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NCard :bordered="false" size="small" class="card-wrapper">
      <NGrid responsive="screen" item-responsive :x-gap="16">
        <!-- phase section -->
        <NFormItemGi span="24 m:8" label="添加阶段" label-placement="left" :label-width="80">
          <div class="w-full flex items-center gap-8px">
            <NInput v-model:value="phaseName" placeholder="阶段名称" clearable @keyup.enter="handleAddPhase" />
            <NButton type="primary" ghost @click="handleAddPhase">添加</NButton>
          </div>
        </NFormItemGi>
        <!-- timeline section -->
        <NFormItemGi span="24 m:16" label="添加时间线" label-placement="left" :label-width="80">
          <div class="w-full flex flex-wrap items-center gap-8px">
            <NSelect
              v-model:value="timelineForm.parentId"
              placeholder="所属阶段"
              class="w-160px"
              :options="phases.map(p => ({ label: p.name, value: p.id }))"
            />
            <NInput v-model:value="timelineForm.name" placeholder="时间线名称" clearable class="w-160px" />
            <NDatePicker
              v-model:formatted-value="timelineForm.range"
              type="daterange"
              clearable
              value-format="yyyy-MM-dd"
              class="w-240px"
            />
            <NColorPicker v-model:value="timelineForm.color" :swatches="BAR_COLORS" class="w-120px" />
            <NButton type="primary" ghost @click="handleAddTimeline">添加</NButton>
          </div>
        </NFormItemGi>
      </NGrid>
      <NDataTable
        :columns="entryColumns"
        :data="timelineRows"
        :row-key="(row: (typeof timelineRows)[number]) => row.id"
        size="small"
        max-height="220"
        class="mt-8px"
      />
    </NCard>

    <NCard
      :bordered="false"
      size="small"
      content-class="overflow-y-hidden overflow-x-auto"
      class="flex-1 min-h-0 card-wrapper"
    >
      <template #header>
        <span>项目主计划甘特图</span>
      </template>
      <template #header-extra>
        <div class="flex-y-center gap-12px">
          <NButton size="small" quaternary type="error" @click="handleClearAll">清空全部</NButton>
          <NTabs
            :value="timeType"
            type="segment"
            animated
            size="small"
            class="w-320px"
            @update:value="t => (timeType = t as any)"
          >
            <NTab
              v-for="item in [
                { name: 'day', label: '天' },
                { name: 'week', label: '周' },
                { name: 'month', label: '月' },
                { name: 'quarter', label: '季' },
                { name: 'year', label: '年' }
              ]"
              :key="item.name"
              :name="item.name"
            >
              {{ item.label }}
            </NTab>
          </NTabs>
        </div>
      </template>
      <div ref="ganttRef" class="size-full min-w-800px" style="height: 560px"></div>
    </NCard>
  </div>
</template>
