import { TOUCH_SLOP, edgeScrollSpeed } from "@klndr/core";
import { useEffect, useState } from "react";

/**
 * What the day and week timelines share for fingers (and pens): a short buzz as a block lifts, steps and lands,
 * the scroll area a held block moves through, and the block a press and hold has picked up. A mouse goes
 * through none of this; it drags and resizes straight away, as it always has.
 */

/** How long each buzz lasts, in milliseconds: a firm one as a block lifts, a faint tick for every step. */
const BUZZ = { lift: 12, step: 6, drop: 9 } as const;

/** A short buzz where the device allows it (Android browsers; iOS gives web pages no vibration). */
export function haptic(kind: keyof typeof BUZZ) {
  // Browsers refuse (and complain in the console) until the page has had a real tap.
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  try {
    navigator.vibrate?.(BUZZ[kind]);
  } catch {
    // Not allowed here (an embedded frame, say); the drag works the same without it.
  }
}

/** The nearest ancestor that scrolls up and down: where a held block scrolls the hours. */
export function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let node = el?.parentElement ?? null; node; node = node.parentElement) {
    const overflowY = getComputedStyle(node).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return node;
  }
  return null;
}

/** The top and bottom of the part of a scroll area the hours show in: below a header pinned to its top, if any. */
export function scrollViewport(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const header = el.querySelector<HTMLElement>("[data-timeline-header]")?.offsetHeight ?? 0;
  return { top: rect.top + header, bottom: rect.bottom };
}

/**
 * How far to scroll this frame while something is held at `at`, having been picked up at `from` (either axis):
 * core's edge speed, but only toward the edge the pointer has moved toward. A block picked up near the bottom
 * of the screen then stays put until the finger heads for that edge, instead of running off on its own.
 */
export function heldEdgeSpeed(at: number, from: number, start: number, end: number): number {
  const speed = edgeScrollSpeed(at, start, end);
  if (speed > 0 && at - from < TOUCH_SLOP) return 0;
  if (speed < 0 && from - at < TOUCH_SLOP) return 0;
  return speed;
}

/**
 * Lets the click a browser sends right after a tap fall on nothing, when the tap has already done its job (put
 * a picked block down, or dropped a held one). It lives outside React, so a re-render in between cannot lose
 * it, and gives up after a moment in case no click comes.
 */
export function swallowNextClick(ms = 500) {
  const swallow = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    stop();
  };
  const stop = () => {
    document.removeEventListener("click", swallow, true);
    window.clearTimeout(timer);
  };
  document.addEventListener("click", swallow, true);
  const timer = window.setTimeout(stop, ms);
}

/**
 * The block a press and hold picked up, by its id. It stays picked once it is let go, showing a knob to resize it
 * with (see `ResizeKnob`) and moving at the first touch, until a tap anywhere else or Escape puts it down. A swipe
 * that scrolls leaves it picked. The tap that puts it down does only that: on the timeline it neither opens a
 * block nor starts a new one. The picked block's element carries `data-picked`.
 */
export function usePickedBlock() {
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    if (picked === null) return;
    let press: { pointerId: number; x: number; y: number; onTimeline: boolean } | null = null;

    const onDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      press = target?.closest("[data-picked]")
        ? null
        : {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            onTimeline: Boolean(target?.closest("[data-timeline-grid]")),
          };
    };
    const onUp = (event: PointerEvent) => {
      if (!press || event.pointerId !== press.pointerId) return;
      const tapped = Math.hypot(event.clientX - press.x, event.clientY - press.y) <= TOUCH_SLOP;
      const { onTimeline } = press;
      press = null;
      if (!tapped) return;
      setPicked(null);
      if (onTimeline) swallowNextClick();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPicked(null);
    };

    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointerup", onUp, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [picked]);

  return { picked, pick: setPicked, putDown: () => setPicked(null) };
}
