import type { ActivityTemplate, Category } from "./types";
import { UNSORTED_CATEGORY } from "./category-guess";
import { canonicalColor, COLOR_KEYS, type ColorKey } from "./colors";

export const compareCategoriesByName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

/** A copy of the list in the order the UI shows it. */
export function sortCategoriesByName<T extends { name: string }>(categories: T[]): T[] {
  return [...categories].sort(compareCategoriesByName);
}

/**
 * Saved categories plus any name the activities use that isn't saved (yet), so nothing
 * disappears from the UI if the two ever disagree. Unsaved ones have no `id`.
 */
export type CategoryEntry = Omit<Category, "id"> & { id: string | null };

export const withImplicitCategories = (saved: Category[], templates: ActivityTemplate[] = []): CategoryEntry[] => {
  const known = new Set(saved.map((c) => c.name.toLowerCase()));
  const extra = new Map<string, CategoryEntry>();
  for (const t of templates) {
    const name = t.category?.trim();
    if (name && !known.has(name.toLowerCase()) && !extra.has(name.toLowerCase())) {
      extra.set(name.toLowerCase(), { id: null, name, color: t.color || "slate" });
    }
  }
  return sortCategoriesByName([...saved, ...extra.values()]);
};

/** The grey of the unsorted category: a real category only gets it once every other color is taken. */
const UNSORTED_COLOR: ColorKey = "slate";

/** The colors no category uses yet, in the order they are handed out (grey last). */
function freeColors(categories: readonly { color: string }[]): ColorKey[] {
  const used = new Set(categories.map((c) => canonicalColor(c.color)));
  const free = COLOR_KEYS.filter((key) => !used.has(key));
  return [...free.filter((key) => key !== UNSORTED_COLOR), ...free.filter((key) => key === UNSORTED_COLOR)];
}

/**
 * Pick a color no category uses yet, so a new category is easy to tell apart. Only once all of them are taken
 * does a color repeat.
 */
export function nextCategoryColor(categories: readonly { color: string }[]): ColorKey {
  return freeColors(categories)[0] ?? COLOR_KEYS[categories.length % COLOR_KEYS.length];
}

/** Whether `color` is free for a category, given the others: unused, or nothing else is left. */
export function isColorFree(color: string, others: readonly { color: string }[]): boolean {
  const key = canonicalColor(color);
  return !others.some((c) => canonicalColor(c.color) === key) || freeColors(others).length === 0;
}

/**
 * The colors a picker should not offer, each with the category that has it: every color another category
 * uses (`self` is the one being edited, by name). Empty once every color is taken, as a repeat is then
 * unavoidable and any choice is fine.
 */
export function takenColors(categories: readonly { name: string; color: string }[], self?: string): Map<ColorKey, string> {
  const others = categories.filter((c) => !self || c.name.toLowerCase() !== self.toLowerCase());
  if (freeColors(others).length === 0) return new Map();
  const taken = new Map<ColorKey, string>();
  for (const category of others) {
    const key = canonicalColor(category.color);
    if (!taken.has(key)) taken.set(key, category.name);
  }
  return taken;
}

/**
 * The new colors that make every category's color its own, while there are colors enough: the first category
 * in the list with a color keeps it, and each later one with the same color gets a free one. The unsorted
 * category always keeps its grey. Pass the categories in the order that should win (e.g. by name).
 */
export function planDistinctColors<T extends { id: string; name: string; color: string }>(
  categories: readonly T[],
): { id: string; color: ColorKey }[] {
  const isUnsorted = (c: T) => c.name.toLowerCase() === UNSORTED_CATEGORY.toLowerCase() && canonicalColor(c.color) === UNSORTED_COLOR;
  const ordered = [...categories.filter(isUnsorted), ...categories.filter((c) => !isUnsorted(c))];
  const kept: { color: string }[] = [];
  const clashing: T[] = [];
  for (const category of ordered) {
    if (kept.some((c) => canonicalColor(c.color) === canonicalColor(category.color))) clashing.push(category);
    else kept.push(category);
  }
  const changes: { id: string; color: ColorKey }[] = [];
  for (const category of clashing) {
    const color = freeColors(kept)[0];
    if (!color) break;
    kept.push({ color });
    changes.push({ id: category.id, color });
  }
  return changes;
}

/**
 * The color of an activity or block is its category's. The color saved with the item is only a
 * fallback while the category isn't known, e.g. before the list has loaded.
 */
export function colorOfCategory(categories: Category[], item: { category: string; color?: string }): string {
  const name = item.category?.trim().toLowerCase();
  return categories.find((c) => c.name.toLowerCase() === name)?.color ?? item.color ?? "slate";
}
