import type { ScheduledTask } from "./types";

export type CategoryShare = {
  category: string;
  minutes: number;
  count: number;
  done: number;
  /** A block of the category, for the color it shows (see `useCategoryColor`). */
  sample: ScheduledTask;
};

/** What each category takes of `tasks`, the biggest first. */
export function categoryBreakdown(tasks: ScheduledTask[]): CategoryShare[] {
  const byCategory = new Map<string, CategoryShare>();
  for (const task of tasks) {
    const share = byCategory.get(task.category) ?? {
      category: task.category,
      minutes: 0,
      count: 0,
      done: 0,
      sample: task,
    };
    share.minutes += task.durationMinutes;
    share.count += 1;
    if (task.completed) share.done += 1;
    byCategory.set(task.category, share);
  }
  return [...byCategory.values()].sort((a, b) => b.minutes - a.minutes || a.category.localeCompare(b.category));
}

/** "7a", "7:30p": a time short enough to sit in a narrow chip. */
export function shortTime(minutes: number): string {
  const total = ((minutes % 1440) + 1440) % 1440;
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}${minute ? `:${String(minute).padStart(2, "0")}` : ""}${hour >= 12 ? "p" : "a"}`;
}

/** 45 becomes "45m", 90 becomes "1.5h": hours once there is at least one, for compact totals. */
export function hoursLabel(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
}
