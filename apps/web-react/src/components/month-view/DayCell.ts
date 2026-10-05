import type { ScheduledTask } from "@klndr/core";

/** One cell of the month grid, built by `MonthView` and drawn by `MonthGrid`. */
export type DayCell = {
  iso: string;
  dayNumber: number;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isWeekend: boolean;
  visible: ScheduledTask[];
  hidden: number;
  total: string;
  label: string;
};
