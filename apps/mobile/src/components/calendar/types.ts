import type { ScheduledTask } from "@klndr/core";

/** One cell of the month grid, built by the Calendar screen and drawn by `MonthGrid`. */
export type DayCell = {
  iso: string;
  dayNumber: number;
  inMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  isWeekend: boolean;
  /** The day's blocks, in start order. */
  tasks: ScheduledTask[];
  /** How many of the day's blocks are done, out of how many. */
  done: number;
  count: number;
  /** What a screen reader says for the whole cell. */
  label: string;
};
