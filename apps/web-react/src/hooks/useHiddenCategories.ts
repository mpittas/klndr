import { useCallback, useSyncExternalStore } from "react";

const KEY = "klndr.hidden-categories";
const NONE: string[] = [];
const listeners = new Set<() => void>();

// The parsed list is kept with the text it came from, so `getSnapshot` returns the same array until it changes.
let cache: { raw: string | null; value: string[] } = { raw: null, value: NONE };

const read = (): string[] => {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return cache.value;
  }
  if (raw === cache.raw) return cache.value;
  let value = NONE;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) value = parsed.filter((item): item is string => typeof item === "string");
  } catch {
    value = NONE;
  }
  cache = { raw, value };
  return value;
};

const write = (value: string[]) => {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Storage blocked: keep it for this page at least.
    cache = { raw: cache.raw, value };
  }
  for (const listener of listeners) listener();
};

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
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
 * The categories hidden from the planner (the toolbar's Categories control), like a calendar app's "My calendars"
 * check boxes: one setting for the month, the week and the day, kept per browser, so a category hidden on one
 * view stays hidden on the others. Nothing hidden unless something was.
 */
export function useHiddenCategories() {
  const hidden = useSyncExternalStore(subscribe, read, () => NONE);

  const toggle = useCallback((category: string) => {
    const current = read();
    write(current.includes(category) ? current.filter((name) => name !== category) : [...current, category]);
  }, []);
  /** Show only `category`: every other one of `all` is hidden. */
  const only = useCallback((category: string, all: string[]) => write(all.filter((name) => name !== category)), []);
  const showAll = useCallback(() => write(NONE), []);

  return { hidden, toggle, only, showAll };
}
