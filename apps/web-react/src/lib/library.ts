import { useSyncExternalStore } from "react";

/**
 * Open state of the one dialog for managing activities and categories, and what it should do as it opens.
 * The activity palette, the category picker, the block editor and the phones' nav all read and change the
 * same one, so a small external store keeps that without threading a provider through every screen (the
 * dialog itself is portalled to `<body>`).
 */
export type LibraryFocus =
  | { kind: "new-activity" }
  | { kind: "new-category" }
  | { kind: "edit"; id: string }
  | null;

/** `request` counts the times the dialog was asked to open, so each ask can start a fresh panel. */
type LibraryState = { open: boolean; focus: LibraryFocus; request: number };

let state: LibraryState = { open: false, focus: null, request: 0 };
const listeners = new Set<() => void>();

const set = (next: LibraryState) => {
  state = next;
  for (const listener of listeners) listener();
};

// A new object only when something changed, so `useSyncExternalStore` settles.
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getSnapshot = () => state;

/** Open the dialog, optionally asking it to start on something specific. */
export const showLibrary = (focus: LibraryFocus = null) => set({ open: true, focus, request: state.request + 1 });

export const hideLibrary = () => set({ ...state, open: false, focus: null });

/** Whatever is on screen reads the same open state and asks for the same dialog. */
export function useLibrary() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    open: snapshot.open,
    focus: snapshot.focus,
    request: snapshot.request,
    show: showLibrary,
    hide: hideLibrary,
  };
}
