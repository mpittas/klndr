import type { ActivityTemplate, ScheduledTask, TaskDraft } from "@klndr/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { draftFromTemplate, planMove } from "../blocks";
import { queryKeys } from "../keys";
import { taskMutationOptions, type SaveTaskVars } from "../mutations/tasks";
import { useData } from "../provider";
import { useTimelineHistory } from "./history";
import { useCategoryColor, useDayTasks } from "./queries";

const NO_TASKS: ScheduledTask[] = [];
/** The mutations report failure through `notify`; the caller of these has nothing more to do about it. */
const handled = (promise: Promise<unknown>): Promise<void> => promise.then(() => undefined, () => undefined);

/**
 * Everything a screen needs to show and change one day's timeline: the blocks, and what can be done with
 * them. Changes appear at once and are put back if saving fails (with a message through `notify`); each
 * successful one can be undone. This is the data half of the day planner; the views, and how a drag is
 * read off the screen, are the app's own.
 */
export function useDayTimeline(day: string) {
  const { api, notify } = useData();
  const queryClient = useQueryClient();
  const query = useDayTasks(day);
  const colorOf = useCategoryColor();
  const { history, canUndo, canRedo, undo, redo } = useTimelineHistory(day);

  const options = useMemo(
    () => taskMutationOptions({ api, queryClient, notify, history }),
    [api, queryClient, notify, history],
  );
  const { mutateAsync: create } = useMutation(options.create);
  const { mutateAsync: move } = useMutation(options.move);
  const { mutateAsync: resize } = useMutation(options.resize);
  const { mutateAsync: toggle } = useMutation(options.toggle);
  const { mutateAsync: remove } = useMutation(options.remove);
  const { mutateAsync: save, isPending: isSaving } = useMutation(options.save);

  const tasksNow = useCallback(
    () => queryClient.getQueryData<ScheduledTask[]>(queryKeys.tasks.day(day)) ?? NO_TASKS,
    [queryClient, day],
  );

  /** Add a block made from an activity, starting at `startMinutes`. */
  const createFromTemplate = useCallback(
    (template: ActivityTemplate, startMinutes: number) =>
      handled(create({ draft: draftFromTemplate(day, template, startMinutes, colorOf(template)) })),
    [create, day, colorOf],
  );

  /** Add a block from a draft, with no editor in between. */
  const addTask = useCallback((draft: TaskDraft) => handled(create({ draft })), [create]);

  /**
   * Move a block to `start`. `lanes` is what the layout code says about the columns of the blocks beside
   * it when it landed (see `lanesFor`); neighbours whose column changed are saved with it.
   */
  const moveTask = useCallback(
    (task: ScheduledTask, start: number, lanes?: Map<string, number>) => {
      const changes = planMove(tasksNow(), task, start, lanes);
      return changes.size ? handled(move({ task, start, changes })) : Promise.resolve();
    },
    [move, tasksNow],
  );

  const resizeTask = useCallback(
    (task: ScheduledTask, durationMinutes: number) =>
      durationMinutes === task.durationMinutes ? Promise.resolve() : handled(resize({ task, durationMinutes })),
    [resize],
  );

  const toggleComplete = useCallback(
    (task: ScheduledTask) => handled(toggle({ task, completed: !task.completed })),
    [toggle],
  );

  const deleteTask = useCallback((task: ScheduledTask) => handled(remove({ task })), [remove]);

  /** Save from the editor: waits for the server, and throws its message so the form can show it. */
  const saveTask = useCallback((vars: SaveTaskVars) => save(vars), [save]);

  /** Ask the server again, and say how it went. */
  const refresh = useCallback(async () => {
    const result = await query.refetch();
    notify(result.isError ? "Could not refresh" : "Updated");
  }, [query, notify]);

  return {
    day,
    /** The blocks of the day in start order; empty while loading (see `query`). */
    tasks: query.data ?? NO_TASKS,
    query,
    canUndo,
    canRedo,
    undo,
    redo,
    createFromTemplate,
    addTask,
    moveTask,
    resizeTask,
    toggleComplete,
    deleteTask,
    saveTask,
    isSaving,
    refresh,
  };
}
