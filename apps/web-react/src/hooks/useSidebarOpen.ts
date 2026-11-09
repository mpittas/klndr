import { useCallback, useSyncExternalStore } from "react";

const KEY = "dayro.planner-sidebar";
const listeners = new Set<() => void>();

const read = (): boolean => {
  try {
    return window.localStorage.getItem(KEY) !== "closed";
  } catch {
    return true;
  }
};

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  // Another tab changing it.
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
};

/**
 * Whether the planner's sidebar is shown (from `lg` up). One setting for the month, the week and the day, kept
 * per browser, so hiding it on one view hides it on all of them. Open unless it was closed.
 */
export function useSidebarOpen() {
  const open = useSyncExternalStore(subscribe, read, () => true);

  const toggle = useCallback(() => {
    try {
      window.localStorage.setItem(KEY, read() ? "closed" : "open");
    } catch {
      // Storage blocked: nothing to remember it in, so it stays as it is.
    }
    for (const listener of listeners) listener();
  }, []);

  return { open, toggle };
}
