import {
  DAY_MINUTES,
  HOUR_OPTIONS,
  SLOT_HEIGHT,
  SLOT_MINUTES,
  TOUCH_HOLD_MS,
  TOUCH_SLOP,
  blockHeight,
  blockTop,
  boxOf,
  changedLanes,
  dragFraction,
  dragPosition,
  edgeScrollSpeed,
  formatDuration,
  formatTime,
  formatTimeRange,
  grabOffset,
  gutterLabel,
  hasResizeGrip,
  isShortBlock,
  minutesToPx,
  nudgedStart,
  planDrag,
  pxToMinutes,
  slotAt,
  titleLines,
  type ScheduledTask,
} from "@klndr/core";
import { useCategoryColor } from "@klndr/data";
import { Check, Plus, X } from "lucide-react";
import type * as React from "react";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import { TimeBlock } from "@/components/day-planner/TimeBlock";
import { paletteOf } from "@/lib/colors";

const MOUSE_SLOP = 4;
/** Matches the default duration of a block created by clicking the grid. */
const HOVER_DURATION = 30;

const durationOf = (tasks: ScheduledTask[], id: string) =>
  tasks.find((item) => item.id === id)?.durationMinutes ?? SLOT_MINUTES;

type Preview = { start: number; duration: number; color: string; label: string; emoji: string };

type DragState = {
  id: string;
  /** Free-following position of the block's top edge, in minutes. */
  rawStart: number;
  /** Where the block will land once released, after snapping. */
  snappedStart: number;
  /** How far across the timeline the pointer is (0 to 1): which column it is held over. */
  fraction: number;
};

/**
 * The hour gutter and the grid the day is drawn on, the click-to-create ghost, the drop preview for a
 * dragged-in activity, the live-time line, and the blocks themselves, which can be tapped, dragged (mouse,
 * touch and pen) and resized.
 *
 * Every measurement, snap and column decision is `@klndr/core`'s (`blockTop`, `planDrag`, `changedLanes`,
 * `dragPosition`, `resizedDuration`, `edgeScrollSpeed`), so the timeline behaves the same on every screen.
 */
export function DayTimelineGrid({
  tasks,
  nowMinute,
  resizing,
  preview,
  layout,
  gridHeight,
  onTaskClick,
  onGridClick,
  onToggleComplete,
  onDeleteTask,
  onStartResize,
  onDragOver,
  onDragLeave,
  onDrop,
  onMoveTask,
}: {
  tasks: ScheduledTask[];
  nowMinute: number | null;
  resizing: string | null;
  preview: Preview | null;
  layout: Map<string, { left: number; width: number }>;
  gridHeight: number;
  onTaskClick: (task: ScheduledTask) => void;
  onGridClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  onToggleComplete: (task: ScheduledTask) => void;
  onDeleteTask: (task: ScheduledTask) => void;
  onStartResize: (task: ScheduledTask, event: React.PointerEvent<HTMLDivElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  /** `lanes` is set when the move also changed who sits where beside it. */
  onMoveTask: (task: ScheduledTask, startMinutes: number, lanes?: Map<string, number>) => void;
}) {
  const colorOf = useCategoryColor();

  const gridRef = useRef<HTMLDivElement | null>(null);
  const [hoverMinutes, setHoverMinutes] = useState<number | null>(null);

  // The drag lives in a ref as well as in state: the pointer listeners are attached to `window` for the
  // whole gesture, so they have to read the latest drag rather than the one from the render they were
  // created in (state alone would leave them looking at a stale value).
  const dragRef = useRef<DragState | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const setDragBoth = (next: DragState | null) => {
    dragRef.current = next;
    setDrag(next);
  };

  // The same for the day's blocks, which a `window` listener may also need after a re-render.
  const tasksRef = useRef(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  });

  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const pending = useRef<{
    task: ScheduledTask;
    pointerType: string;
    pointerId: number;
    target: HTMLElement;
    startX: number;
    startY: number;
    timer: number | null;
  } | null>(null);
  const active = useRef<{ task: ScheduledTask; grabMinutes: number } | null>(null);
  /** The pointer that pressed the block; any other finger or pen is ignored until it lets go. */
  const trackedPointer = useRef<number | null>(null);
  const lastX = useRef(0);
  const lastY = useRef(0);
  const scroller = useRef<HTMLElement | null>(null);
  const rafId = useRef<number | null>(null);
  const suppressClick = useRef(false);
  /** Ends the gesture in flight. It closes over the render that began it, so it removes exactly its listeners. */
  const stopTracking = useRef<(() => void) | null>(null);

  // Cut short when the hovered slot is too close to midnight.
  const hoverDuration = Math.min(HOVER_DURATION, DAY_MINUTES - (hoverMinutes ?? 0));

  const updateHover = () => {
    const pointer = lastPointer.current;
    if (!pointer || !gridRef.current || resizing || preview || dragRef.current) {
      setHoverMinutes(null);
      return;
    }
    const rect = gridRef.current.getBoundingClientRect();
    const { x, y } = pointer;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setHoverMinutes(null);
      return;
    }
    // Existing blocks handle their own clicks, so nothing new would be created there.
    const target = document.elementFromPoint(x, y);
    if (target?.closest("[data-task-block]")) {
      setHoverMinutes(null);
      return;
    }
    // Floors to the quarter hour under the cursor, same as the click-to-create handler, so the block lands
    // where it's shown.
    const minutes = slotAt(y - rect.top);
    // No ghost over a row that already holds activities.
    const end = minutes + Math.min(HOVER_DURATION, DAY_MINUTES - minutes);
    const occupied = tasksRef.current.some(
      (task) => task.startMinutes < end && task.startMinutes + task.durationMinutes > minutes,
    );
    setHoverMinutes(occupied ? null : minutes);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return; // no hover on touch
    lastPointer.current = { x: event.clientX, y: event.clientY };
    updateHover();
  };

  const clearHover = () => {
    lastPointer.current = null;
    setHoverMinutes(null);
  };

  // Scrolling moves the grid under a stationary cursor without firing pointer events, so the ghost is also
  // refreshed on scroll, and whenever the preview or the resizing block changes.
  const refreshHover = useEffectEvent(updateHover);
  useEffect(() => {
    const onScroll = () => refreshHover();
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    refreshHover();
    return () => window.removeEventListener("scroll", onScroll, { capture: true });
  }, [resizing, preview]);

  // ---- Moving blocks (pointer based, so it works with mouse, touch and pen) ----
  // Touch must press and hold (TOUCH_HOLD_MS), otherwise the gesture scrolls the timeline.

  const findScroller = (el: HTMLElement | null): HTMLElement | null => {
    for (let node = el?.parentElement ?? null; node; node = node.parentElement) {
      const overflowY = getComputedStyle(node).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") return node;
    }
    return null;
  };

  const pointerMinutes = () => {
    const rect = gridRef.current!.getBoundingClientRect();
    return pxToMinutes(lastY.current - rect.top);
  };

  // `document.body.style` has no `webkitUserSelect` in the DOM types, though every browser takes it.
  const bodyStyle = () => document.body.style as unknown as Record<string, string>;

  const updateDrag = () => {
    const state = active.current;
    if (!state) return;
    const { task, grabMinutes } = state;
    const { rawStart, snappedStart } = dragPosition(pointerMinutes(), grabMinutes, task.durationMinutes);
    const rect = gridRef.current!.getBoundingClientRect();
    const fraction = dragFraction(lastX.current, rect.left, rect.width);
    setDragBoth({ id: task.id, rawStart, snappedStart, fraction });
  };

  const edgeScrollTick = () => {
    rafId.current = null;
    if (!active.current) return;
    const el = scroller.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const speed = edgeScrollSpeed(lastY.current, rect.top, rect.bottom);
      if (speed !== 0) {
        el.scrollTop += speed;
        updateDrag();
      }
    }
    rafId.current = requestAnimationFrame(edgeScrollTick);
  };

  const beginDrag = () => {
    const start = pending.current;
    if (!start || !gridRef.current) return;
    const { task, pointerType, pointerId, target } = start;
    if (start.timer) window.clearTimeout(start.timer);
    pending.current = null;
    // Keeps moves and the release coming to us even outside the window or over other elements.
    try {
      target.setPointerCapture(pointerId);
    } catch {
      // The pointer is already gone; the window listeners still end the drag.
    }
    scroller.current = findScroller(gridRef.current);
    active.current = { task, grabMinutes: grabOffset(pointerMinutes(), task.startMinutes) };
    bodyStyle().userSelect = "none";
    bodyStyle().webkitUserSelect = "none";
    if (pointerType === "touch") navigator.vibrate?.(8);
    setHoverMinutes(null);
    updateDrag();
    rafId.current = requestAnimationFrame(edgeScrollTick);
  };

  const endTracking = () => {
    stopTracking.current = null;
    const start = pending.current;
    if (start?.timer) window.clearTimeout(start.timer);
    pending.current = null;
    active.current = null;
    trackedPointer.current = null;
    setDragBoth(null);
    if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    rafId.current = null;
    bodyStyle().userSelect = "";
    bodyStyle().webkitUserSelect = "";
    window.removeEventListener("pointermove", onWindowPointerMove);
    window.removeEventListener("pointerup", onWindowPointerUp);
    window.removeEventListener("pointercancel", onWindowPointerCancel);
    window.removeEventListener("blur", endTracking);
  };

  const onWindowPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== trackedPointer.current) return;
    lastX.current = event.clientX;
    lastY.current = event.clientY;
    const start = pending.current;
    if (start) {
      const moved = Math.hypot(event.clientX - start.startX, event.clientY - start.startY);
      if (start.pointerType === "mouse") {
        if (moved > MOUSE_SLOP) beginDrag();
      } else if (moved > TOUCH_SLOP) {
        endTracking(); // the user is scrolling, not dragging
      }
      return;
    }
    updateDrag();
  };

  const onWindowPointerUp = (event: PointerEvent) => {
    if (event.pointerId !== trackedPointer.current) return;
    const dragged = active.current?.task;
    const current = dragRef.current;
    if (dragged && current) {
      suppressClick.current = true;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 80);
      const start = current.snappedStart;
      const lanes = changedLanes(tasksRef.current, planDrag(tasksRef.current, current.id, start, current.fraction));
      if (start !== dragged.startMinutes || lanes) onMoveTask(dragged, start, lanes);
    }
    endTracking();
  };

  const onWindowPointerCancel = (event: PointerEvent) => {
    if (event.pointerId !== trackedPointer.current) return;
    endTracking();
  };

  const onBlockPointerDown = (task: ScheduledTask, event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (resizing || pending.current || active.current) return;
    if ((event.target as HTMLElement).closest("button, [data-resize-handle]")) return;
    lastX.current = event.clientX;
    lastY.current = event.clientY;
    trackedPointer.current = event.pointerId;
    pending.current = {
      task,
      pointerType: event.pointerType,
      pointerId: event.pointerId,
      target: event.currentTarget,
      startX: event.clientX,
      startY: event.clientY,
      timer: event.pointerType === "mouse" ? null : window.setTimeout(beginDrag, TOUCH_HOLD_MS),
    };
    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerup", onWindowPointerUp);
    window.addEventListener("pointercancel", onWindowPointerCancel);
    // Switching away mid-drag never sends the release; drop the drag rather than leave it stuck.
    window.addEventListener("blur", endTracking);
    stopTracking.current = endTracking;
  };

  const onBlockKeydown = (task: ScheduledTask, event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const direction = event.key === "ArrowUp" ? -1 : 1;
    const next = nudgedStart(task.startMinutes, task.durationMinutes, direction);
    if (next !== task.startMinutes) onMoveTask(task, next);
  };

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    // Once a block is picked up, stop the browser from scrolling the page under the finger.
    const blockTouchScroll = (event: TouchEvent) => {
      if (active.current && event.cancelable) event.preventDefault();
    };
    el.addEventListener("touchmove", blockTouchScroll, { passive: false });
    return () => {
      el.removeEventListener("touchmove", blockTouchScroll);
      stopTracking.current?.();
    };
  }, []);

  // Where and how tall a block is drawn, and what it shows, is core's (blockTop, blockHeight,
  // isShortBlock, titleLines, hasResizeGrip), the same on every screen.

  // While a block is held, the others make room: it sits in whichever column the pointer is over, among
  // the blocks it would share time with where it would land.
  const dragPlan = useMemo(
    () => (drag ? planDrag(tasks, drag.id, drag.snappedStart, drag.fraction) : null),
    [drag, tasks],
  );

  const layoutBox = (id: string) => {
    const placement = dragPlan?.placements.get(id);
    return placement ? boxOf(placement) : layout.get(id);
  };

  const dragGhostStyle = drag
    ? {
        top: `${blockTop(drag.snappedStart)}px`,
        height: `${blockHeight(durationOf(tasks, drag.id))}px`,
        left: `${(layoutBox(drag.id)?.left ?? 0) * 100 + 1}%`,
        width: `${(layoutBox(drag.id)?.width ?? 1) * 100 - 2}%`,
      }
    : undefined;

  // A block being moved shows the time it will land at.
  const shownStart = (task: ScheduledTask) => (drag?.id === task.id ? drag.snappedStart : task.startMinutes);

  // Start and end marked in the gutter and across the grid: where a moved block or a dragged-in activity
  // will land, or the block being resized.
  const guideMinutes = useMemo(() => {
    const span = (start: number, duration: number): [number, number] => [
      start,
      Math.min(start + duration, DAY_MINUTES),
    ];
    if (drag) return span(drag.snappedStart, durationOf(tasks, drag.id));
    if (preview) return span(preview.start, preview.duration);
    const task = tasks.find((item) => item.id === resizing);
    return task ? span(task.startMinutes, task.durationMinutes) : null;
  }, [drag, preview, resizing, tasks]);

  const onBlockClick = (task: ScheduledTask) => {
    if (suppressClick.current) return;
    onTaskClick(task);
  };

  const handleGridClick = (event: React.MouseEvent<HTMLDivElement>) => {
    clearHover();
    if (suppressClick.current) return;
    onGridClick(event);
  };

  const dragOffsetPx = (task: ScheduledTask) =>
    drag?.id === task.id ? minutesToPx(drag.rawStart - task.startMinutes) : 0;

  // A block shows the color of its category.
  const toneOf = (task: { category: string; color: string }) => paletteOf(colorOf(task));

  return (
    <div className="mx-auto flex max-w-4xl pb-8 pt-4 sm:pb-12 sm:pt-6">
      {/* Hour gutter */}
      <div className="relative w-14 shrink-0 select-none border-r border-border bg-background pr-1.5 sm:w-16 sm:pr-2.5">
        {HOUR_OPTIONS.map((minute) => (
          <div key={minute} style={{ height: `${SLOT_HEIGHT}px` }} className="relative">
            {gutterLabel(minute) ? (
              <span className="absolute -top-2.5 right-1.5 font-mono text-[11px] font-medium tracking-tight text-muted-foreground sm:right-2 sm:text-xs">
                {gutterLabel(minute)}
              </span>
            ) : null}
          </div>
        ))}

        {/* Start and end times of the moving or resizing block */}
        {guideMinutes
          ? guideMinutes.map((minute) => (
              <div
                key={`edge-${minute}`}
                className="pointer-events-none absolute right-0.5 z-20 -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-muted px-1 py-0.5 font-mono text-[10px] font-medium leading-none text-foreground/70 sm:right-1 sm:px-1.5"
                style={{ top: `${minutesToPx(minute)}px` }}
              >
                {formatTime(minute)}
              </div>
            ))
          : null}

        {/* Live time pill in gutter */}
        {nowMinute !== null ? (
          <div
            className="pointer-events-none absolute right-0.5 z-30 -translate-y-1/2 whitespace-nowrap rounded-md bg-rose-500 px-1 py-0.5 font-mono text-[10px] font-bold leading-none text-white shadow-xs sm:right-1 sm:px-1.5"
            style={{ top: `${minutesToPx(nowMinute)}px` }}
          >
            {formatTime(nowMinute)}
          </div>
        ) : null}
      </div>

      {/* Drop grid */}
      <div
        ref={gridRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={clearHover}
        onDragStart={clearHover}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={handleGridClick}
        style={{ height: `${gridHeight}px` }}
        className="relative flex-1 cursor-pointer border-t border-border bg-background"
      >
        {HOUR_OPTIONS.map((minute) => (
          <div
            key={minute}
            style={{ height: `${SLOT_HEIGHT}px` }}
            className={[
              "border-b",
              (minute + 30) % 60 === 0 ? "border-border/70" : "border-dashed border-border/30",
            ].join(" ")}
          />
        ))}

        {/* The same start and end, across the grid */}
        {guideMinutes
          ? guideMinutes.map((minute) => (
              <span
                key={`guide-${minute}`}
                className="pointer-events-none absolute inset-x-0 z-[5] border-t border-dashed border-foreground/15"
                style={{ top: `${minutesToPx(minute)}px` }}
              />
            ))
          : null}

        {/* Live Time Indicator Line */}
        {nowMinute !== null ? (
          <div
            className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
            style={{ top: `${minutesToPx(nowMinute)}px` }}
          >
            <div className="relative flex w-full items-center">
              <span className="absolute -left-1 flex h-2 w-2 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
              </span>
              <span className="h-[1.5px] w-full bg-rose-500/80" />
            </div>
          </div>
        ) : null}

        {/* Where a click would create a block (default length, following the cursor) */}
        {hoverMinutes !== null && !preview && !resizing ? (
          <div
            className={[
              "pointer-events-none absolute z-20 flex gap-1 overflow-hidden rounded-md border border-dashed border-foreground/20 pl-2 text-xs leading-4 tabular-nums text-muted-foreground",
              isShortBlock(hoverDuration) ? "items-center" : "items-start pt-1",
            ].join(" ")}
            style={{
              top: `${blockTop(hoverMinutes)}px`,
              height: `${blockHeight(hoverDuration)}px`,
              left: "1%",
              width: "98%",
            }}
          >
            <Plus className="h-4 w-3.5 shrink-0" aria-hidden="true" />
            {formatTimeRange(hoverMinutes, hoverMinutes + hoverDuration)}
          </div>
        ) : null}

        {/* Where a dragged-in activity will land, drawn as the block it becomes */}
        {preview ? (
          <TimeBlock
            emoji={preview.emoji}
            title={preview.label}
            time={formatTimeRange(preview.start, Math.min(preview.start + preview.duration, DAY_MINUTES))}
            color={preview.color}
            short={isShortBlock(preview.duration)}
            lines={titleLines(preview.duration)}
            className="pointer-events-none absolute z-30 border-dashed opacity-80"
            style={{
              top: `${blockTop(preview.start)}px`,
              height: `${blockHeight(Math.min(preview.duration, DAY_MINUTES - preview.start))}px`,
              left: "1%",
              width: "98%",
            }}
          />
        ) : null}

        {/* Landing slot while moving a block; its times show in the gutter */}
        {drag ? (
          <div
            className="pointer-events-none absolute z-30 rounded-md border border-dashed border-foreground/30 bg-foreground/[0.03]"
            style={dragGhostStyle}
          />
        ) : null}
        {/* Scheduled task blocks */}
        {tasks.map((task) => {
          const isDragged = drag?.id === task.id;
          return (
            <div
              key={task.id}
              data-task-block
              role="button"
              tabIndex={0}
              aria-label={`${task.title}, ${formatTime(task.startMinutes)} to ${formatTime(
                task.startMinutes + task.durationMinutes,
              )}. Press Enter to edit.`}
              className={[
                "group absolute cursor-grab select-none transition-[color,background-color,border-color,scale,box-shadow,left,width] duration-150 [-webkit-touch-callout:none]",
                isDragged ? "z-40 scale-[1.02] cursor-grabbing opacity-95 shadow-xl" : "z-10 hover:z-20",
              ].join(" ")}
              style={{
                top: `${blockTop(task.startMinutes)}px`,
                height: `${blockHeight(task.durationMinutes)}px`,
                left: `${(layoutBox(task.id)?.left ?? 0) * 100 + 1}%`,
                width: `${(layoutBox(task.id)?.width ?? 1) * 100 - 2}%`,
                transform: isDragged ? `translateY(${dragOffsetPx(task)}px)` : undefined,
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && event.target === event.currentTarget) {
                  event.preventDefault();
                  onTaskClick(task);
                  return;
                }
                onBlockKeydown(task, event);
              }}
              onPointerDown={(event) => onBlockPointerDown(task, event)}
              onContextMenu={(event) => {
                if (drag || pending.current) event.preventDefault();
              }}
              onDragStart={(event) => event.preventDefault()}
              onClick={(event) => {
                event.stopPropagation();
                onBlockClick(task);
              }}
            >
              <TimeBlock
                emoji={task.emoji}
                title={task.title}
                time={formatTimeRange(shownStart(task), shownStart(task) + task.durationMinutes)}
                color={colorOf(task)}
                done={task.completed}
                short={isShortBlock(task.durationMinutes)}
                lines={titleLines(task.durationMinutes)}
                className="h-full w-full"
                leading={
                  <button
                    type="button"
                    aria-label={task.completed ? "Mark as not done" : "Mark as done"}
                    className={[
                      "relative z-[1] hidden h-3.5 w-3.5 shrink-0 cursor-pointer items-center justify-center rounded-full border-[1.5px] transition-colors after:absolute after:-inset-1.5 touch:after:-inset-2.5 @[8rem]:flex",
                      !isShortBlock(task.durationMinutes) ? "mt-px" : "",
                      task.completed
                        ? `${toneOf(task).accent} border-transparent text-white`
                        : `${toneOf(task).check} text-transparent`,
                    ].join(" ")}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleComplete(task);
                    }}
                  >
                    <Check className="h-2.5 w-2.5" aria-hidden="true" strokeWidth={3} />
                  </button>
                }
              >
                {/* Length while resizing, beside the title */}
                {resizing === task.id ? (
                  <span className="shrink-0 rounded bg-primary px-1.5 text-[11px] font-medium leading-4 tabular-nums text-primary-foreground">
                    {formatDuration(task.durationMinutes)}
                  </span>
                ) : null}

                {/* Delete: top-right corner. Shows on hover or focus; faintly always on touch. */}
                <button
                  type="button"
                  aria-label={`Delete ${task.title}`}
                  title="Delete"
                  className={[
                    "absolute right-1 z-[2] flex h-5 w-5 cursor-pointer items-center justify-center rounded-md bg-black/5 text-current opacity-0 transition hover:bg-black/15 hover:!opacity-100 focus-visible:opacity-100 group-hover:opacity-70 touch:hidden max-sm:hidden dark:bg-white/10 dark:hover:bg-white/20",
                    isShortBlock(task.durationMinutes) ? "top-1/2 -translate-y-1/2" : "top-0.5",
                  ].join(" ")}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteTask(task);
                  }}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>

                {/* Resize handle at bottom */}
                <div
                  data-resize-handle
                  onPointerDown={(event) => onStartResize(task, event)}
                  className={[
                    "absolute inset-x-0 bottom-0 flex touch-none cursor-ns-resize items-end justify-center pb-[3px]",
                    isShortBlock(task.durationMinutes) ? "h-2 touch:h-3" : "h-3.5 touch:h-5 sm:h-2",
                  ].join(" ")}
                >
                  {hasResizeGrip(task.durationMinutes) ? (
                    <span className="h-0.5 w-5 rounded-full bg-current opacity-0 transition-opacity group-hover:opacity-25 touch:opacity-20" />
                  ) : null}
                </div>
              </TimeBlock>
            </div>
          );
        })}
      </div>
    </div>
  );
}
