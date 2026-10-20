<script setup lang="tsx">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { NButton, NInfiniteScroll, NTag } from 'naive-ui';
import hljs from 'highlight.js/lib/core';
import python from 'highlight.js/lib/languages/python';
import IconIcRoundFullscreen from '~icons/ic/round-fullscreen';
import IconIcRoundFullscreenExit from '~icons/ic/round-fullscreen-exit';
import { getSchedulerJobRunLogDownloadUrl, fetchSchedulerJobRunLogContent } from '@/service/api';
import { $t } from '@/locales';

// python grammar fits the scheduler scripts' output (logging lines + tracebacks)
hljs.registerLanguage('python', python);

defineOptions({
  name: 'RunLogContentModal'
});

interface Props {
  show: boolean;
  /** run log record id */
  id: number | null;
  scriptName: string;
  /** tail output from the list api, fallback when the log file no longer exists */
  output: string;
  status: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
}>();

const visible = computed({
  get: () => props.show,
  set: value => emit('update:show', value)
});

const initialLoading = ref(false);
const prependLoading = ref(false);
const appendLoading = ref(false);

const fileExists = ref(true);
const running = ref(false);
const totalLines = ref(0);
const startLine = ref(0);
const endLine = ref(0);
const displayLines = ref<string[]>([]);
const hasMoreBefore = ref(false);
const hasMoreAfter = ref(false);

const logWrapRef = ref<HTMLElement | null>(null);
/** whether the user is near the bottom: polling only auto-follows when true */
const nearBottom = ref(true);

/** scroll n-infinite-scroll's internal container to the bottom */
function scrollWrapToBottom() {
  const el = logWrapRef.value?.querySelector('.n-scrollbar-container');
  if (el) {
    el.scrollTop = el.scrollHeight;
    nearBottom.value = true;
  }
}

/** hljs result cache keyed by line content */
const highlightCache = new Map<string, string>();

function highlightLine(text: string) {
  let html = highlightCache.get(text);
  if (html === undefined) {
    html = hljs.highlight(text, { language: 'python' }).value;
    highlightCache.set(text, html);
  }
  return html;
}

/** display items: line number + highlighted html */
const displayItems = computed(() => {
  const width = String(totalLines.value || 1).length;
  return displayLines.value.map((text, index) => ({
    lineNo: String(startLine.value + index).padStart(width, ' '),
    html: highlightLine(text)
  }));
});

const modalTitle = computed(
  () => `${$t('page.scheduleManage.schedulerJob.runLog')} - ${props.scriptName} #${props.id}`
);

/** ---------- modal size / fullscreen ---------- */
const isFullscreen = ref(false);
/** after first mousedown the size freezes to the captured pixels (user may drag-resize) */
const userResized = ref(false);
const userSize = ref<{ width: string; height: string } | null>(null);

/** initial modal height computed from the log line count (19px per line + chrome) */
const initialModalHeight = computed(() => {
  const h = totalLines.value > 0 ? totalLines.value * 19 + 190 : 480;
  const max = window.innerHeight - 80;
  return Math.min(Math.max(h, 320), max);
});

const modalStyle = computed(() => {
  if (isFullscreen.value) {
    return { width: '100vw', height: '100vh', maxWidth: '100vw', borderRadius: '0' };
  }
  if (userResized.value && userSize.value) {
    return { ...userSize.value };
  }
  return {
    width: '1200px',
    height: `${initialModalHeight.value}px`,
    maxHeight: 'calc(100vh - 80px)'
  };
});

/** capture the current rendered size once, so polls/re-renders never resize the modal again */
function handleModalMouseDown() {
  if (userResized.value) {
    return;
  }
  const el = document.querySelector('.run-log-content-modal');
  if (el) {
    userSize.value = { width: `${el.clientWidth}px`, height: `${el.clientHeight}px` };
    userResized.value = true;
  }
}

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
/** bumps on every modal open; stale loadInitial results are discarded */
let loadGeneration = 0;

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function startPolling() {
  stopPolling();
  if (!props.show) {
    return;
  }
  pollTimer = setInterval(() => {
    // poll even when hasMoreAfter is false (the file may have grown on the backend),
    // but never before the initial load has set endLine (guards against after=0 requests)
    if (appendLoading.value || !fileExists.value || initialLoading.value || endLine.value === 0) {
      return;
    }
    loadAfter({ follow: nearBottom.value, silent: true });
  }, 3000);
}

async function loadInitial() {
  const gen = ++loadGeneration;
  initialLoading.value = true;

  const params = { id: props.id!, limit: 200 };
  const { error, data } = await fetchSchedulerJobRunLogContent(params);

  initialLoading.value = false;
  // superseded by a newer open / modal closed while loading: discard stale result
  if (gen !== loadGeneration || !props.show) {
    return;
  }

  if (error || !data) {
    fileExists.value = false;
    return;
  }

  fileExists.value = data.fileExists;
  if (!data.fileExists) {
    return;
  }

  running.value = data.running;
  totalLines.value = data.totalLines;
  startLine.value = data.startLine;
  endLine.value = data.endLine;
  displayLines.value = data.lines;
  hasMoreBefore.value = data.hasMoreBefore;
  hasMoreAfter.value = data.hasMoreAfter;

  // default view is the tail of the file
  await nextTick();
  scrollWrapToBottom();

  // if the loaded lines cannot fill the viewport, keep loading earlier lines
  await fillViewport();

  startPolling();
}

const LOG_LINE_HEIGHT = 17.5; // fontSize 14 * lineHeight 1.25

/** keep prepending earlier lines until the viewport is filled or there is nothing left */
async function fillViewport() {
  let guard = 0;

  while (hasMoreBefore.value && guard < 30) {
    guard += 1;

    const viewport = logWrapRef.value?.clientHeight ?? 560;
    const contentHeight = displayLines.value.length * LOG_LINE_HEIGHT;

    if (contentHeight >= viewport - 24) {
      break;
    }

    await loadBefore({ silent: true });
  }
}

/** n-infinite-scroll bottom load: newer lines while polling/available */
async function handleInfiniteLoad() {
  if (initialLoading.value) {
    return;
  }
  if (hasMoreAfter.value) {
    await loadAfter({ follow: true });
  }
}

/** scroll reached top / auto fill: prepend earlier lines */
async function loadBefore(options?: { silent?: boolean; preserve?: boolean }) {
  if (!hasMoreBefore.value || prependLoading.value || initialLoading.value) {
    return;
  }

  prependLoading.value = true;

  const params = { id: props.id!, limit: 200, before: startLine.value - 1 };
  const { error, data } = await fetchSchedulerJobRunLogContent(params);

  prependLoading.value = false;

  if (!error && data?.fileExists && data.lines.length > 0) {
    // keep the viewport stable when prepending from a scroll-up
    const wrap = logWrapRef.value;
    const prevScrollHeight = wrap?.scrollHeight ?? 0;
    const prevScrollTop = wrap?.scrollTop ?? 0;

    displayLines.value = [...data.lines, ...displayLines.value];
    startLine.value = data.startLine;
    hasMoreBefore.value = data.hasMoreBefore;

    await nextTick();
    if (options?.preserve && wrap) {
      wrap.scrollTop = prevScrollTop + (wrap.scrollHeight - prevScrollHeight);
    }
  }

  if (!options?.silent && hasMoreBefore.value) {
    // after manual load, give the hint that more earlier lines can be loaded by scrolling up
    fillViewport();
  }
}

/** scroll reached bottom / polling: append newer lines */
async function loadAfter(options?: { follow?: boolean; silent?: boolean }) {
  if (appendLoading.value) {
    return;
  }
  // scroll-triggered loads are skipped when nothing more is known to exist;
  // silent (poll) loads always hit the api to discover backend growth
  if (!options?.silent && !hasMoreAfter.value) {
    return;
  }

  appendLoading.value = true;

  const params = {
    id: props.id!,
    // poll uses the backend max (1000) to catch up with a fast-growing file in fewer requests
    limit: options?.silent ? 1000 : 200,
    after: endLine.value
  };
  const { error, data } = await fetchSchedulerJobRunLogContent(params);

  appendLoading.value = false;

  if (!error && data?.fileExists) {
    // backend returns startLine/endLine = 0 when there is no new content;
    // only commit positions when new lines actually came back
    if (data.lines.length > 0) {
      displayLines.value = [...displayLines.value, ...data.lines];
      endLine.value = data.endLine;
      totalLines.value = data.totalLines;
    }
    running.value = data.running;
    hasMoreAfter.value = data.hasMoreAfter;

    if (options?.follow && nearBottom.value) {
      await nextTick();
      scrollWrapToBottom();
    }
  }

  startPolling();
}

function handleDownload() {
  if (props.id === null) {
    return;
  }
  window.open(getSchedulerJobRunLogDownloadUrl(props.id));
}

watch(
  () => props.show,
  show => {
    if (show) {
      initialLoading.value = true;
      fileExists.value = true;
      running.value = false;
      displayLines.value = [];
      startLine.value = 0;
      endLine.value = 0;
      hasMoreBefore.value = false;
      hasMoreAfter.value = false;
      stopPolling();
      loadInitial();
    } else {
      stopPolling();
    }
  },
  { immediate: true }
);

onUnmounted(stopPolling);
</script>

<template>
  <NModal
    v-model:show="visible"
    :title="modalTitle"
    preset="card"
    class="run-log-content-modal w-1200px"
    :style="modalStyle"
    :mask-closable="false"
    @mousedown="handleModalMouseDown"
  >
    <div class="flex flex-col gap-12px h-full min-h-0">
      <div class="flex-y-center justify-end gap-12px flex-none">
        <NButton size="small" type="primary" ghost @click="toggleFullscreen">
          <template #icon>
            <component :is="isFullscreen ? IconIcRoundFullscreenExit : IconIcRoundFullscreen" />
          </template>
        </NButton>
        <NButton size="small" type="primary" ghost @click="handleDownload">
          {{ $t('page.scheduleManage.schedulerJob.download') }}
        </NButton>
      </div>

      <!-- old record without log file: fall back to the list output summary -->
      <template v-if="!fileExists">
        <NAlert type="info" :show-icon="true" class="flex-none">
          {{ $t('page.scheduleManage.schedulerJob.noLogFileTip') }}
        </NAlert>
        <div class="log-fallback flex-1 min-h-0 rd-4px p-12px">{{ props.output || '-' }}</div>
      </template>

      <template v-else>
        <div class="flex-y-center gap-16px text-13px text-gray-500 flex-none">
          <span>{{ $t('page.scheduleManage.schedulerJob.totalLines') }}: {{ totalLines }}</span>
          <span v-if="hasMoreBefore">{{ $t('page.scheduleManage.schedulerJob.scrollUpTip') }}</span>
          <NButton v-if="hasMoreBefore" size="tiny" quaternary type="primary" @click="loadBefore()">
            {{ $t('page.scheduleManage.schedulerJob.loadEarlier') }}
          </NButton>
          <NTag size="small" type="success">
            {{ $t('page.scheduleManage.schedulerJob.pollingTip') }}
          </NTag>
        </div>
        <div ref="logWrapRef" class="flex-1 min-h-0 flex rd-4px">
          <NInfiniteScroll
            class="flex-1"
            :distance="80"
            :scrollbar-props="{ xScrollable: true }"
            @load="handleInfiniteLoad"
          >
            <div class="log-nowrap">
              <div v-for="(item, index) in displayItems" :key="`${startLine + index}`" class="log-line">
                <span class="log-line-no">{{ item.lineNo }}</span>
                <span class="log-line-text" v-html="item.html"></span>
              </div>
              <div v-if="appendLoading || initialLoading" class="py-8px text-center text-13px text-gray-400">
                {{ $t('page.scheduleManage.schedulerJob.loadingMore') }}
              </div>
            </div>
          </NInfiniteScroll>
        </div>
        <div v-if="appendLoading" class="text-center text-13px text-gray-400 flex-none">
          {{ $t('page.scheduleManage.schedulerJob.loadingMore') }}
        </div>
      </template>
    </div>
  </NModal>
</template>

<style scoped>
.log-fallback {
  background-color: var(--n-color, rgba(0, 0, 0, 0.04));
  font-family: monospace;
  font-size: 13px;
  line-height: 1.5;
  overflow: auto;
}

/* outer wrapper provides the visible horizontal scrollbar */
.log-scroll-wrap {
  overflow: auto;
}

.log-nowrap {
  min-height: 100%;
  min-width: max-content;
}

.log-line {
  white-space: pre;
  font-family: monospace;
  font-size: 13px;
  line-height: 1.5;
}

.log-line-no {
  display: inline-block;
  min-width: 56px;
  padding-right: 12px;
  color: #8a919f;
  text-align: right;
  user-select: none;
}
</style>

<!-- not scoped: the modal card is rendered by n-modal (teleported), our scoped data-v never reaches it -->
<!-- n-card content class is n-card-content (single dash) -->
<style>
.run-log-content-modal.n-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  resize: both;
}

.run-log-content-modal.n-card > .n-card-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>

<!-- not scoped: hljs token colors, light palette + dark palette via the app's html.dark -->
<style>
.run-log-content-modal .hljs-string {
  color: #50a14f;
}
.run-log-content-modal .hljs-number {
  color: #986801;
}
.run-log-content-modal .hljs-comment {
  color: #a0a1a7;
  font-style: italic;
}
.run-log-content-modal .hljs-keyword,
.run-log-content-modal .hljs-selector-tag,
.run-log-content-modal .hljs-literal {
  color: #a626a4;
}
.run-log-content-modal .hljs-title,
.run-log-content-modal .hljs-name {
  color: #4078f2;
}
.run-log-content-modal .hljs-built_in,
.run-log-content-modal .hljs-attr {
  color: #c18401;
}
.dark .run-log-content-modal .hljs-string {
  color: #98c379;
}
.dark .run-log-content-modal .hljs-number {
  color: #d19a66;
}
.dark .run-log-content-modal .hljs-comment {
  color: #7f848e;
}
.dark .run-log-content-modal .hljs-keyword,
.dark .run-log-content-modal .hljs-selector-tag,
.dark .run-log-content-modal .hljs-literal {
  color: #c678dd;
}
.dark .run-log-content-modal .hljs-title,
.dark .run-log-content-modal .hljs-name {
  color: #61afef;
}
.dark .run-log-content-modal .hljs-built_in,
.dark .run-log-content-modal .hljs-attr {
  color: #e5c07b;
}
</style>
