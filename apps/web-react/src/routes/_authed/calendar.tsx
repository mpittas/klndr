import { isValidISODate, monthRange, todayISO, type ScheduledTask } from "@klndr/core";
import { useRangeTasks } from "@klndr/data";
import { createFileRoute } from "@tanstack/react-router";

import { MonthView } from "@/components/MonthView";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const NO_TASKS: ScheduledTask[] = [];

/**
 * The month comes from `?m=` (a full date, or `YYYY-MM` from the month picker), and the blocks for the
 * month come from `@klndr/data`'s range query, which holds the previous range on screen while the next
 * one loads.
 */
export const Route = createFileRoute("/_authed/calendar")({
  validateSearch: (search: Record<string, unknown>): { m?: string } => ({
    m: typeof search.m === "string" ? search.m : undefined,
  }),
  component: CalendarPage,
});

function CalendarPage() {
  useDocumentTitle("klndr. · Day planner");

  const { m } = Route.useSearch();
  const today = todayISO();

  const month = !m ? today : isValidISODate(m) ? m : /^\d{4}-\d{2}$/.test(m) ? `${m}-01` : today;
  const range = monthRange(month);

  const { data } = useRangeTasks(range.from, range.to);

  return <MonthView month={month} tasks={data ?? NO_TASKS} />;
}
