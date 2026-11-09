import {
  DAY_MINUTES,
  HOUR_OPTIONS,
  SLOT_HEIGHT,
  SLOT_MINUTES,
  SNAP_MINUTES,
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

import { BlockContextMenu, type BlockMenuActions, type BlockMenuTarget } from "@/components/day-planner/BlockContextMenu";
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
  isToday,
  nowStart,
  menuActions,
}: {
  tasks: ScheduledTask[];
  nowMinute: number | null;
  resizing: string | null;
  preview: Preview | null;
  layout: Map<string, { left: number; width: number }>;
  gridHeight: number;
  onTaskClick: (task: ScheduledTask) => void;
  /** A tap or click on an empty stretch, or a finger held there and let go: create a block at `startMinutes`. */
  onGridClick: (startMinutes: number) => void;
  onToggleComplete: (task: ScheduledTask) => void;
  onDeleteTask: (task: ScheduledTask) => void;
  onStartResize: (task: ScheduledTask, event: React.PointerEvent<HTMLDivElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  /** `lanes` is set when the move also changed who sits where beside it. */
  onMoveTask: (task: ScheduledTask, startMinutes: number, lanes?: Map<string, number>) => void;
  isToday: boolean;
  /** Where "Start now" would put a block (the clock, snapped), or null when it is not today. */
  nowStart: number | null;
  /** What the right-click menu on a block can do. */
  menuActions: BlockMenuActions;
}) {
  const colorOf = useCategoryColor();
  const [menu, setMenu] = useState<BlockMenuTarget | null>(null);

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

  // A finger (or pen) resting on an empty stretch of the grid. Once it has rested for TOUCH_HOLD_MS a ghost
  // block appears under it and follows it; letting go creates the block there. A quicker swipe scrolls.
  const placing = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    timer: number | null;
    /** The hold has lasted long enough: the ghost is up and the timeline no longer scrolls under the finger. */
    held: boolean;
  } | null>(null);
  const placeRef = useRef<number | null>(null);
  const [placeMinutes, setPlaceMinutes] = useState<number | null>(null);
  const setPlaceBoth = (next: number | null) => {
    placeRef.current = next;
    setPlaceMinutes(next);
  };
  /** The finger that placed a ghost is lifting: its touchend must not also become a tap on whatever opens. */
  const swallowTouchEnd = useRef(false);

  /** The quarter hour under `clientY`, kept before midnight: where a new block would start. */
  const slotUnder = (clientY: number) => {
    const rect = gridRef.current!.getBoundingClientRect();
    return Math.min(slotAt(clientY - rect.top), DAY_MINUTES - SNAP_MINUTES);
  };

  // The ghost of a new block: under a held finger, otherwise under the mouse.
  const ghostMinutes = placeMinutes ?? hoverMinutes;
  // Cut short when the slot is too close to midnight.
  const ghostDuration = Math.min(HOVER_DURATION, DAY_MINUTES - (ghostMinutes ?? 0));

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
    const minutes = slotUnder(y);
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

  const updatePlacing = () => {
    if (!placing.current?.held || !gridRef.current) return;
    const minutes = slotUnder(lastY.current);
    if (minutes !== placeRef.current) setPlaceBoth(minutes);
  };

  // A held block, or a held ghost, near the top or bottom of the scroll area scrolls it.
  const edgeScrollTick = () => {
    rafId.current = null;
    const follow = active.current ? updateDrag : placing.current?.held ? updatePlacing : null;
    if (!follow) return;
    const el = scroller.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const speed = edgeScrollSpeed(lastY.current, rect.top, rect.bottom);
      if (speed !== 0) {
        el.scrollTop += speed;
        follow();
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

  /** Swallows the click a browser may still send after a hold-and-release that already did its job. */
  const suppressNextClick = () => {
    suppressClick.current = true;
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 80);
  };

  const onWindowPointerUp = (event: PointerEvent) => {
    if (event.pointerId !== trackedPointer.current) return;
    const dragged = active.current?.task;
    const current = dragRef.current;
    if (dragged && current) {
      suppressNextClick();
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

  // ---- Placing a new block with a held finger (touch and pen; the mouse has its hover ghost) ----

  const endPlacing = () => {
    stopTracking.current = null;
    const state = placing.current;
    if (state?.timer) window.clearTimeout(state.timer);
    placing.current = null;
    setPlaceBoth(null);
    if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    rafId.current = null;
    bodyStyle().userSelect = "";
    bodyStyle().webkitUserSelect = "";
    window.removeEventListener("pointermove", onPlacePointerMove);
    window.removeEventListener("pointerup", onPlacePointerUp);
    window.removeEventListener("pointercancel", onPlacePointerCancel);
    window.removeEventListener("blur", endPlacing);
  };

  const beginPlacing = () => {
    const state = placing.current;
    if (!state || !gridRef.current) return;
    state.timer = null;
    state.held = true;
    swallowTouchEnd.current = true;
    scroller.current = findScroller(gridRef.current);
    bodyStyle().userSelect = "none";
    bodyStyle().webkitUserSelect = "none";
    // A long press may already have begun selecting text nearby; drop it.
    window.getSelection()?.removeAllRanges();
    navigator.vibrate?.(8);
    setHoverMinutes(null);
    updatePlacing();
    rafId.current = requestAnimationFrame(edgeScrollTick);
  };

  const onPlacePointerMove = (event: PointerEvent) => {
    const state = placing.current;
    if (!state || event.pointerId !== state.pointerId) return;
    lastX.current = event.clientX;
    lastY.current = event.clientY;
    if (state.held) {
      updatePlacing();
    } else if (Math.hypot(event.clientX - state.startX, event.clientY - state.startY) > TOUCH_SLOP) {
      endPlacing(); // the user is scrolling, not placing
    }
  };

  const onPlacePointerUp = (event: PointerEvent) => {
    const state = placing.current;
    if (!state || event.pointerId !== state.pointerId) return;
    const start = state.held ? placeRef.current : null;
    endPlacing();
    // A quick tap is left to the click that follows it, which creates the block the usual way.
    if (start === null) return;
    suppressNextClick();
    onGridClick(start);
  };

  const onPlacePointerCancel = (event: PointerEvent) => {
    if (event.pointerId !== placing.current?.pointerId) return;
    endPlacing();
  };

  const onGridPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" || !event.isPrimary) return;
    if (resizing || preview || pending.current || active.current || placing.current) return;
    // Blocks have their own press-and-hold (moving them).
    if ((event.target as HTMLElement).closest("[data-task-block]")) return;
    swallowTouchEnd.current = false;
    lastX.current = event.clientX;
    lastY.current = event.clientY;
    placing.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      timer: window.setTimeout(beginPlacing, TOUCH_HOLD_MS),
      held: false,
    };
    window.addEventListener("pointermove", onPlacePointerMove);
    window.addEventListener("pointerup", onPlacePointerUp);
    window.addEventListener("pointercancel", onPlacePointerCancel);
    window.addEventListener("blur", endPlacing);
    stopTracking.current = endPlacing;
  };

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    // Once a block or a ghost is picked up, stop the browser from scrolling the page under the finger.
    const blockTouchScroll = (event: TouchEvent) => {
      if ((active.current || placing.current?.held) && event.cancelable) event.preventDefault();
    };
    // Lifting the finger that placed a ghost opens the editor at once; without this the browser would also
    // turn the release into a tap, which lands on the editor that just opened under it.
    const swallowPlacingTap = (event: TouchEvent) => {
      if (!swallowTouchEnd.current) return;
      swallowTouchEnd.current = false;
      if (event.cancelable) event.preventDefault();
    };
    el.addEventListener("touchmove", blockTouchScroll, { passive: false });
    el.addEventListener("touchend", swallowPlacingTap, { passive: false });
    return () => {
      el.removeEventListener("touchmove", blockTouchScroll);
      el.removeEventListener("touchend", swallowPlacingTap);
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
    // The finger covers the held ghost's own label, so its times show in the gutter too.
    if (placeMinutes !== null) return span(placeMinutes, HOVER_DURATION);
    const task = tasks.find((item) => item.id === resizing);
    return task ? span(task.startMinutes, task.durationMinutes) : null;
  }, [drag, preview, placeMinutes, resizing, tasks]);

  // Right click, the context-menu key or Shift+F10. A touch hold is the drag gesture, so it never opens the menu.
  const openMenu = (task: ScheduledTask, event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (drag || pending.current || active.current) return;
    const origin = event.currentTarget;
    // From the keyboard there is no pointer position (0, 0): open at the block instead.
    const fromKeyboard = event.clientX === 0 && event.clientY === 0;
    const rect = origin.getBoundingClientRect();
    clearHover();
    setMenu({
      task,
      origin,
      x: fromKeyboard ? rect.left + Math.min(24, rect.width / 2) : event.clientX,
      y: fromKeyboard ? rect.top + Math.min(16, rect.height / 2) : event.clientY,
      keyboard: fromKeyboard,
    });
  };

  const onBlockClick = (task: ScheduledTask) => {
    if (suppressClick.current) return;
    onTaskClick(task);
  };

  const handleGridClick = (event: React.MouseEvent<HTMLDivElement>) => {
    clearHover();
    if (suppressClick.current) return;
    onGridClick(slotUnder(event.clientY));
  };

  const dragOffsetPx = (task: ScheduledTask) =>
    drag?.id === task.id ? minutesToPx(drag.rawStart - task.startMinutes) : 0;

  // A block shows the color of its category.
  const toneOf = (task: { category: string; color: string }) => paletteOf(colorOf(task));

  return (
    <>
    {/* Nothing on the timeline is text to copy: a press and hold places or moves a block, so it must never
        start a text selection or the iOS callout. */}
    <div className="mx-auto flex max-w-4xl select-none pb-8 pt-4 [-webkit-touch-callout:none] sm:pb-12 sm:pt-6">
      {/* Hour gutter */}
      <div className="relative w-14 shrink-0 select-none border-r border-border/80 bg-background pr-1.5 sm:w-16 sm:pr-2.5">
        {HOUR_OPTIONS.map((minute) => (
          <div key={minute} style={{ height: `${SLOT_HEIGHT}px` }} className="relative">
            {gutterLabel(minute) ? (
              <span
                className={[
                  "absolute -top-2 right-1.5 text-[11px] font-medium tabular-nums text-muted-foreground/90 transition-opacity sm:right-2",
                  // The live time pill sits on the gutter; the hour it would cover steps aside.
                  nowMinute !== null && Math.abs(minute - nowMinute) < 14 ? "opacity-0" : "",
                ].join(" ")}
              >
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
                className="pointer-events-none absolute right-0.5 z-20 -translate-y-1/2 whitespace-nowrap rounded-full border border-border bg-card px-1.5 py-[3px] text-[10px] font-semibold leading-none tabular-nums text-foreground/80 shadow-xs sm:right-1"
                style={{ top: `${minutesToPx(minute)}px` }}
              >
                {formatTime(minute)}
              </div>
            ))
          : null}

        {/* Live time pill in gutter */}
        {nowMinute !== null ? (
          <div
            className="pointer-events-none absolute right-0.5 z-30 -translate-y-1/2 whitespace-nowrap rounded-full bg-brand px-1.5 py-[3px] text-[10px] font-semibold leading-none tabular-nums text-brand-foreground shadow-[0_1px_3px_rgb(var(--brand-shade)/0.35)] sm:right-1"
            style={{ top: `${minutesToPx(nowMinute)}px` }}
          >
            {formatTime(nowMinute)}
          </div>
        ) : null}
      </div>

      {/* Drop grid */}
      <div
        ref={gridRef}
        onPointerDown={onGridPointerDown}
        // A long press is the placing gesture; Android would otherwise also treat it as a right click.
        onContextMenu={(event) => {
          if (placing.current) event.preventDefault();
        }}
        onPointerMove={handlePointerMove}
        onPointerLeave={clearHover}
        onDragStart={clearHover}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={handleGridClick}
        style={{ height: `${gridHeight}px` }}
        data-timeline-grid
        className="relative flex-1 cursor-pointer border-t border-border bg-background"
      >
        {HOUR_OPTIONS.map((minute) => (
          <div
            key={minute}
            style={{ height: `${SLOT_HEIGHT}px` }}
            className={[
              "border-b",
              (minute + 30) % 60 === 0 ? "border-border/80" : "border-dashed border-border/45",
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
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand ring-2 ring-background" />
              </span>
              <span className="h-[1.5px] w-full bg-brand" />
            </div>
          </div>
        ) : null}

        {/* Where a click, or a held finger let go, would create a block (default length, following the
            cursor or the finger) */}
        {ghostMinutes !== null && !preview && !resizing ? (
          <div
            className={[
              "pointer-events-none absolute flex gap-1 overflow-hidden rounded-md border border-dashed pl-2 text-xs font-medium leading-4 tabular-nums",
              isShortBlock(ghostDuration) ? "items-center" : "items-start pt-1",
              // Held by a finger: picked up, above the blocks it passes over, and a touch clearer.
              placeMinutes !== null
                ? "z-30 border-foreground/40 bg-card/90 text-foreground/80 shadow-lg animate-in fade-in zoom-in-95 duration-150"
                : "z-20 border-foreground/25 bg-foreground/[0.025] text-muted-foreground",
            ].join(" ")}
            style={{
              top: `${blockTop(ghostMinutes)}px`,
              height: `${blockHeight(ghostDuration)}px`,
              left: "1%",
              width: "98%",
            }}
          >
            <Plus className="h-4 w-3.5 shrink-0" aria-hidden="true" />
            {formatTimeRange(ghostMinutes, ghostMinutes + ghostDuration)}
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
            className="pointer-events-none absolute z-30 rounded-md border border-dashed border-foreground/30 bg-foreground/[0.035]"
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
                isDragged ? "z-40 scale-[1.02] cursor-grabbing rounded-md opacity-95 shadow-xl" : "z-10 hover:z-20",
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
              onContextMenu={(event) => openMenu(task, event)}
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
                      "relative z-[1] hidden h-3 w-3 shrink-0 cursor-pointer items-center justify-center rounded-full border-[1.5px] transition-colors after:absolute after:-inset-2 touch:after:-inset-3 @[8rem]:flex",
                      !isShortBlock(task.durationMinutes) ? "mt-0.5" : "",
                      task.completed
                        ? `${toneOf(task).accent} border-transparent`
                        : `${toneOf(task).check} text-transparent`,
                    ].join(" ")}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleComplete(task);
                    }}
                  >
                    <Check className="h-2 w-2" aria-hidden="true" strokeWidth={3.5} />
                  </button>
                }
              >
                {/* Length while resizing, beside the title */}
                {resizing === task.id ? (
                  <span className="shrink-0 rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-4 tabular-nums text-primary-foreground">
                    {formatDuration(task.durationMinutes)}
                  </span>
                ) : null}

                {/* Delete: top-right corner. Shows on hover or focus; faintly always on touch. */}
                <button
                  type="button"
                  aria-label={`Delete ${task.title}`}
                  title="Delete"
                  className={[
                    "absolute right-1 z-[2] flex h-5 w-5 cursor-pointer items-center justify-center rounded-md bg-current/[0.08] text-current opacity-0 transition hover:bg-current/[0.16] hover:!opacity-100 focus-visible:opacity-100 group-hover:opacity-70 touch:hidden max-sm:hidden",
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
    <BlockContextMenu
      target={menu}
      isToday={isToday}
      nowStart={nowStart}
      actions={menuActions}
      onClose={() => setMenu(null)}
    />
    </>
  );
}
