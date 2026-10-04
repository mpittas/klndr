import type { ActivityTemplate, Category, ScheduledTask } from "@klndr/core";
import { compareCategoriesByName } from "@klndr/core";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { queryKeys } from "./keys";

/**
 * Helpers that edit what is already in the query cache, so a change shows at once and the screens that
 * share the data (the timeline, the month grid, the activity list) stay in step. They are plain functions
 * over a `QueryClient`: no React, and nothing here talks to the network.
 */

// ---- Tasks: a block lives in the list of its day and in every month range that covers that day ----

export const byStart = (a: ScheduledTask, b: ScheduledTask) => a.startMinutes - b.startMinutes;
const byDayThenStart = (a: ScheduledTask, b: ScheduledTask) =>
  a.day.localeCompare(b.day) || a.startMinutes - b.startMinutes;

type ListScope = { kind: "day"; day: string } | { kind: "range"; from: string; to: string };

function scopeOf(key: QueryKey): ListScope | null {
  const [root, kind, a, b] = key;
  if (root !== "tasks") return null;
  if (kind === "day" && typeof a === "string") return { kind: "day", day: a };
  if (kind === "range" && typeof a === "string" && typeof b === "string") return { kind: "range", from: a, to: b };
  return null;
}

const holds = (scope: ListScope, day: string) =>
  scope.kind === "day" ? scope.day === day : scope.from <= day && day <= scope.to;

const orderOf = (scope: ListScope) => (scope.kind === "day" ? byStart : byDayThenStart);

/** Run `edit` on every cached list of tasks, and store the result when it returned a new array. */
function editLists(qc: QueryClient, edit: (list: ScheduledTask[], scope: ListScope) => ScheduledTask[]) {
  for (const [key, list] of qc.getQueriesData<ScheduledTask[]>({ queryKey: queryKeys.tasks.all })) {
    const scope = scopeOf(key);
    if (!scope || !list) continue;
    const next = edit(list, scope);
    if (next !== list) qc.setQueryData(key, next);
  }
}

/** The cached copy of a block, wherever it is. */
export function findTask(qc: QueryClient, id: string): ScheduledTask | undefined {
  for (const [, list] of qc.getQueriesData<ScheduledTask[]>({ queryKey: queryKeys.tasks.all })) {
    const hit = list?.find((task) => task.id === id);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Put a block where it belongs: replace it in the lists that cover its day, add it where it is
 * missing, and take it out of the lists that don't (it moved to another day).
 */
export function upsertTask(qc: QueryClient, task: ScheduledTask): void {
  editLists(qc, (list, scope) => {
    const rest = list.filter((item) => item.id !== task.id);
    if (!holds(scope, task.day)) return rest.length === list.length ? list : rest;
    return [...rest, task].sort(orderOf(scope));
  });
}

/** Change some fields of a block in every list that has it. */
export function patchTask(qc: QueryClient, id: string, patch: Partial<ScheduledTask>): void {
  const current = findTask(qc, id);
  if (current) upsertTask(qc, { ...current, ...patch });
}

export function removeTask(qc: QueryClient, id: string): void {
  editLists(qc, (list) => (list.some((task) => task.id === id) ? list.filter((task) => task.id !== id) : list));
}

/** Rewrite blocks in every cached list; a block `edit` returns unchanged keeps its place and identity. */
export function mapTasks(qc: QueryClient, edit: (task: ScheduledTask) => ScheduledTask): void {
  editLists(qc, (list) => {
    const next = list.map(edit);
    return next.some((task, index) => task !== list[index]) ? next : list;
  });
}

// ---- Activities and categories: one list each, always in the order the screens show ----

export const byTemplateOrder = (a: ActivityTemplate, b: ActivityTemplate) =>
  a.category.localeCompare(b.category) || a.name.localeCompare(b.name);

const upsertIn = <T extends { id: string }>(list: T[], item: T, order: (a: T, b: T) => number) =>
  [...list.filter((entry) => entry.id !== item.id), item].sort(order);

export function upsertTemplate(qc: QueryClient, template: ActivityTemplate): void {
  qc.setQueryData<ActivityTemplate[]>(queryKeys.templates, (list) =>
    list ? upsertIn(list, template, byTemplateOrder) : list,
  );
}

export function removeTemplate(qc: QueryClient, id: string): void {
  qc.setQueryData<ActivityTemplate[]>(queryKeys.templates, (list) => list?.filter((entry) => entry.id !== id));
}

export function mapTemplates(qc: QueryClient, edit: (template: ActivityTemplate) => ActivityTemplate): void {
  qc.setQueryData<ActivityTemplate[]>(queryKeys.templates, (list) => {
    if (!list) return list;
    const next = list.map(edit);
    return next.some((entry, index) => entry !== list[index]) ? next.sort(byTemplateOrder) : list;
  });
}

export function upsertCategory(qc: QueryClient, category: Category): void {
  qc.setQueryData<Category[]>(queryKeys.categories, (list) =>
    list ? upsertIn(list, category, compareCategoriesByName) : list,
  );
}

export function removeCategory(qc: QueryClient, id: string): void {
  qc.setQueryData<Category[]>(queryKeys.categories, (list) => list?.filter((entry) => entry.id !== id));
}

/**
 * Scheduled blocks copy their template's color, so a recolor has to reach them too. Blocks are linked by
 * `templateId`; older drag-and-drop blocks were saved unlinked, so those match on the template's name and
 * category as it was before the edit. (The server does the same; this mirrors it so nothing lags behind.)
 */
export const followsTemplate = (task: ScheduledTask, template: ActivityTemplate) =>
  task.templateId === template.id ||
  (!task.templateId && task.title === template.name && task.category === template.category);
