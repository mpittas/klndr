import { useTimelineHistory } from "@klndr/data";
import { useEffect, useEffectEvent } from "react";

/**
 * Ctrl+Z undoes; Ctrl+Shift+Z or Ctrl+Y redoes (Cmd on a Mac). The same on the day, the week and the month,
 * which share one history (see `useTimelineHistory`), so a change made on one can be undone from another.
 *
 * Left alone while typing (a field has its own undo) and while a dialog is open (`paused`).
 */
export function useUndoShortcuts(paused: boolean) {
  const { undo, redo } = useTimelineHistory();

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    // By letter where the layout has Latin letters, otherwise by key position (e.g. a Greek layout).
    const key = /^[a-z]$/i.test(event.key) ? event.key.toLowerCase() : event.code.replace(/^Key/, "").toLowerCase();
    const isUndo = key === "z" && !event.shiftKey;
    const isRedo = (key === "z" && event.shiftKey) || (key === "y" && !event.shiftKey);
    if (!isUndo && !isRedo) return;
    if (paused) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='dialog']")) return;
    event.preventDefault();
    if (isUndo) void undo();
    else void redo();
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
}
