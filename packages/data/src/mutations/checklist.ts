import type { ChecklistItem, DayChecklist } from "@klndr/core";
import type { MutationOptions } from "@tanstack/react-query";
import { queryKeys } from "../keys";
import type { MutationDeps } from "./types";

/**
 * The daily checklist: routines that repeat every day, and per day what was ticked, what is skipped and
 * the one-offs. Ticking shows at once and is put back if saving fails; everything else waits for the
 * server and takes the answer it gives. All of it shares a scope, so changes reach the server in order.
 */
type Options<TData, TVars, TContext = unknown> = MutationOptions<TData, Error, TVars, TContext>;

const SCOPE = { id: "checklist" } as const;
const byOrder = (a: ChecklistItem, b: ChecklistItem) => a.order - b.order;

const setDay = (d: MutationDeps, dayChecklist: DayChecklist) =>
  d.queryClient.setQueryData<DayChecklist>(queryKeys.checklist.day(dayChecklist.day), dayChecklist);

// ---- Tick an item for a day ----

export type ToggleChecklistVars = { day: string; itemId: string; completed: boolean };

export const toggleChecklistOptions = (
  d: MutationDeps,
): Options<DayChecklist, ToggleChecklistVars, { before?: DayChecklist }> => ({
  mutationKey: ["checklist", "toggle"],
  scope: SCOPE,
  mutationFn: ({ day, itemId, completed }) => d.api.toggleChecklistItem(day, itemId, completed),
  onMutate: async ({ day, itemId, completed }) => {
    const key = queryKeys.checklist.day(day);
    await d.queryClient.cancelQueries({ queryKey: key });
    const before = d.queryClient.getQueryData<DayChecklist>(key);
    if (before) {
      const ids = completed
        ? before.completedItemIds.includes(itemId)
          ? before.completedItemIds
          : [...before.completedItemIds, itemId]
        : before.completedItemIds.filter((id) => id !== itemId);
      d.queryClient.setQueryData<DayChecklist>(key, { ...before, completedItemIds: ids });
    }
    return { before };
  },
  onSuccess: (dayChecklist) => setDay(d, dayChecklist),
  onError: (_error, { day }, context) => {
    if (context?.before) d.queryClient.setQueryData(queryKeys.checklist.day(day), context.before);
    d.notify("Could not update checklist item");
  },
});

// ---- The routines that repeat every day ----

export type CreateChecklistItemVars = { title: string; emoji: string; order?: number };

export const createChecklistItemOptions = (d: MutationDeps): Options<ChecklistItem, CreateChecklistItemVars> => ({
  mutationKey: ["checklist", "create"],
  scope: SCOPE,
  mutationFn: (draft) => d.api.createChecklistItem(draft),
  onSuccess: (created) =>
    d.queryClient.setQueryData<ChecklistItem[]>(queryKeys.checklist.items, (items) =>
      items ? [...items, created].sort(byOrder) : items,
    ),
});

export type UpdateChecklistItemVars = { id: string; patch: Partial<Omit<ChecklistItem, "id">> };

export const updateChecklistItemOptions = (d: MutationDeps): Options<ChecklistItem, UpdateChecklistItemVars> => ({
  mutationKey: ["checklist", "update"],
  scope: SCOPE,
  mutationFn: ({ id, patch }) => d.api.updateChecklistItem(id, patch),
  onSuccess: (updated) =>
    d.queryClient.setQueryData<ChecklistItem[]>(queryKeys.checklist.items, (items) =>
      items?.map((item) => (item.id === updated.id ? updated : item)).sort(byOrder),
    ),
});

export const deleteChecklistItemOptions = (d: MutationDeps): Options<void, { id: string }> => ({
  mutationKey: ["checklist", "delete"],
  scope: SCOPE,
  mutationFn: ({ id }) => d.api.deleteChecklistItem(id),
  onSuccess: (_void, { id }) => {
    d.queryClient.setQueryData<ChecklistItem[]>(queryKeys.checklist.items, (items) =>
      items?.filter((item) => item.id !== id),
    );
    // A deleted routine is no longer ticked or skipped on any day.
    for (const [key, day] of d.queryClient.getQueriesData<DayChecklist>({ queryKey: queryKeys.checklist.days })) {
      if (day) {
        d.queryClient.setQueryData<DayChecklist>(key, {
          ...day,
          completedItemIds: day.completedItemIds.filter((itemId) => itemId !== id),
          hiddenItemIds: day.hiddenItemIds.filter((itemId) => itemId !== id),
        });
      }
    }
  },
});

// ---- What differs on one day ----

export type HideChecklistVars = { day: string; item: Pick<ChecklistItem, "id" | "title">; hidden: boolean };

/** Skip a routine for one day, or bring it back. */
export const hideChecklistOptions = (d: MutationDeps): Options<DayChecklist, HideChecklistVars> => ({
  mutationKey: ["checklist", "hide"],
  scope: SCOPE,
  mutationFn: ({ day, item, hidden }) => d.api.hideChecklistItem(day, item.id, hidden),
  onSuccess: (dayChecklist, { item, hidden }) => {
    setDay(d, dayChecklist);
    d.notify(hidden ? `Skipped "${item.title}" for this day` : `Restored "${item.title}"`);
  },
});

export type AddExtraVars = { day: string; title: string; emoji: string };

/** A one-off item that exists only on one day. */
export const addExtraOptions = (d: MutationDeps): Options<DayChecklist, AddExtraVars> => ({
  mutationKey: ["checklist", "add-extra"],
  scope: SCOPE,
  mutationFn: ({ day, title, emoji }) => d.api.addDayChecklistExtra(day, { title, emoji }),
  onSuccess: (dayChecklist, { title }) => {
    setDay(d, dayChecklist);
    d.notify(`Added "${title}" for this day`);
  },
});

export type RemoveExtraVars = { day: string; item: { id: string; title: string } };

export const removeExtraOptions = (d: MutationDeps): Options<DayChecklist, RemoveExtraVars> => ({
  mutationKey: ["checklist", "remove-extra"],
  scope: SCOPE,
  mutationFn: ({ day, item }) => d.api.removeDayChecklistExtra(day, item.id),
  onSuccess: (dayChecklist, { item }) => {
    setDay(d, dayChecklist);
    d.notify(`Removed "${item.title}"`);
  },
});

export const checklistMutationOptions = (d: MutationDeps) => ({
  toggle: toggleChecklistOptions(d),
  create: createChecklistItemOptions(d),
  update: updateChecklistItemOptions(d),
  remove: deleteChecklistItemOptions(d),
  hide: hideChecklistOptions(d),
  addExtra: addExtraOptions(d),
  removeExtra: removeExtraOptions(d),
});
