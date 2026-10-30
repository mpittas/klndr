import { TimelineHistory, type ScheduledTask } from "@klndr/core";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import { queryKeys } from "../keys";
import { useData } from "../provider";

/**
 * Undo and redo of what was done on one day's timeline (the `TimelineHistory` engine of `@klndr/core`,
 * reading and writing the blocks in the query cache). Undo only reaches back over the day on screen: a
 * different day starts a fresh history, as it always has.
 */
export function useTimelineHistory(day: string) {
  const { api, notify, histories } = useData();
  const queryClient = useQueryClient();

  // One history per day on screen, kept in the provider rather than in this hook, so a screen opened over the
  // timeline (the editor) shares it with the timeline. A different day starts a fresh one.
  if (histories.current?.day !== day) {
    histories.current = {
      day,
      history: new TimelineHistory({
        api,
        getTasks: () => queryClient.getQueryData<ScheduledTask[]>(queryKeys.tasks.day(day)) ?? [],
        setTasks: (tasks) => queryClient.setQueryData(queryKeys.tasks.day(day), tasks),
        day: () => day,
        notify,
      }),
    };
  }
  const history = histories.current.history;

  const subscribe = useCallback((onChange: () => void) => history.subscribe(() => onChange()), [history]);
  const canUndo = useSyncExternalStore(subscribe, () => history.canUndo, () => false);
  const canRedo = useSyncExternalStore(subscribe, () => history.canRedo, () => false);

  // The engine edits this day's list; month grids that show these blocks are fetched again afterwards.
  const settle = useCallback(
    () => void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.ranges }),
    [queryClient],
  );
  // A change is put on the history once the server has it, so a quick Ctrl+Z straight after one would miss it
  // (or undo the step before it). Wait for the saves still in flight; they show on screen at once, so this is short.
  const saved = useCallback(
    () =>
      new Promise<void>((resolve) => {
        const cache = queryClient.getMutationCache();
        const check = () => {
          if (queryClient.isMutating({ mutationKey: ["tasks"] }) > 0) return false;
          unsubscribe();
          resolve();
          return true;
        };
        const unsubscribe = cache.subscribe(() => void check());
        check();
      }),
    [queryClient],
  );
  const undo = useCallback(() => saved().then(() => history.undo()).then(settle), [saved, history, settle]);
  const redo = useCallback(() => saved().then(() => history.redo()).then(settle), [saved, history, settle]);

  return { history, canUndo, canRedo, undo, redo };
}
