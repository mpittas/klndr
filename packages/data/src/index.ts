/**
 * @klndr/data — how the web and mobile apps read and change the user's data: TanStack Query hooks over the
 * `@klndr/core` API client, with the optimistic updates, rollbacks, messages and undo that the planner
 * needs. Views are the apps' own; this is everything behind them.
 *
 * Needs React and `@tanstack/react-query`; nothing from react-dom or react-native.
 */
export { DataProvider, useData, type DataProviderProps } from "./provider";
export { createQueryClient } from "./client";
export { queryKeys } from "./keys";

// Reading
export {
  useDayTasks,
  useRangeTasks,
  useTemplates,
  useCategories,
  useChecklistItems,
  useDayChecklist,
  useDayNotes,
  useCategoryColor,
  dayTasksQuery,
  rangeTasksQuery,
  templatesQuery,
  categoriesQuery,
  checklistItemsQuery,
  dayChecklistQuery,
  dayNotesQuery,
} from "./hooks/queries";

// A day, as a screen uses it
export { useDayTimeline } from "./hooks/timeline";
export { useTimelineHistory } from "./hooks/history";
export { useChecklist } from "./hooks/checklist";
export { useNotesEditor } from "./hooks/notes";
export { useLibraryActions } from "./hooks/library";
export { useProfile, useUpdateProfile, type ProfileSource } from "./hooks/profile";

// Pure helpers the views share
export { dayStats, buildDayChecklist, emptyDayChecklist, type DayStats, type DayChecklistView } from "./derive";
export { draftFromTemplate, planMove, isTempId, type MoveChanges } from "./blocks";
export { NotesSaver, NOTES_SAVE_DELAY_MS, type NotesStatus } from "./notes-saver";

// Keeping the cache on the device
export {
  createKeyValuePersister,
  cacheBuster,
  CACHE_VERSION,
  CACHE_MAX_AGE_MS,
  type KeyValueStorage,
} from "./persistence";

// The mutations as plain options, for apps that want to drive them without these hooks
export { taskMutationOptions, type SaveTaskVars } from "./mutations/tasks";
export { libraryMutationOptions, type ActivityDraft } from "./mutations/library";
export { checklistMutationOptions } from "./mutations/checklist";
export type { Notify, MutationDeps } from "./mutations/types";
