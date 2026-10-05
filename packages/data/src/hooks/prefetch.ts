import { addDaysISO, type ApiClient, type ScheduledTask } from "@klndr/core";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { byStart } from "../cache";
import { queryKeys } from "../keys";
import { useData } from "../provider";
import { dayChecklistQuery, dayNotesQuery, rangeTasksQuery } from "./queries";

/** How many days either side of the one on screen get their blocks loaded ahead of time. */
const TASK_RADIUS = 3;
/** The checklist and the notes are one request per day, so fewer of them. */
const DETAIL_RADIUS = 2;
/** Let the day on screen finish loading before anything else asks for the network. */
const START_DELAY_MS = 300;
const CONCURRENCY = 2;

/** The days either side of `day`, nearest first: the next day, the one before, then two over, and so on. */
const around = (day: string, radius: number) =>
  Array.from({ length: radius }, (_, i) => [i + 1, -(i + 1)])
    .flat()
    .map((offset) => addDaysISO(day, offset));

/** How long a day's list counts as fresh, the same as `createQueryClient`'s `staleTime`. */
const FRESH_MS = 30_000;

/**
 * One request for the blocks of the days around `day` that are not loaded yet (or are stale), stored as
 * each day's own list so that stepping to a neighbour needs no request at all. Nothing is stored if a change
 * was being saved meanwhile: the answer may predate it, and the day simply loads when opened.
 */
async function prefetchTasks(qc: QueryClient, api: ApiClient, day: string) {
  const days = [day, ...around(day, TASK_RADIUS)].sort();
  const missing = days.filter((date) => {
    const state = qc.getQueryState(queryKeys.tasks.day(date));
    return !state?.dataUpdatedAt || Date.now() - state.dataUpdatedAt > FRESH_MS;
  });
  if (!missing.length) return;

  const from = missing[0]!;
  const to = missing[missing.length - 1]!;
  const tasks = await qc.fetchQuery({ ...rangeTasksQuery(api, from, to), staleTime: 0 });
  // Only here to carry the answer: each day gets its own list below, and the range would just be one more
  // list for every edit to keep in step.
  qc.removeQueries({ queryKey: queryKeys.tasks.range(from, to), exact: true });
  if (qc.isMutating() > 0) return;
  for (const date of missing) {
    qc.setQueryData(
      queryKeys.tasks.day(date),
      tasks.filter((task: ScheduledTask) => task.day === date).sort(byStart),
    );
  }
}

/**
 * Switching to a neighbouring day is instant: while `day` is on screen, the blocks, the checklist and the
 * notes of the days around it are loaded quietly in the background. Each is only fetched when it is missing
 * or stale, so stepping one day over costs a request or two, not a whole week.
 */
export function usePrefetchAroundDay(day: string, enabled = true) {
  const { api } = useData();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const detail = around(day, DETAIL_RADIUS);
    const jobs: Array<() => Promise<unknown>> = [
      () => prefetchTasks(queryClient, api, day),
      ...detail.flatMap((date) => [
        () => queryClient.prefetchQuery(dayChecklistQuery(api, date)),
        () => queryClient.prefetchQuery(dayNotesQuery(api, date)),
      ]),
    ];

    const worker = async () => {
      for (let job = jobs.shift(); job && !cancelled; job = jobs.shift()) {
        await job().catch(() => undefined); // best effort: opening the day will ask again
      }
    };
    const timer = setTimeout(() => void Promise.all(Array.from({ length: CONCURRENCY }, worker)), START_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [api, queryClient, day, enabled]);
}
