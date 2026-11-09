import { DAY_MINUTES, DEFAULT_SCROLL_MINUTES, minutesToPx, nowMinutes, snapMinutes, type ScheduledTask } from "@dayro/core";

/** Where a day's planning starts when nothing says otherwise. */
const MORNING = 9 * 60;
/** Room left above the first block when a timeline opens on it. */
const LEAD = 24;
/** How far down the visible timeline the now line sits when a timeline opens on now. */
const NOW_AT = 0.3;

/**
 * Where a block of `duration` minutes goes on `day` when no time was given (an activity dropped on a day of the
 * month, or clicked on the week or the month): after the day's last block, but not before 9 AM (or now, today),
 * on a quarter hour, and never running past midnight.
 */
export function nextFreeStart(dayTasks: ScheduledTask[], day: string, today: string, duration: number): number {
  const floor = day === today ? Math.max(MORNING, snapMinutes(nowMinutes(), 15)) : MORNING;
  const lastEnd = dayTasks.reduce((end, task) => Math.max(end, task.startMinutes + task.durationMinutes), 0);
  const start = Math.ceil(Math.max(floor, lastEnd) / 15) * 15;
  return Math.max(0, Math.min(start, DAY_MINUTES - duration));
}

/**
 * Scrolls a timeline (the week's or the day's) to where it is useful to open: on today, the current time, a third
 * of the way down so what just happened and what comes next are both in view; on any other period, its first
 * block (or 7 AM), just under the top. The timeline is the `[data-timeline-grid]` inside `container`, and a sticky
 * `[data-timeline-header]` (the week's row of days) is allowed for. (The router's own scroll restoration is off for
 * the planner, see `router.tsx`, so nothing puts an old position back over this.)
 */
export function scrollTimeline(
  container: HTMLElement,
  options: { nowMinute: number | null; tasks: readonly Pick<ScheduledTask, "startMinutes">[] },
) {
  const grid = container.querySelector<HTMLElement>("[data-timeline-grid]");
  if (!grid) return;
  const header = container.querySelector<HTMLElement>("[data-timeline-header]")?.offsetHeight ?? 0;
  const gridTop = grid.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
  const visible = container.clientHeight - header;

  const first = options.tasks.reduce<number | null>(
    (min, task) => (min === null ? task.startMinutes : Math.min(min, task.startMinutes)),
    null,
  );
  const minute = options.nowMinute ?? first ?? DEFAULT_SCROLL_MINUTES;
  const lead = options.nowMinute !== null ? visible * NOW_AT : LEAD;
  container.scrollTop = Math.max(0, gridTop + minutesToPx(minute) - header - lead);
}

/**
 * On a screen too narrow for the week (it scrolls sideways), brings column `index` of `count` in view, right after
 * the sticky hour gutter.
 */
export function scrollToColumn(container: HTMLElement, index: number, count: number) {
  if (container.scrollWidth <= container.clientWidth) return;
  const grid = container.querySelector<HTMLElement>("[data-timeline-grid]");
  if (!grid) return;
  container.scrollLeft = (grid.getBoundingClientRect().width / count) * index;
}
