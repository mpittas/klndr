import type { ActivityTemplate, Category } from "./types";
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

/** Pick a color not used yet, so a new category is easy to tell apart. */
export function nextCategoryColor(categories: { color: string }[]): ColorKey {
  const used = new Set(categories.map((c) => canonicalColor(c.color)));
  return COLOR_KEYS.find((key) => !used.has(key)) ?? COLOR_KEYS[categories.length % COLOR_KEYS.length];
}

/**
 * The color of an activity or block is its category's. The color saved with the item is only a
 * fallback while the category isn't known, e.g. before the list has loaded.
 */
export function colorOfCategory(categories: Category[], item: { category: string; color?: string }): string {
  const name = item.category?.trim().toLowerCase();
  return categories.find((c) => c.name.toLowerCase() === name)?.color ?? item.color ?? "slate";
}
