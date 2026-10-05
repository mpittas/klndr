import type { ScheduledTask } from "@klndr/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { taskMutationOptions } from "../mutations/tasks";
import { useData } from "../provider";

/**
 * Changing blocks from a screen that isn't a day's timeline (the month view and its agenda): tick one off,
 * save one from the editor, delete one. Changes show at once in every list that holds the block and are put
 * back if saving fails; unlike `useDayTimeline` there is no undo history to record into.
 */
export function useTaskActions() {
  const { api, notify } = useData();
  const queryClient = useQueryClient();
  const options = useMemo(() => taskMutationOptions({ api, queryClient, notify }), [api, queryClient, notify]);

  const { mutateAsync: toggle } = useMutation(options.toggle);
  const { mutateAsync: remove } = useMutation(options.remove);
  const { mutateAsync: save } = useMutation(options.save);

  return {
    /** Tick a block off, or reopen it. Never throws: a failure is put back and reported. */
    toggleComplete: useCallback(
      (task: ScheduledTask) =>
        toggle({ task, completed: !task.completed }).then(
          () => undefined,
          () => undefined,
        ),
      [toggle],
    ),
    /** Create (`id: null`) or edit a block; waits for the server and throws its message, so a form can show it. */
    saveTask: save,
    /** Resolves to whether the block was deleted; a failure is put back and reported. */
    deleteTask: useCallback(
      (task: ScheduledTask) =>
        remove({ task }).then(
          () => true,
          () => false,
        ),
      [remove],
    ),
  };
}
