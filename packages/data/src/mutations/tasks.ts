import { formatTime, type ScheduledTask, type TaskDraft } from "@klndr/core";
import type { MutationOptions } from "@tanstack/react-query";
import { findTask, patchTask, removeTask, upsertTask } from "../cache";
import { newTempId, taskFromDraft, type MoveChanges } from "../blocks";
import { queryKeys } from "../keys";
import type { HistoryRecorder, MutationDeps } from "./types";

/**
 * Everything that changes a scheduled block.
 *
 * Moving, resizing, ticking, deleting and adding from an activity show on screen at once and are put back
 * if saving fails; saving from the editor waits for the server, because its form shows the error. All of
 * them share one `scope`, which makes TanStack Query run them one after another: the screen has already
 * moved on, so a quick drag followed by a tick has to reach the server in that order.
 */
export type TaskMutationDeps = MutationDeps & { history?: HistoryRecorder };

const SCOPE = { id: "tasks" } as const;
type Options<TData, TVars, TContext = unknown> = MutationOptions<TData, Error, TVars, TContext>;

const cancelTaskQueries = (d: TaskMutationDeps) => d.queryClient.cancelQueries({ queryKey: queryKeys.tasks.all });
/** Part of it may have saved, so ask the server rather than guess. */
const resync = (d: TaskMutationDeps) => d.queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });

// ---- Add a block from an activity, a quick add or the clock ----

export type CreateTaskVars = { draft: TaskDraft };

export const createTaskOptions = (d: TaskMutationDeps): Options<ScheduledTask, CreateTaskVars, { tempId: string }> => ({
  mutationKey: ["tasks", "create"],
  scope: SCOPE,
  mutationFn: ({ draft }) => d.api.createTask(draft),
  // Shown at once under a temporary id, then swapped for the saved block (or removed if saving fails).
  onMutate: async ({ draft }) => {
    await cancelTaskQueries(d);
    const tempId = newTempId();
    upsertTask(d.queryClient, taskFromDraft(draft, tempId));
    return { tempId };
  },
  onSuccess: (created, _vars, context) => {
    if (context) removeTask(d.queryClient, context.tempId);
    upsertTask(d.queryClient, created);
    d.history?.record(`Add ${created.title}`, [[null, created]]);
    d.notify(`Added ${created.title}`);
  },
  onError: (_error, _vars, context) => {
    if (context) removeTask(d.queryClient, context.tempId);
    d.notify("Could not save that block");
  },
});

// ---- Move a block, and with it the columns of its neighbours ----

export type MoveTaskVars = { task: ScheduledTask; start: number; changes: MoveChanges };
type Before = Map<string, ScheduledTask | undefined>;

export const moveTaskOptions = (d: TaskMutationDeps): Options<ScheduledTask[], MoveTaskVars, { before: Before }> => ({
  mutationKey: ["tasks", "move"],
  scope: SCOPE,
  mutationFn: ({ changes }) => Promise.all([...changes].map(([id, patch]) => d.api.updateTask(id, patch))),
  onMutate: async ({ changes }) => {
    await cancelTaskQueries(d);
    const before: Before = new Map();
    for (const [id, patch] of changes) {
      before.set(id, findTask(d.queryClient, id));
      patchTask(d.queryClient, id, patch);
    }
    return { before };
  },
  onSuccess: (_saved, { task, start, changes }, context) => {
    const pairs = [...changes].map(([id, patch]): [ScheduledTask | undefined, ScheduledTask | undefined] => {
      // A block that wasn't in the cache can't be undone, but the one that was dragged is always known.
      const was = context?.before.get(id) ?? (id === task.id ? task : undefined);
      return [was, was && { ...was, ...patch }];
    });
    d.history?.record(`Move ${task.title}`, pairs);
    d.notify(start !== task.startMinutes ? `${task.title} → ${formatTime(start)}` : `Moved ${task.title}`);
  },
  onError: (_error, _vars, context) => {
    for (const was of context?.before.values() ?? []) if (was) upsertTask(d.queryClient, was);
    d.notify("Could not move that block");
    void resync(d);
  },
});

// ---- Change the length of a block ----

export type ResizeTaskVars = { task: ScheduledTask; durationMinutes: number };

export const resizeTaskOptions = (d: TaskMutationDeps): Options<ScheduledTask, ResizeTaskVars, { before?: ScheduledTask }> => ({
  mutationKey: ["tasks", "resize"],
  scope: SCOPE,
  mutationFn: ({ task, durationMinutes }) => d.api.updateTask(task.id, { durationMinutes }),
  onMutate: async ({ task, durationMinutes }) => {
    await cancelTaskQueries(d);
    const before = findTask(d.queryClient, task.id);
    patchTask(d.queryClient, task.id, { durationMinutes });
    return { before };
  },
  onSuccess: (saved, { task }, context) => {
    d.history?.record(`Resize ${task.title}`, [[context?.before ?? task, saved]]);
  },
  onError: (_error, _vars, context) => {
    if (context?.before) upsertTask(d.queryClient, context.before);
    d.notify("Could not resize that block");
  },
});

// ---- Tick a block off, or reopen it ----

export type ToggleTaskVars = { task: ScheduledTask; completed: boolean };

export const toggleTaskOptions = (d: TaskMutationDeps): Options<ScheduledTask, ToggleTaskVars, { before?: ScheduledTask }> => ({
  mutationKey: ["tasks", "toggle"],
  scope: SCOPE,
  mutationFn: ({ task, completed }) => d.api.updateTask(task.id, { completed }),
  onMutate: async ({ task, completed }) => {
    await cancelTaskQueries(d);
    const before = findTask(d.queryClient, task.id);
    patchTask(d.queryClient, task.id, { completed });
    return { before };
  },
  onSuccess: (saved, { task, completed }, context) => {
    d.history?.record(`${completed ? "Complete" : "Reopen"} ${task.title}`, [[context?.before ?? task, saved]]);
  },
  onError: (_error, _vars, context) => {
    if (context?.before) upsertTask(d.queryClient, context.before);
    d.notify("Could not update that block");
  },
});

// ---- Delete a block ----

export type DeleteTaskVars = { task: ScheduledTask };

export const deleteTaskOptions = (d: TaskMutationDeps): Options<void, DeleteTaskVars, { before?: ScheduledTask }> => ({
  mutationKey: ["tasks", "delete"],
  scope: SCOPE,
  mutationFn: ({ task }) => d.api.deleteTask(task.id),
  onMutate: async ({ task }) => {
    await cancelTaskQueries(d);
    const before = findTask(d.queryClient, task.id);
    removeTask(d.queryClient, task.id);
    return { before };
  },
  onSuccess: (_void, { task }, context) => {
    d.history?.record(`Delete ${task.title}`, [[context?.before ?? task, null]]);
    d.notify(`Deleted ${task.title}`);
  },
  onError: (_error, _vars, context) => {
    if (context?.before) upsertTask(d.queryClient, context.before);
    d.notify("Could not delete that block");
  },
});

// ---- Save from the editor: waits for the server, so the form can show what went wrong ----

/** `id` is null for a new block. */
export type SaveTaskVars = { id: string | null; payload: TaskDraft };

export const saveTaskOptions = (d: TaskMutationDeps): Options<ScheduledTask, SaveTaskVars> => ({
  mutationKey: ["tasks", "save"],
  scope: SCOPE,
  mutationFn: ({ id, payload }) => (id ? d.api.updateTask(id, payload) : d.api.createTask(payload)),
  onSuccess: (saved, { id }) => {
    const previous = id ? findTask(d.queryClient, saved.id) : undefined;
    upsertTask(d.queryClient, saved);
    // An edit of a block that isn't in the cache can't be undone (there is no "before"), so it isn't recorded.
    if (!id) d.history?.record(`Add ${saved.title}`, [[null, saved]]);
    else if (previous) d.history?.record(`Edit ${saved.title}`, [[previous, saved]]);
    // A category typed in the editor may have just been created by the server.
    void d.queryClient.invalidateQueries({ queryKey: queryKeys.categories });
  },
});

export const taskMutationOptions = (d: TaskMutationDeps) => ({
  create: createTaskOptions(d),
  move: moveTaskOptions(d),
  resize: resizeTaskOptions(d),
  toggle: toggleTaskOptions(d),
  remove: deleteTaskOptions(d),
  save: saveTaskOptions(d),
});
