import type { ActivityTemplate, Category } from "@klndr/core";
import { notifyManager, type MutationOptions } from "@tanstack/react-query";
import {
  followsTemplate,
  mapTasks,
  mapTemplates,
  removeCategory,
  removeTemplate,
  upsertCategory,
  upsertTemplate,
} from "../cache";
import { queryKeys } from "../keys";
import type { MutationDeps } from "./types";

/**
 * Changes to the library: the activities and the categories they sit in. Saving waits for the server (the
 * forms show what went wrong); dragging an activity to another category shows at once. Renaming or
 * deleting a category rewrites activities and blocks on the server, so those are relabelled here in the
 * same step and then fetched again to be sure.
 */
type Options<TData, TVars, TContext = unknown> = MutationOptions<TData, Error, TVars, TContext>;

const templateIn = (d: MutationDeps, id: string) =>
  d.queryClient.getQueryData<ActivityTemplate[]>(queryKeys.templates)?.find((template) => template.id === id);

const categoryIn = (d: MutationDeps, id: string) =>
  d.queryClient.getQueryData<Category[]>(queryKeys.categories)?.find((category) => category.id === id);

// ---- Activities ----

export type ActivityDraft = Omit<ActivityTemplate, "id" | "archived">;
/** `id` is null for a new activity. */
export type SaveTemplateVars = { id: string | null; draft: ActivityDraft };

export const saveTemplateOptions = (d: MutationDeps): Options<ActivityTemplate, SaveTemplateVars> => ({
  mutationKey: ["templates", "save"],
  mutationFn: ({ id, draft }) => (id ? d.api.updateTemplate(id, draft) : d.api.createTemplate(draft)),
  onSuccess: (saved, { id }) => {
    const previous = id ? templateIn(d, id) : undefined;
    notifyManager.batch(() => {
      upsertTemplate(d.queryClient, saved);
      // The server recolors every block made from the activity; mirror it so nothing lags behind.
      if (previous && previous.color !== saved.color) {
        mapTasks(d.queryClient, (task) => (followsTemplate(task, previous) ? { ...task, color: saved.color } : task));
      }
    });
    // The server may have created the category just now.
    void d.queryClient.invalidateQueries({ queryKey: queryKeys.categories });
  },
});

export const deleteTemplateOptions = (d: MutationDeps): Options<void, { id: string }> => ({
  mutationKey: ["templates", "delete"],
  mutationFn: ({ id }) => d.api.deleteTemplate(id),
  onSuccess: (_void, { id }) => {
    notifyManager.batch(() => {
      removeTemplate(d.queryClient, id);
      // Its blocks stay on the timeline, as plain blocks.
      mapTasks(d.queryClient, (task) => (task.templateId === id ? { ...task, templateId: null } : task));
    });
    d.notify("Activity deleted");
  },
});

export type MoveTemplateVars = { template: ActivityTemplate; category: string };

/** Dragging an activity onto another category: shown at once, put back if saving fails. */
export const moveTemplateOptions = (d: MutationDeps): Options<ActivityTemplate, MoveTemplateVars> => ({
  mutationKey: ["templates", "move"],
  mutationFn: ({ template, category }) => d.api.updateTemplate(template.id, { category }),
  onMutate: async ({ template, category }) => {
    await d.queryClient.cancelQueries({ queryKey: queryKeys.templates });
    upsertTemplate(d.queryClient, { ...template, category });
  },
  onSuccess: (saved, { template, category }) => {
    upsertTemplate(d.queryClient, saved);
    d.notify(`Moved ${template.name} to ${category}`);
  },
  onError: (_error, { template }) => {
    upsertTemplate(d.queryClient, template);
    d.notify("Could not move that activity");
  },
});

// ---- Categories ----

export const createCategoryOptions = (d: MutationDeps): Options<Category, { draft: Omit<Category, "id"> }> => ({
  mutationKey: ["categories", "create"],
  mutationFn: ({ draft }) => d.api.createCategory(draft),
  onSuccess: (created) => upsertCategory(d.queryClient, created),
});

export type UpdateCategoryVars = { id: string; patch: Partial<Omit<Category, "id">> };

export const updateCategoryOptions = (d: MutationDeps): Options<Category, UpdateCategoryVars> => ({
  mutationKey: ["categories", "update"],
  mutationFn: ({ id, patch }) => d.api.updateCategory(id, patch),
  onSuccess: (updated, { id }) => {
    const previous = categoryIn(d, id);
    // One step, so a screen never sees the new name empty while its activities still carry the old one (or
    // sit under the old name as a second, unsaved category). TanStack's default scheduler already coalesces
    // updates made in one synchronous block; the batch states the intent and keeps it true if an app swaps
    // in a synchronous scheduler.
    notifyManager.batch(() => {
      upsertCategory(d.queryClient, updated);
      if (previous && previous.name !== updated.name) {
        mapTemplates(d.queryClient, (t) => (t.category === previous.name ? { ...t, category: updated.name } : t));
        mapTasks(d.queryClient, (t) => (t.category === previous.name ? { ...t, category: updated.name } : t));
      }
    });
    // Confirm with the server. Fetching again cancels one still on its way, so two quick renames can't
    // end with the older answer bringing the old names back.
    if (previous && previous.name !== updated.name) {
      void d.queryClient.invalidateQueries({ queryKey: queryKeys.templates });
      void d.queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    }
  },
});

/** Its activities either go to the category named `moveTo`, or are deleted along with it. */
export type DeleteCategoryVars = { id: string; target?: { moveTo: string } | { deleteActivities: true } };

export const deleteCategoryOptions = (d: MutationDeps): Options<void, DeleteCategoryVars> => ({
  mutationKey: ["categories", "delete"],
  mutationFn: ({ id, target }) => d.api.deleteCategory(id, target),
  onSuccess: (_void, { id }) => {
    removeCategory(d.queryClient, id);
    void d.queryClient.invalidateQueries({ queryKey: queryKeys.templates });
    void d.queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
  },
});

export const libraryMutationOptions = (d: MutationDeps) => ({
  saveTemplate: saveTemplateOptions(d),
  deleteTemplate: deleteTemplateOptions(d),
  moveTemplate: moveTemplateOptions(d),
  createCategory: createCategoryOptions(d),
  updateCategory: updateCategoryOptions(d),
  deleteCategory: deleteCategoryOptions(d),
});
