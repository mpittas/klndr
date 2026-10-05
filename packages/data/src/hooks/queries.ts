import { colorOfCategory, type ApiClient, type Category } from "@klndr/core";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { queryKeys } from "../keys";
import { useData } from "../provider";

/**
 * One hook per thing the app reads. Each has a query-options builder beside it, for prefetching and for
 * tests; the key says what it is (`queryKeys`), and the cache is shared, so every screen that asks for the
 * same thing sees the same data.
 */
export const dayTasksQuery = (api: ApiClient, day: string) => ({
  queryKey: queryKeys.tasks.day(day),
  queryFn: () => api.getTasksForDay(day),
});

export const rangeTasksQuery = (api: ApiClient, from: string, to: string) => ({
  queryKey: queryKeys.tasks.range(from, to),
  queryFn: () => api.getTasksBetween(from, to),
});

export const templatesQuery = (api: ApiClient) => ({
  queryKey: queryKeys.templates,
  queryFn: () => api.getTemplates(),
});

export const categoriesQuery = (api: ApiClient) => ({
  queryKey: queryKeys.categories,
  queryFn: () => api.getCategories(),
});

export const checklistItemsQuery = (api: ApiClient) => ({
  queryKey: queryKeys.checklist.items,
  queryFn: () => api.getChecklistItems(),
});

export const dayChecklistQuery = (api: ApiClient, day: string) => ({
  queryKey: queryKeys.checklist.day(day),
  queryFn: () => api.getDayChecklist(day),
});

export const dayNotesQuery = (api: ApiClient, day: string) => ({
  queryKey: queryKeys.notes(day),
  queryFn: () => api.getDayNotes(day),
});

/** The blocks of one day, in start order. */
export function useDayTasks(day: string) {
  const { api } = useData();
  return useQuery(dayTasksQuery(api, day));
}

/** The blocks of a range of days (a month grid). The previous range stays up while the next one loads. */
export function useRangeTasks(from: string, to: string) {
  const { api } = useData();
  return useQuery({ ...rangeTasksQuery(api, from, to), placeholderData: keepPreviousData });
}

/** The activities, ordered by category and then name. */
export function useTemplates() {
  const { api } = useData();
  return useQuery(templatesQuery(api));
}

/** The categories, ordered by name. */
export function useCategories() {
  const { api } = useData();
  return useQuery(categoriesQuery(api));
}

/** The routines that repeat every day. */
export function useChecklistItems() {
  const { api } = useData();
  return useQuery(checklistItemsQuery(api));
}

/** What differs on one day: ticks, skipped routines and one-offs. */
export function useDayChecklist(day: string) {
  const { api } = useData();
  return useQuery(dayChecklistQuery(api, day));
}

/** The raw saved notes for a day; screens that edit them want `useNotesEditor`. */
export function useDayNotes(day: string) {
  const { api } = useData();
  return useQuery(dayNotesQuery(api, day));
}

const NO_CATEGORIES: Category[] = [];

/**
 * The color of an activity or block is its category's; the color saved with the item is only the
 * fallback while categories haven't loaded. The returned function changes when the categories do.
 */
export function useCategoryColor(): (item: { category: string; color?: string }) => string {
  const { data } = useCategories();
  const categories = data ?? NO_CATEGORIES;
  return useCallback((item) => colorOfCategory(categories, item), [categories]);
}
