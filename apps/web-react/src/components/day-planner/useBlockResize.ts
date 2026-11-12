import { resizedDuration, type ScheduledTask } from "@klndr/core";
import { useEffect, useRef, useState, type PointerEvent } from "react";

import { haptic, heldEdgeSpeed, scrollParent, scrollViewport } from "@/components/day-planner/touch";

/** How long after a resize ends the click it produces is still ignored, so it does not open the editor. */
const CLICK_GUARD_MS = 120;
/** How long a block let go keeps its new length at the least: as long as its spring (`[data-resizing]`). */
const SETTLE_MS = 260;

const NO_LENGTHS: ReadonlyMap<string, number> = new Map();

/** The blocks drawn at the lengths `useBlockResize` holds; every other block (and an unchanged list) stays as it was. */
export function withLengths(tasks: ScheduledTask[], lengths: ReadonlyMap<string, number>): ScheduledTask[] {
  if (!lengths.size) return tasks;
  return tasks.map((task) => {
    const duration = lengths.get(task.id);
    return duration === undefined || duration === task.durationMinutes ? task : { ...task, durationMinutes: duration };
  });
}

/**
 * Resizing a block from its bottom edge, with a mouse (the strip along the edge) or a finger (the knob of a
 * picked block). The block follows the pointer locally (`lengths`) in quarter hours, and the caller hears
 * about the new length once, on release. A pointer the browser takes over (it starts scrolling, say) puts the
 * block back as it was.
 *
 * A block let go keeps the length it was let go at until the caller's save (the promise `onResize` returns) has
 * settled, and at least until its spring has. The saved change reaches the screen a moment after the release;
 * without this the block would flick back to its old length in between.
 *
 * The length is measured from the top of the grid rather than the screen, so that it stays right while the
 * hours scroll under the pointer: held near the top or the bottom of the scroll area, once it has moved toward
 * that edge, the pointer scrolls it, and a block can be stretched past what the screen shows. A finger feels a
 * tick for every quarter hour, where the device allows it. Only the pointer that began the resize counts; a
 * second finger on the screen changes nothing.
 *
 * The pointer listeners live on `window` for the whole gesture, and are removed if the component goes away in
 * the middle of it.
 */
export function useBlockResize(onResize: (task: ScheduledTask, durationMinutes: number) => void | Promise<unknown>) {
  /** The block the pointer is resizing right now. */
  const [resizing, setResizing] = useState<string | null>(null);
  /** The length to draw each block at, by id: the one being resized, and any let go whose save has not landed. */
  const [lengths, setLengths] = useState<ReadonlyMap<string, number>>(NO_LENGTHS);
  /** Which gesture last set each block's length, so that an older save landing late cannot drop a newer one. */
  const owner = useRef(new Map<string, number>());
  const gestures = useRef(0);

  const holdLength = (id: string, duration: number) =>
    setLengths((current) => (current.get(id) === duration ? current : new Map(current).set(id, duration)));
  const dropLength = (id: string, gesture: number) => {
    if (owner.current.get(id) !== gesture) return;
    owner.current.delete(id);
    setLengths((current) => {
      if (!current.has(id)) return current;
      const next = new Map(current);
      next.delete(id);
      return next.size ? next : NO_LENGTHS;
    });
  };

  // The latest callback, read when the gesture ends (which may be several renders after it began).
  const onResizeRef = useRef(onResize);
  useEffect(() => {
    onResizeRef.current = onResize;
  });

  const moved = useRef(false);
  const guardTimer = useRef<number | null>(null);
  const detach = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      detach.current?.();
      if (guardTimer.current !== null) window.clearTimeout(guardTimer.current);
    },
    [],
  );

  const startResize = (task: ScheduledTask, event: PointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    detach.current?.();

    const handle = event.currentTarget;
    const { pointerId } = event;
    const finger = event.pointerType !== "mouse";
    const grid = handle.closest<HTMLElement>("[data-timeline-grid]");
    const scroller = scrollParent(grid);
    const gridTop = () => grid?.getBoundingClientRect().top ?? 0;

    const startY = event.clientY;
    const startOffset = startY - gridTop();
    const startDuration = task.durationMinutes;
    let lastY = startY;
    let duration = startDuration;
    const durationNow = () => resizedDuration(task.startMinutes, startDuration, lastY - gridTop() - startOffset);

    // Keeps the moves and the release coming to the handle, wherever the pointer goes.
    try {
      handle.setPointerCapture(pointerId);
    } catch {
      // The pointer is already gone; the window listeners still end the resize.
    }

    const gesture = ++gestures.current;
    owner.current.set(task.id, gesture);
    moved.current = false;
    setResizing(task.id);
    holdLength(task.id, duration);
    if (finger) haptic("lift");

    const follow = () => {
      const next = durationNow();
      if (next === duration) return;
      duration = next;
      if (finger) haptic("step");
      holdLength(task.id, next);
    };

    let frame = requestAnimationFrame(function edgeScroll() {
      if (scroller && moved.current) {
        const { top, bottom } = scrollViewport(scroller);
        // Only toward the edge the pointer has moved toward: shortening a block near the bottom of the screen
        // must not scroll it longer.
        const speed = heldEdgeSpeed(lastY, startY, top, bottom);
        const before = scroller.scrollTop;
        if (speed !== 0) scroller.scrollTop += speed;
        if (scroller.scrollTop !== before) follow();
      }
      frame = requestAnimationFrame(edgeScroll);
    });

    const stopListening = () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
      detach.current = null;
    };

    function onMove(moveEvent: globalThis.PointerEvent) {
      if (moveEvent.pointerId !== pointerId) return;
      moved.current = true;
      lastY = moveEvent.clientY;
      follow();
    }

    function cancel(cancelEvent: Event) {
      if (cancelEvent instanceof globalThis.PointerEvent && cancelEvent.pointerId !== pointerId) return;
      stopListening();
      setResizing(null);
      dropLength(task.id, gesture);
      moved.current = false;
    }

    function finish(upEvent: globalThis.PointerEvent) {
      if (upEvent.pointerId !== pointerId) return;
      stopListening();
      setResizing(null);
      lastY = upEvent.clientY;
      const next = durationNow();
      if (next === startDuration) {
        dropLength(task.id, gesture);
        moved.current = false;
        return;
      }
      if (finger) haptic("drop");
      holdLength(task.id, next);
      const saved = onResizeRef.current(task, next);
      const sprung = new Promise((resolve) => window.setTimeout(resolve, SETTLE_MS));
      // The save's own update reaches the screen on a timer of its own; let that go first.
      void Promise.allSettled([saved, sprung]).then(() => window.setTimeout(() => dropLength(task.id, gesture)));
      guardTimer.current = window.setTimeout(() => {
        moved.current = false;
      }, CLICK_GUARD_MS);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    // Switching away mid-resize never sends the release; put the block back rather than leave it stuck.
    window.addEventListener("blur", cancel);
    detach.current = stopListening;
  };

  return {
    /** The id of the block being resized, while the pointer is down. */
    resizing,
    /**
     * The lengths to draw blocks at, by id (see `withLengths`): the block being resized, and any just let go until
     * its new length has been saved. These blocks spring to each new length (`data-resizing`).
     */
    lengths,
    startResize,
    /** True while the click that ends a resize is still on its way. */
    justResized: () => moved.current,
  };
}
