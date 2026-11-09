import type { ScheduledTask, TaskDraft } from "@klndr/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { taskMutationOptions } from "../mutations/tasks";
import { useData } from "../provider";

/**
 * Changing blocks from a screen that isn't a day's timeline (the week, the month and its agenda): tick one off,
 * save one from the editor, delete one. Changes show at once in every list that holds the block and are put
 * back if saving fails; like `useDayTimeline`'s, each one can be undone (see `useTimelineHistory`).
 */
export function useTaskActions() {
  const { api, notify, history } = useData();
  const queryClient = useQueryClient();
  const options = useMemo(
    () => taskMutationOptions({ api, queryClient, notify, history }),
    [api, queryClient, notify, history],
  );

  const { mutateAsync: toggle } = useMutation(options.toggle);
  const { mutateAsync: remove } = useMutation(options.remove);
  const { mutateAsync: save } = useMutation(options.save);
  const { mutateAsync: change } = useMutation(options.change);

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
    /**
     * Change some fields of a block at once (its day and start, say, when it is dragged to another day), put back
     * if saving fails. Never throws.
     */
    changeTask: useCallback(
      (task: ScheduledTask, changes: Partial<TaskDraft>, message?: string) =>
        change({ task, changes, message }).then(
          () => undefined,
          () => undefined,
        ),
      [change],
    ),
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
