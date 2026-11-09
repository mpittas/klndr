import { resizedDuration, type ScheduledTask } from "@klndr/core";
import { useEffect, useRef, useState, type PointerEvent } from "react";

/** How long after a resize ends the click it produces is still ignored, so it does not open the editor. */
const CLICK_GUARD_MS = 120;

/**
 * Resizing a block from its bottom edge. The block follows the pointer locally (`override`), and the
 * caller hears about the new length once, on release. Moves that the browser takes over (it starts
 * scrolling, say) put the block back as it was.
 *
 * The pointer listeners live on `window` for the whole gesture, and are removed if the component goes
 * away in the middle of it.
 */
export function useBlockResize(onResize: (task: ScheduledTask, durationMinutes: number) => void) {
  const [active, setActive] = useState<{ id: string; duration: number } | null>(null);

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

    const startY = event.clientY;
    const startDuration = task.durationMinutes;
    const durationAt = (clientY: number) => resizedDuration(task.startMinutes, startDuration, clientY - startY);

    moved.current = false;
    setActive({ id: task.id, duration: startDuration });

    const stopListening = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
      detach.current = null;
    };

    function onMove(moveEvent: globalThis.PointerEvent) {
      moved.current = true;
      setActive({ id: task.id, duration: durationAt(moveEvent.clientY) });
    }

    function cancel() {
      stopListening();
      setActive(null);
      moved.current = false;
    }

    function finish(upEvent: globalThis.PointerEvent) {
      stopListening();
      setActive(null);
      const next = durationAt(upEvent.clientY);
      if (next === startDuration) {
        moved.current = false;
        return;
      }
      onResizeRef.current(task, next);
      guardTimer.current = window.setTimeout(() => {
        moved.current = false;
      }, CLICK_GUARD_MS);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    detach.current = stopListening;
  };

  return {
    /** The id of the block being resized. */
    resizing: active?.id ?? null,
    /** The block's length while the pointer is still down, to draw it with. */
    override: active,
    startResize,
    /** True while the click that ends a resize is still on its way. */
    justResized: () => moved.current,
  };
}
