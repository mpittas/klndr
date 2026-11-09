import type { ChecklistItem, DayChecklist, DayChecklistItem, ScheduledTask } from "@klndr/core";

/** The numbers shown above a day's timeline. */
export type DayStats = {
  /** Minutes scheduled. */
  scheduled: number;
  count: number;
  done: number;
  /** [category, minutes], the longest first. */
  categories: [string, number][];
};

export function dayStats(tasks: ScheduledTask[]): DayStats {
  const byCategory = new Map<string, number>();
  for (const task of tasks) byCategory.set(task.category, (byCategory.get(task.category) ?? 0) + task.durationMinutes);
  return {
    scheduled: tasks.reduce((sum, task) => sum + task.durationMinutes, 0),
    count: tasks.length,
    done: tasks.filter((task) => task.completed).length,
    categories: [...byCategory.entries()].sort((a, b) => b[1] - a[1]),
  };
}

/** One day's checklist as the screen shows it. */
export type DayChecklistView = {
  /** The routines for this day: the defaults not skipped, then the one-offs. */
  items: DayChecklistItem[];
  /** Default routines skipped for this day, so they can be brought back. */
  skipped: ChecklistItem[];
  completedIds: string[];
  stats: { total: number; done: number; percentage: number };
  /** False when there is nothing to show at all (no routines and no one-offs). */
  hasChecklist: boolean;
};

export function buildDayChecklist(items: ChecklistItem[], day: DayChecklist): DayChecklistView {
  const hidden = new Set(day.hiddenItemIds);
  const defaults = items.filter((item) => !hidden.has(item.id)).map((item) => ({ ...item, scope: "default" as const }));
  // One-offs sort after every default routine, in the order they were added.
  const extras = day.extraItems.map((item, index) => ({
    ...item,
    order: Number.MAX_SAFE_INTEGER - day.extraItems.length + index,
    archived: false,
    scope: "day" as const,
  }));
  const shown = [...defaults, ...extras];
  const completed = new Set(day.completedItemIds);
  const done = shown.filter((item) => completed.has(item.id)).length;
  return {
    items: shown,
    skipped: items.filter((item) => hidden.has(item.id)),
    completedIds: day.completedItemIds,
    stats: { total: shown.length, done, percentage: shown.length === 0 ? 0 : Math.round((done / shown.length) * 100) },
    hasChecklist: items.length > 0 || day.extraItems.length > 0,
  };
}

/** What a day has before anything is known about it. */
export const emptyDayChecklist = (day: string): DayChecklist => ({
  day,
  completedItemIds: [],
  hiddenItemIds: [],
  extraItems: [],
});
