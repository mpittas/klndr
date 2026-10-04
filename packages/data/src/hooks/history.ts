import { TimelineHistory, type ScheduledTask } from "@klndr/core";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useSyncExternalStore } from "react";
import { queryKeys } from "../keys";
import { useData } from "../provider";

/**
 * Undo and redo of what was done on one day's timeline (the `TimelineHistory` engine of `@klndr/core`,
 * reading and writing the blocks in the query cache). Undo only reaches back over the day on screen: a
 * different day starts a fresh history, as it always has.
 */
export function useTimelineHistory(day: string) {
  const { api, notify } = useData();
  const queryClient = useQueryClient();

  // The engine is built once per day but reads the latest client and notifier when it runs.
  const latest = useRef({ queryClient, notify });
  latest.current = { queryClient, notify };

  const holder = useRef<{ day: string; history: TimelineHistory } | null>(null);
  if (holder.current?.day !== day) {
    holder.current = {
      day,
      history: new TimelineHistory({
        api,
        getTasks: () => latest.current.queryClient.getQueryData<ScheduledTask[]>(queryKeys.tasks.day(day)) ?? [],
        setTasks: (tasks) => latest.current.queryClient.setQueryData(queryKeys.tasks.day(day), tasks),
        day: () => day,
        notify: (message) => latest.current.notify(message),
      }),
    };
  }
  const history = holder.current.history;

  const subscribe = useCallback((onChange: () => void) => history.subscribe(() => onChange()), [history]);
  const canUndo = useSyncExternalStore(subscribe, () => history.canUndo, () => false);
  const canRedo = useSyncExternalStore(subscribe, () => history.canRedo, () => false);

  // The engine edits this day's list; month grids that show these blocks are fetched again afterwards.
  const settle = useCallback(
    () => void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.ranges }),
    [queryClient],
  );
  const undo = useCallback(() => history.undo().then(settle), [history, settle]);
  const redo = useCallback(() => history.redo().then(settle), [history, settle]);

  return { history, canUndo, canRedo, undo, redo };
}
