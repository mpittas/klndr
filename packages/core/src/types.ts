export type ActivityTemplate = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  category: string;
  defaultDuration: number;
  notes: string | null;
  archived: boolean;
};

/** A named group of activities, with the color shown beside it. */
export type Category = {
  id: string;
  name: string;
  color: string;
  /** Picked for the category's name (by the app, or by hand). Absent on categories made before there were any. */
  emoji?: string;
};

export type ScheduledTask = {
  id: string;
  templateId: string | null;
  title: string;
  emoji: string;
  color: string;
  category: string;
  day: string;
  startMinutes: number;
  durationMinutes: number;
  notes: string | null;
  completed: boolean;
  /**
   * Preferred column among the blocks it shares time with, set by dragging it sideways.
   * Absent until the block has been placed by hand; then it takes the first free column.
   */
  lane?: number;
};

export type ChecklistItem = {
  id: string;
  title: string;
  emoji: string;
  order: number;
  archived: boolean;
};

/** A one-off item that exists only on a single day. */
export type DayExtraItem = {
  id: string;
  title: string;
  emoji: string;
};

/**
 * Per-day state on top of the default checklist: what was ticked, which default
 * items are skipped for this day, and the one-off items added just for this day.
 */
export type DayChecklist = {
  day: string;
  completedItemIds: string[];
  hiddenItemIds: string[];
  extraItems: DayExtraItem[];
};

/** The quick notes for one day: a single markdown document. */
export type DayNotes = { day: string; text: string };

/** An item as shown on one day: a default item (every day) or a one-off (this day only). */
export type DayChecklistItem = ChecklistItem & { scope: "default" | "day" };

export const SLOT_MINUTES = 30;
export const SNAP_MINUTES = 15; // blocks move and resize in quarter-hour steps
export const SLOT_HEIGHT = 48; // px per half hour row
