<script setup lang="ts">
import { Check, Plus, X } from "lucide-vue-next";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  DAY_MINUTES,
  SLOT_HEIGHT,
  SLOT_MINUTES,
  TOUCH_HOLD_MS,
  TOUCH_SLOP,
  blockHeight,
  blockTop,
  boxOf,
  changedLanes as lanesToSave,
  dragFraction,
  dragPosition,
  edgeScrollSpeed,
  formatDuration,
  formatTime,
  formatTimeRange,
  grabOffset,
  gutterLabel,
  hasResizeGrip,
  HOUR_OPTIONS,
  isShortBlock,
  minutesToPx,
  nudgedStart,
  planDrag,
  pxToMinutes,
  slotAt,
  titleLines,
  type ScheduledTask,
} from "@klndr/core";
import { paletteOf } from "~/lib/colors";
import TimeBlock from "~/components/day-planner/TimeBlock.vue";

const props = defineProps<{
  day: string;
  tasks: ScheduledTask[];
  nowMinute: number | null;
  resizing: string | null;
  preview: { start: number; duration: number; color: string; label: string; emoji: string } | null;
  layout: Map<string, { left: number; width: number }>;
  gridHeight: number;
}>();

const emit = defineEmits<{
  (e: "task-click", task: ScheduledTask): void;
  (e: "grid-click", event: MouseEvent): void;
  (e: "toggle-complete", task: ScheduledTask): void;
  (e: "delete-task", task: ScheduledTask): void;
  (e: "start-resize", task: ScheduledTask, event: PointerEvent): void;
  (e: "drag-over", event: DragEvent): void;
  (e: "drag-leave", event: DragEvent): void;
  (e: "drop", event: DragEvent): void;
  /** `lanes` is set when the move also changed who sits where beside it. */
  (e: "move-task", task: ScheduledTask, startMinutes: number, lanes?: Map<string, number>): void;
  (e: "refresh"): void;
}>();

const gridRef = ref<HTMLDivElement | null>(null);
const hoverMinutes = ref<number | null>(null);
const HOVER_DURATION = 30; // matches the default duration of a block created by clicking the grid
// Cut short when the hovered slot is too close to midnight.
const hoverDuration = computed(() => Math.min(HOVER_DURATION, DAY_MINUTES - (hoverMinutes.value ?? 0)));

let lastPointer: { x: number; y: number } | null = null;

const updateHover = () => {
  if (!lastPointer || !gridRef.value || props.resizing || props.preview || drag.value) {
    hoverMinutes.value = null;
    return;
  }
  const rect = gridRef.value.getBoundingClientRect();
  const { x, y } = lastPointer;
  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
    hoverMinutes.value = null;
    return;
  }
  // Existing blocks handle their own clicks, so nothing new would be created there.
  const target = document.elementFromPoint(x, y);
  if (target?.closest("[data-task-block]")) {
    hoverMinutes.value = null;
    return;
  }
  // Floors to the quarter hour under the cursor, same as the click-to-create handler, so the block lands where it's shown.
  const minutes = slotAt(y - rect.top);
  // No ghost over a row that already holds activities.
  const end = minutes + Math.min(HOVER_DURATION, DAY_MINUTES - minutes);
  const occupied = props.tasks.some((task) => task.startMinutes < end && task.startMinutes + task.durationMinutes > minutes);
  hoverMinutes.value = occupied ? null : minutes;
};

const handlePointerMove = (event: PointerEvent) => {
  if (event.pointerType !== "mouse") return; // no hover on touch
  lastPointer = { x: event.clientX, y: event.clientY };
  updateHover();
};

const clearHover = () => {
  lastPointer = null;
  hoverMinutes.value = null;
};

// Scrolling moves the grid under a stationary cursor without firing pointer events.
onMounted(() => window.addEventListener("scroll", updateHover, { capture: true, passive: true }));
onBeforeUnmount(() => window.removeEventListener("scroll", updateHover, { capture: true }));
watch(() => [props.preview, props.resizing], updateHover);

// ---- Moving blocks (pointer based, so it works with mouse, touch and pen) ----
// Touch must press and hold (TOUCH_HOLD_MS), otherwise the gesture scrolls the timeline.
const MOUSE_SLOP = 4;

type DragState = {
  id: string;
  /** Free-following position of the block's top edge, in minutes. */
  rawStart: number;
  /** Where the block will land once released, after snapping. */
  snappedStart: number;
  /** How far across the timeline the pointer is (0 to 1): which column it is held over. */
  fraction: number;
};

const drag = ref<DragState | null>(null);
let pending: {
  task: ScheduledTask;
  pointerType: string;
  pointerId: number;
  target: HTMLElement;
  startX: number;
  startY: number;
  timer: number | null;
} | null = null;
let active: { task: ScheduledTask; grabMinutes: number } | null = null;
/** The pointer that pressed the block; any other finger or pen is ignored until it lets go. */
let trackedPointer: number | null = null;
let lastX = 0;
let lastY = 0;
let scroller: HTMLElement | null = null;
let rafId: number | null = null;
let suppressClick = false;

const findScroller = (el: HTMLElement | null): HTMLElement | null => {
  for (let node = el?.parentElement ?? null; node; node = node.parentElement) {
    const overflowY = getComputedStyle(node).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return node;
  }
  return null;
};

const pointerMinutes = () => {
  const rect = gridRef.value!.getBoundingClientRect();
  return pxToMinutes(lastY - rect.top);
};

const updateDrag = () => {
  if (!active) return;
  const { task, grabMinutes } = active;
  const { rawStart, snappedStart } = dragPosition(pointerMinutes(), grabMinutes, task.durationMinutes);
  const rect = gridRef.value!.getBoundingClientRect();
  const fraction = dragFraction(lastX, rect.left, rect.width);
  drag.value = { id: task.id, rawStart, snappedStart, fraction };
};

const edgeScrollTick = () => {
  rafId = null;
  if (!active) return;
  if (scroller) {
    const rect = scroller.getBoundingClientRect();
    const speed = edgeScrollSpeed(lastY, rect.top, rect.bottom);
    if (speed !== 0) {
      scroller.scrollTop += speed;
      updateDrag();
    }
  }
  rafId = requestAnimationFrame(edgeScrollTick);
};

const beginDrag = () => {
  if (!pending || !gridRef.value) return;
  const { task, pointerType, pointerId, target } = pending;
  if (pending.timer) window.clearTimeout(pending.timer);
  pending = null;
  // Keeps moves and the release coming to us even outside the window or over other elements.
  try {
    target.setPointerCapture(pointerId);
  } catch {
    // The pointer is already gone; the window listeners still end the drag.
  }
  scroller = findScroller(gridRef.value);
  active = { task, grabMinutes: grabOffset(pointerMinutes(), task.startMinutes) };
  document.body.style.userSelect = "none";
  document.body.style.webkitUserSelect = "none";
  if (pointerType === "touch") navigator.vibrate?.(8);
  hoverMinutes.value = null;
  updateDrag();
  rafId = requestAnimationFrame(edgeScrollTick);
};

const endTracking = () => {
  if (pending?.timer) window.clearTimeout(pending.timer);
  pending = null;
  active = null;
  trackedPointer = null;
  drag.value = null;
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = null;
  document.body.style.userSelect = "";
  document.body.style.webkitUserSelect = "";
  window.removeEventListener("pointermove", onWindowPointerMove);
  window.removeEventListener("pointerup", onWindowPointerUp);
  window.removeEventListener("pointercancel", onWindowPointerCancel);
  window.removeEventListener("blur", endTracking);
};

const onWindowPointerMove = (event: PointerEvent) => {
  if (event.pointerId !== trackedPointer) return;
  lastX = event.clientX;
  lastY = event.clientY;
  if (pending) {
    const moved = Math.hypot(event.clientX - pending.startX, event.clientY - pending.startY);
    if (pending.pointerType === "mouse") {
      if (moved > MOUSE_SLOP) beginDrag();
    } else if (moved > TOUCH_SLOP) {
      endTracking(); // the user is scrolling, not dragging
    }
    return;
  }
  updateDrag();
};

const onWindowPointerUp = (event: PointerEvent) => {
  if (event.pointerId !== trackedPointer) return;
  if (active && drag.value) {
    suppressClick = true;
    window.setTimeout(() => { suppressClick = false; }, 80);
    const { task } = active;
    const start = drag.value.snappedStart;
    const lanes = changedLanes();
    if (start !== task.startMinutes || lanes) emit("move-task", task, start, lanes);
  }
  endTracking();
};

const onWindowPointerCancel = (event: PointerEvent) => {
  if (event.pointerId !== trackedPointer) return;
  endTracking();
};

const onBlockPointerDown = (task: ScheduledTask, event: PointerEvent) => {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  if (props.resizing || pending || active) return;
  if ((event.target as HTMLElement).closest("button, [data-resize-handle]")) return;
  lastX = event.clientX;
  lastY = event.clientY;
  trackedPointer = event.pointerId;
  pending = {
    task,
    pointerType: event.pointerType,
    pointerId: event.pointerId,
    target: event.currentTarget as HTMLElement,
    startX: event.clientX,
    startY: event.clientY,
    timer: event.pointerType === "mouse" ? null : window.setTimeout(beginDrag, TOUCH_HOLD_MS),
  };
  window.addEventListener("pointermove", onWindowPointerMove);
  window.addEventListener("pointerup", onWindowPointerUp);
  window.addEventListener("pointercancel", onWindowPointerCancel);
  // Switching away mid-drag never sends the release; drop the drag rather than leave it stuck.
  window.addEventListener("blur", endTracking);
};

// Once a block is picked up, stop the browser from scrolling the page under the finger.
const blockTouchScroll = (event: TouchEvent) => {
  if (active && event.cancelable) event.preventDefault();
};

const onBlockKeydown = (task: ScheduledTask, event: KeyboardEvent) => {
  if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
  event.preventDefault();
  const direction = event.key === "ArrowUp" ? -1 : 1;
  const next = nudgedStart(task.startMinutes, task.durationMinutes, direction);
  if (next !== task.startMinutes) emit("move-task", task, next);
};

// Where and how tall a block is drawn, and what it shows, is core's (blockTop, blockHeight, isShortBlock,
// titleLines, hasResizeGrip), the same on every screen.

const durationOf = (id: string) => props.tasks.find((item) => item.id === id)?.durationMinutes ?? SLOT_MINUTES;

// While a block is held, the others make room: it sits in whichever column the pointer is over,
// among the blocks it would share time with where it would land.
const dragPlan = computed(() => {
  if (!drag.value) return null;
  const { id, snappedStart, fraction } = drag.value;
  return planDrag(props.tasks, id, snappedStart, fraction);
});

const layoutBox = (id: string) => {
  const placement = dragPlan.value?.placements.get(id);
  return placement ? boxOf(placement) : props.layout.get(id);
};

// The lanes to save when a block is dropped, or nothing if no one ended up in a different column.
const changedLanes = () => lanesToSave(props.tasks, dragPlan.value);

const dragGhostStyle = computed(() => {
  if (!drag.value) return undefined;
  const { id, snappedStart } = drag.value;
  const lane = layoutBox(id);
  return {
    top: `${blockTop(snappedStart)}px`,
    height: `${blockHeight(durationOf(id))}px`,
    left: `${(lane?.left ?? 0) * 100 + 1}%`,
    width: `${(lane?.width ?? 1) * 100 - 2}%`,
  };
});

// A block being moved shows the time it will land at.
const shownStart = (task: ScheduledTask) => (drag.value?.id === task.id ? drag.value.snappedStart : task.startMinutes);

// Start and end marked in the gutter and across the grid: where a moved block or dragged-in
// activity will land, or the block being resized.
const guideMinutes = computed(() => {
  const span = (start: number, duration: number) => [start, Math.min(start + duration, DAY_MINUTES)];
  if (drag.value) return span(drag.value.snappedStart, durationOf(drag.value.id));
  if (props.preview) return span(props.preview.start, props.preview.duration);
  const task = props.tasks.find((item) => item.id === props.resizing);
  return task ? span(task.startMinutes, task.durationMinutes) : null;
});

const onBlockClick = (task: ScheduledTask) => {
  if (suppressClick) return;
  emit("task-click", task);
};

const onGridClick = (event: MouseEvent) => {
  clearHover();
  if (suppressClick) return;
  emit("grid-click", event);
};

const dragOffsetPx = (task: ScheduledTask) =>
  drag.value?.id === task.id
    ? minutesToPx(drag.value.rawStart - task.startMinutes)
    : 0;

onMounted(() => gridRef.value?.addEventListener("touchmove", blockTouchScroll, { passive: false }));
onBeforeUnmount(() => {
  gridRef.value?.removeEventListener("touchmove", blockTouchScroll);
  endTracking();
});

const { colorOf } = useCategories();
// A block shows the color of its category.
const toneOf = (task: { category: string; color: string }) => paletteOf(colorOf(task));

</script>

<template>
  <div class="mx-auto flex max-w-4xl pt-4 pb-8 sm:pt-6 sm:pb-12">
    <!-- Hour gutter -->
    <div class="relative w-14 sm:w-16 shrink-0 select-none border-r border-border bg-background pr-1.5 sm:pr-2.5">
      <div
        v-for="minute in HOUR_OPTIONS"
        :key="minute"
        :style="{ height: `${SLOT_HEIGHT}px` }"
        class="relative"
      >
        <span
          v-if="gutterLabel(minute)"
          class="absolute -top-2.5 right-1.5 sm:right-2 text-[11px] sm:text-xs font-mono font-medium text-muted-foreground tracking-tight"
        >
          {{ gutterLabel(minute) }}
        </span>
      </div>

      <!-- Start and end times of the moving or resizing block -->
      <template v-if="guideMinutes">
        <div
          v-for="minute in guideMinutes"
          :key="`edge-${minute}`"
          class="pointer-events-none absolute right-0.5 sm:right-1 z-20 -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-muted px-1 sm:px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none text-foreground/70"
          :style="{ top: `${minutesToPx(minute)}px` }"
        >
          {{ formatTime(minute) }}
        </div>
      </template>

      <!-- Live time pill in gutter -->
      <div
        v-if="nowMinute !== null"
        class="pointer-events-none absolute right-0.5 sm:right-1 z-30 -translate-y-1/2 whitespace-nowrap rounded-md bg-rose-500 px-1 sm:px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none text-white shadow-xs"
        :style="{ top: `${minutesToPx(nowMinute)}px` }"
      >
        {{ formatTime(nowMinute) }}
      </div>
    </div>

    <!-- Drop grid -->
    <div
      ref="gridRef"
      @pointermove="handlePointerMove"
      @pointerleave="clearHover"
      @dragstart="clearHover"
      @dragover="(e) => emit('drag-over', e)"
      @dragleave="(e) => emit('drag-leave', e)"
      @drop="(e) => emit('drop', e)"
      @click="onGridClick"
      :style="{ height: `${gridHeight}px` }"
      class="relative flex-1 bg-background border-t border-border cursor-pointer"
    >
      <div
        v-for="minute in HOUR_OPTIONS"
        :key="minute"
        :style="{ height: `${SLOT_HEIGHT}px` }"
        :class="[
          'border-b',
          (minute + 30) % 60 === 0 ? 'border-border/70' : 'border-dashed border-border/30'
        ]"
      />

      <!-- The same start and end, across the grid -->
      <template v-if="guideMinutes">
        <span
          v-for="minute in guideMinutes"
          :key="`guide-${minute}`"
          class="pointer-events-none absolute inset-x-0 z-[5] border-t border-dashed border-foreground/15"
          :style="{ top: `${minutesToPx(minute)}px` }"
        />
      </template>

      <!-- Live Time Indicator Line -->
      <div
        v-if="nowMinute !== null"
        class="pointer-events-none absolute inset-x-0 z-20 flex items-center"
        :style="{ top: `${minutesToPx(nowMinute)}px` }"
      >
        <div class="relative flex items-center w-full">
          <span class="absolute -left-1 flex h-2 w-2 items-center justify-center">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
            <span class="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
          </span>
          <span class="h-[1.5px] w-full bg-rose-500/80" />
        </div>
      </div>

      <!-- Where a click would create a block (default length, following the cursor) -->
      <div
        v-if="hoverMinutes !== null && !preview && !resizing"
        :class="[
          'pointer-events-none absolute z-20 flex gap-1 overflow-hidden rounded-md border border-dashed border-foreground/20 pl-2 text-xs leading-4 tabular-nums text-muted-foreground',
          isShortBlock(hoverDuration) ? 'items-center' : 'items-start pt-1',
        ]"
        :style="{
          top: `${blockTop(hoverMinutes)}px`,
          height: `${blockHeight(hoverDuration)}px`,
          left: '1%',
          width: '98%',
        }"
      >
        <Plus class="h-4 w-3.5 shrink-0" aria-hidden="true" />
        {{ formatTimeRange(hoverMinutes, hoverMinutes + hoverDuration) }}
      </div>

      <!-- Where a dragged-in activity will land, drawn as the block it becomes -->
      <TimeBlock
        v-if="preview"
        :emoji="preview.emoji"
        :title="preview.label"
        :time="formatTimeRange(preview.start, Math.min(preview.start + preview.duration, DAY_MINUTES))"
        :color="preview.color"
        :short="isShortBlock(preview.duration)"
        :lines="titleLines(preview.duration)"
        class="pointer-events-none absolute z-30 border-dashed opacity-80"
        :style="{
          top: `${blockTop(preview.start)}px`,
          height: `${blockHeight(Math.min(preview.duration, DAY_MINUTES - preview.start))}px`,
          left: '1%',
          width: '98%',
        }"
      />

      <!-- Landing slot while moving a block; its times show in the gutter -->
      <div
        v-if="drag"
        class="pointer-events-none absolute z-30 rounded-md border border-dashed border-foreground/30 bg-foreground/[0.03]"
        :style="dragGhostStyle"
      />

      <!-- Scheduled task blocks -->
      <TimeBlock
        v-for="task in tasks"
        :key="task.id"
        :emoji="task.emoji"
        :title="task.title"
        :time="formatTimeRange(shownStart(task), shownStart(task) + task.durationMinutes)"
        :color="colorOf(task)"
        :done="task.completed"
        :short="isShortBlock(task.durationMinutes)"
        :lines="titleLines(task.durationMinutes)"
        data-task-block
        role="button"
        tabindex="0"
        :aria-label="`${task.title}, ${formatTime(task.startMinutes)} to ${formatTime(task.startMinutes + task.durationMinutes)}. Press Enter to edit.`"
        @keydown.enter.self.prevent="emit('task-click', task)"
        @keydown="(e: KeyboardEvent) => onBlockKeydown(task, e)"
        @pointerdown="(e: PointerEvent) => onBlockPointerDown(task, e)"
        @contextmenu="(e: MouseEvent) => { if (drag || pending) e.preventDefault(); }"
        @dragstart.prevent
        @click.stop="onBlockClick(task)"
        :style="{
          top: `${blockTop(task.startMinutes)}px`,
          height: `${blockHeight(task.durationMinutes)}px`,
          left: `${(layoutBox(task.id)?.left ?? 0) * 100 + 1}%`,
          width: `${(layoutBox(task.id)?.width ?? 1) * 100 - 2}%`,
          transform: drag?.id === task.id ? `translateY(${dragOffsetPx(task)}px)` : undefined,
        }"
        :class="[
          'group absolute cursor-grab select-none transition-[color,background-color,border-color,scale,box-shadow,left,width] duration-150 [-webkit-touch-callout:none]',
          drag?.id === task.id ? 'z-40 scale-[1.02] cursor-grabbing opacity-95 shadow-xl' : 'z-10 hover:z-20',
        ]"
      >
        <template #leading>
        <!-- Completion ring, before the title; left out of very narrow blocks (several side by side), where the title needs the room -->
          <button
            type="button"
            :aria-label="task.completed ? 'Mark as not done' : 'Mark as done'"
            @click.stop="emit('toggle-complete', task)"
            :class="[
              'relative z-[1] hidden h-3.5 w-3.5 shrink-0 cursor-pointer items-center justify-center rounded-full border-[1.5px] transition-colors after:absolute after:-inset-1.5 touch:after:-inset-2.5 @[8rem]:flex',
              !isShortBlock(task.durationMinutes) && 'mt-px',
              task.completed ? [toneOf(task).accent, 'border-transparent text-white'] : [toneOf(task).check, 'text-transparent'],
            ]"
          >
            <Check class="h-2.5 w-2.5" aria-hidden="true" :stroke-width="3" />
          </button>
        </template>

        <!-- Length while resizing, beside the title -->
        <span
          v-if="resizing === task.id"
          class="shrink-0 rounded bg-primary px-1.5 text-[11px] font-medium leading-4 tabular-nums text-primary-foreground"
        >
          {{ formatDuration(task.durationMinutes) }}
        </span>

        <!-- Delete: top-right corner. Shows on hover or focus; faintly always on touch. -->
        <button
          type="button"
          :aria-label="`Delete ${task.title}`"
          title="Delete"
          :class="[
            'absolute right-1 z-[2] flex touch:hidden max-sm:hidden h-5 w-5 cursor-pointer items-center justify-center rounded-md bg-black/5 text-current opacity-0 transition hover:bg-black/15 hover:!opacity-100 focus-visible:opacity-100 group-hover:opacity-70 dark:bg-white/10 dark:hover:bg-white/20',
            isShortBlock(task.durationMinutes) ? 'top-1/2 -translate-y-1/2' : 'top-0.5',
          ]"
          @pointerdown.stop
          @click.stop="emit('delete-task', task)"
        >
          <X class="h-3.5 w-3.5" aria-hidden="true" />
        </button>

        <!-- Resize handle at bottom -->
        <div
          data-resize-handle
          @pointerdown="(e) => emit('start-resize', task, e)"
          :class="isShortBlock(task.durationMinutes) ? 'h-2 touch:h-3' : 'h-3.5 sm:h-2 touch:h-5'"
          class="absolute inset-x-0 bottom-0 flex touch-none cursor-ns-resize items-end justify-center pb-[3px]"
        >
          <span
            v-if="hasResizeGrip(task.durationMinutes)"
            class="h-0.5 w-5 rounded-full bg-current opacity-0 transition-opacity group-hover:opacity-25 touch:opacity-20"
          />
        </div>
      </TimeBlock>
    </div>
  </div>
</template>
