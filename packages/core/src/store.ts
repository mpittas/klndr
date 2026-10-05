import type {
  ActivityTemplate,
  Category,
  ChecklistItem,
  DayChecklist,
  DayExtraItem,
  DayNotes,
  ScheduledTask,
} from "./types";

/**
 * Data access for one signed-in user. Everything lives under `users/{uid}` (see `firestore.rules`
 * for the schema and the access rules). The web server implements this today with Firestore and an
 * in-memory store; the mobile app gets its own adapter in Phase 3.
 */
export interface Store {
  listTemplates(): Promise<ActivityTemplate[]>;
  createTemplate(draft: Omit<ActivityTemplate, "id" | "archived">): Promise<ActivityTemplate>;
  updateTemplate(id: string, patch: Partial<Omit<ActivityTemplate, "id">>): Promise<ActivityTemplate | null>;
  deleteTemplate(id: string): Promise<boolean>;
  listCategories(): Promise<Category[]>;
  /** Throws a 409 when the name is already taken (case-insensitive). */
  createCategory(draft: Omit<Category, "id">): Promise<Category>;
  /** Renaming also moves the category's activities and scheduled blocks to the new name. */
  updateCategory(id: string, patch: Partial<Omit<Category, "id">>): Promise<Category | null>;
  /**
   * Activities in the category must go somewhere: moved to another category via `moveTo` (its name),
   * or deleted with the category when `deleteActivities` is set. Scheduled blocks always stay.
   */
  deleteCategory(id: string, moveTo: string | null, deleteActivities?: boolean): Promise<boolean>;
  /** Make sure a category with this name exists; returns its canonical spelling. */
  ensureCategory(name: string): Promise<string>;
  listTasksForDay(day: string): Promise<ScheduledTask[]>;
  listTasksBetween(from: string, to: string): Promise<ScheduledTask[]>;
  createTask(draft: Omit<ScheduledTask, "id">): Promise<ScheduledTask>;
  updateTask(id: string, patch: Partial<Omit<ScheduledTask, "id" | "templateId">>): Promise<ScheduledTask | null>;
  deleteTask(id: string): Promise<boolean>;
  listChecklistItems(): Promise<ChecklistItem[]>;
  createChecklistItem(draft: Omit<ChecklistItem, "id" | "archived">): Promise<ChecklistItem>;
  updateChecklistItem(id: string, patch: Partial<Omit<ChecklistItem, "id">>): Promise<ChecklistItem | null>;
  deleteChecklistItem(id: string): Promise<boolean>;
  getDayChecklist(day: string): Promise<DayChecklist>;
  toggleDayChecklistItem(day: string, itemId: string, completed: boolean): Promise<DayChecklist>;
  /** Skip (or bring back) a default checklist item for one day only. */
  setDayChecklistItemHidden(day: string, itemId: string, hidden: boolean): Promise<DayChecklist>;
  /** Add a one-off checklist item that exists only on `day`. */
  addDayChecklistExtra(day: string, draft: Omit<DayExtraItem, "id">): Promise<DayChecklist>;
  removeDayChecklistExtra(day: string, id: string): Promise<DayChecklist>;
  getDayNotes(day: string): Promise<DayNotes>;
  setDayNotes(day: string, text: string): Promise<DayNotes>;
  /**
   * Delete everything this user owns: every document under `users/{uid}` — the collections above and
   * the one-time seed markers — and then the profile document itself. The Auth user is removed by the
   * client afterwards, which is what makes this the data half of deleting an account.
   */
  deleteAccount(): Promise<void>;
}

export const MAX_DAY_EXTRAS = 50;
export const MAX_NOTES_LENGTH = 20_000;
