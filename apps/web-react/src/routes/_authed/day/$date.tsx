import { isValidISODate, todayISO } from "@klndr/core";
import { useDayTasks, usePrefetchAroundDay, useTemplates } from "@klndr/data";
import { createFileRoute } from "@tanstack/react-router";

import { DayPlanner } from "@/components/DayPlanner";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

/**
 * The shell of the day page: the date comes from the path, the day's blocks and the activity templates
 * come from `@klndr/data`, and there are three states: a skeleton while they load, the "we couldn't load
 * this day" card with a retry if either fails, and the planner once both are in.
 *
 * `DayPlanner` runs the checklist and notes hooks itself, and each of its panels has its own loading and
 * error state, so the shell only waits for the two things the timeline cannot be drawn without.
 */
export const Route = createFileRoute("/_authed/day/$date")({
  component: DayPage,
});

function DayPage() {
  const { date } = Route.useParams();
  const day = isValidISODate(date) ? date : todayISO();
  useDocumentTitle(`Plan · ${day}`);

  const tasks = useDayTasks(day);
  const templates = useTemplates();

  const failed = tasks.isError || templates.isError;
  const ready = tasks.data !== undefined && templates.data !== undefined;

  // Neighbouring days load in the background once this one has, so stepping to them is instant.
  usePrefetchAroundDay(day, ready);

  const retry = () => {
    void tasks.refetch();
    void templates.refetch();
  };

  if (failed) {
    return (
      <div className="mx-auto mt-16 max-w-sm px-4 text-center">
        <p className="text-sm font-medium text-foreground">We couldn't load this day.</p>
        <p className="mt-1 text-xs text-muted-foreground">Check your connection and try again.</p>
        <button
          type="button"
          onClick={retry}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="mx-auto mt-10 w-full max-w-5xl space-y-3 px-4" aria-busy="true">
        <div className="h-10 animate-pulse rounded-xl bg-muted" />
        <div className="h-96 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  return <DayPlanner day={day} />;
}
