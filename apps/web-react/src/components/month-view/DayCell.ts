import type { ScheduledTask } from "@klndr/core";

/** One cell of the month grid, built by `MonthView` and drawn by `MonthGrid`. */
export type DayCell = {
  iso: string;
  dayNumber: number;
  inMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  isWeekend: boolean;
  visible: ScheduledTask[];
  hidden: number;
  /** Planned time of the day, as text (`"3h 45m"`); empty when nothing is planned. */
  total: string;
  /** How many of the day's blocks are done, out of how many. */
  done: number;
  count: number;
  label: string;
};
