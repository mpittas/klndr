import { useEffect, useEffectEvent } from "react";

export type PlannerShortcuts = {
  previous: () => void;
  next: () => void;
  today: () => void;
  create: () => void;
  goTo: () => void;
  toggleSidebar?: () => void;
};

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/**
 * The keys every planner view answers to, the same on the month, the week and the day: ← and → page the
 * period, T comes back to today, N adds a block, G opens the date picker and \ shows or hides the sidebar.
 *
 * Left alone while typing, while a dialog is open (`paused`), inside a menu, and when something on the page has
 * already handled the key.
 */
export function usePlannerShortcuts(shortcuts: PlannerShortcuts, paused: boolean) {
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (paused || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTyping(event.target)) return;
    if (event.target instanceof Element && event.target.closest("[role='menu'], [role='dialog']")) return;

    const actions: Record<string, (() => void) | undefined> = {
      ArrowLeft: shortcuts.previous,
      ArrowRight: shortcuts.next,
      t: shortcuts.today,
      n: shortcuts.create,
      g: shortcuts.goTo,
      "\\": shortcuts.toggleSidebar,
    };
    const action = actions[event.key.length === 1 ? event.key.toLowerCase() : event.key];
    if (!action) return;
    event.preventDefault();
    action();
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
}
