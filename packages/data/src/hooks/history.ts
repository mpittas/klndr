import type { HistoryDirection } from "@klndr/core";
import { useMutation, useQueryClient, type Mutation } from "@tanstack/react-query";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { historyStepOptions } from "../mutations/tasks";
import { useData } from "../provider";

/** A change to blocks still on its way to the server (not an undo or redo step, which never adds a step). */
const isPendingChange = (mutation: Mutation<unknown, Error, unknown, unknown>) => {
  const [root, kind] = mutation.options.mutationKey ?? [];
  return root === "tasks" && kind !== "history";
};

/**
 * Undo and redo of what was done to blocks (the `TimelineHistory` engine of `@klndr/core`, over the query
 * cache). There is one history for the person, kept by the provider, so every screen records into and undoes
 * from the same one: the day, the week, the month and the editor over them, and moving between days or views
 * keeps it.
 */
export function useTimelineHistory() {
  const { api, notify, history } = useData();
  const queryClient = useQueryClient();

  const subscribe = useCallback((onChange: () => void) => history.subscribe(() => onChange()), [history]);
  const canUndo = useSyncExternalStore(subscribe, () => history.canUndo, () => false);
  const canRedo = useSyncExternalStore(subscribe, () => history.canRedo, () => false);

  const options = useMemo(() => historyStepOptions({ api, queryClient, notify }, history), [api, queryClient, notify, history]);
  const { mutateAsync: runStep } = useMutation(options);

  // A change is put on the history once the server has it, so a quick Ctrl+Z straight after one would miss it
  // (or undo the step before it). Wait for the changes still in flight; they show on screen at once, so this is
  // short. Undo and redo steps themselves are not waited for: pressing undo three times shows three steps at once.
  const saved = useCallback(
    () =>
      new Promise<void>((resolve) => {
        const cache = queryClient.getMutationCache();
        const check = () => {
          if (queryClient.isMutating({ predicate: isPendingChange }) > 0) return false;
          unsubscribe();
          resolve();
          return true;
        };
        const unsubscribe = cache.subscribe(() => void check());
        check();
      }),
    [queryClient],
  );

  const step = useCallback(
    async (direction: HistoryDirection) => {
      await saved();
      const next = history.take(direction);
      // A step that fails says so and starts the history afresh (`TimelineHistory.failed`); nothing to throw.
      if (next) await runStep(next).catch(() => undefined);
    },
    [saved, history, runStep],
  );
  const undo = useCallback(() => step("undo"), [step]);
  const redo = useCallback(() => step("redo"), [step]);

  return { history, canUndo, canRedo, undo, redo };
}
