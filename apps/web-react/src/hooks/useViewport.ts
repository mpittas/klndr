import { useSyncExternalStore } from "react";

/** Whether a CSS media query currently matches, kept up to date as the window changes. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

const subscribeToViewport = (onChange: () => void) => {
  const viewport = window.visualViewport;
  viewport?.addEventListener("resize", onChange);
  viewport?.addEventListener("scroll", onChange);
  return () => {
    viewport?.removeEventListener("resize", onChange);
    viewport?.removeEventListener("scroll", onChange);
  };
};

const keyboardInset = () => {
  const viewport = window.visualViewport;
  return viewport ? Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop)) : 0;
};

/**
 * How much of the bottom of the screen the on-screen keyboard covers, in pixels, so a bottom sheet can
 * sit above it.
 */
export function useKeyboardInset(): number {
  return useSyncExternalStore(subscribeToViewport, keyboardInset, () => 0);
}

/** The part of the page a person can see right now: `top` from the page's top edge, and its `height`. */
export type VisibleViewport = { top: number; height: number };

/** Before the window is known (and on the server): no height, so a caller falls back to CSS units. */
const UNKNOWN_VIEWPORT: VisibleViewport = { top: 0, height: 0 };
let visibleViewport = UNKNOWN_VIEWPORT;

/** Reads the visible area, handing back the same object until it changes (what `useSyncExternalStore` needs). */
const readVisibleViewport = (): VisibleViewport => {
  const viewport = window.visualViewport;
  const top = viewport ? Math.round(viewport.offsetTop) : 0;
  const height = Math.round(viewport ? viewport.height : window.innerHeight);
  if (visibleViewport.top !== top || visibleViewport.height !== height) visibleViewport = { top, height };
  return visibleViewport;
};

/**
 * The area of the screen that is actually visible: it shrinks when the on-screen keyboard opens, and on iOS
 * it also slides down when the page is panned to keep the caret in view. A full-screen layer sized and
 * placed with this ends exactly where the keyboard starts, on iOS as well as on Android.
 */
export function useVisibleViewport(): VisibleViewport {
  return useSyncExternalStore(subscribeToViewport, readVisibleViewport, () => UNKNOWN_VIEWPORT);
}
