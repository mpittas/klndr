import { useCallback, useSyncExternalStore } from "react";

/** How the block editor opens from `sm` up: a centred dialog, or a drawer on the right (Notion's "side peek"). */
export type EditorLayout = "center" | "side";

const STORAGE_KEY = "klndr-editor-layout";
/** Told to every reader in this tab when the default changes (the `storage` event covers other tabs). */
const CHANGE_EVENT = "klndr-editor-layout-change";

const read = (): EditorLayout => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "side" ? "side" : "center";
  } catch {
    return "center";
  }
};

const subscribe = (onChange: () => void) => {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
};

/**
 * The layout the block editor opens in by default, chosen under Profile & settings > Appearance and kept in this
 * browser (it is about this screen, so it does not follow the account to a phone). Every reader updates at once
 * when it changes. The switch inside an open editor changes that editor only.
 */
export function useDefaultEditorLayout(): [EditorLayout, (next: EditorLayout) => void] {
  const layout = useSyncExternalStore(subscribe, read, () => "center" as const);

  const change = useCallback((next: EditorLayout) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage full or blocked: nothing to keep it in, so the default stays as it was.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return [layout, change];
}
