import type { ActivityTemplate, ScheduledTask, TaskDraft } from "@klndr/core";

/** What a block made from an activity starts as. `color` is the activity's category color. */
export function draftFromTemplate(
  day: string,
  template: ActivityTemplate,
  startMinutes: number,
  color: string,
): TaskDraft {
  return {
    day,
    templateId: template.id,
    title: template.name,
    category: template.category,
    color,
    emoji: template.emoji,
    startMinutes,
    durationMinutes: template.defaultDuration,
    notes: template.notes ?? "",
    completed: false,
  };
}

/** A draft as the block it will become, under an id of the caller's choosing. */
export function taskFromDraft(draft: TaskDraft, id: string): ScheduledTask {
  const { templateId, notes, completed, ...rest } = draft;
  return { ...rest, id, templateId: templateId ?? null, notes: notes ?? null, completed: completed ?? false };
}

/** A made-up id for a block that is on screen before the server has saved it. */
export const newTempId = () => `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const isTempId = (id: string) => id.startsWith("pending-");

/** What changes about a block, by id. `lane` is a column among the blocks it shares time with. */
export type MoveChanges = Map<string, { startMinutes?: number; lane?: number }>;

/**
 * What moving `task` to `start` changes: its own start time, and the columns of any blocks that end up
 * somewhere else because of where it landed (`lanes` comes from the layout code). Empty means nothing to
 * save. Read `tasks` as they were before the move, since a lane only counts when it differs from the
 * current one.
 */
export function planMove(
  tasks: ScheduledTask[],
  task: ScheduledTask,
  start: number,
  lanes?: Map<string, number>,
): MoveChanges {
  const changes: MoveChanges = new Map();
  if (start !== task.startMinutes) changes.set(task.id, { startMinutes: start });
  for (const [id, lane] of lanes ?? []) {
    if (tasks.find((item) => item.id === id)?.lane !== lane) changes.set(id, { ...changes.get(id), lane });
  }
  return changes;
}
