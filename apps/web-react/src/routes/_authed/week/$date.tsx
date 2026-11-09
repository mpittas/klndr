import { isValidISODate, todayISO, weekDays, type ScheduledTask } from "@dayro/core";
import { useRangeTasks } from "@dayro/data";
import { createFileRoute } from "@tanstack/react-router";

import { WeekView } from "@/components/WeekView";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useWeekStartsOnMonday } from "@/hooks/useWeekStart";

const NO_TASKS: ScheduledTask[] = [];

/**
 * The week a date falls in (`/week/<any day of it>`), starting on the day the profile says (Monday unless set
 * otherwise). Its blocks come from `@dayro/data`'s range query, which keeps the previous week on screen while
 * the next one loads, so paging weeks never flashes empty.
 */
export const Route = createFileRoute("/_authed/week/$date")({
  component: WeekPage,
});

function WeekPage() {
  const { date } = Route.useParams();
  const anchor = isValidISODate(date) ? date : todayISO();
  const days = weekDays(anchor, useWeekStartsOnMonday());
  useDocumentTitle(`Week · ${days[0]}`);

  const { data, isError, refetch } = useRangeTasks(days[0], days[6]);

  if (isError && !data) {
    return (
      <div className="mx-auto mt-16 max-w-sm px-4 text-center">
        <p className="text-sm font-medium text-foreground">We couldn't load this week.</p>
        <p className="mt-1 text-[13px] text-muted-foreground">Check your connection and try again.</p>
        <button type="button" onClick={() => void refetch()} className="btn btn-primary btn-sm mt-4">
          Try again
        </button>
      </div>
    );
  }

  return <WeekView days={days} tasks={data ?? NO_TASKS} loading={!data} />;
}
