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
