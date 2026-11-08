import { normalizeEmojiTitle } from "./emojis";
import { MAX_CATEGORY } from "./validation";

/**
 * Where a block goes when nothing better is known. It is drawn in a neutral grey (the server makes it `slate` the
 * first time it is used), so a block nobody sorted stands out instead of looking like it belongs somewhere.
 */
export const UNSORTED_CATEGORY = "Uncategorized";

/** Names that say nothing about what a block is: never learned from past blocks, and never suggested. */
const CATCH_ALL = new Set(["general", "uncategorized", "other", "misc"]);

export const isCatchAllCategory = (name: string) => CATCH_ALL.has(name.trim().toLowerCase());

/** The most categories sent to the model, and the most examples of each. Enough to tell them apart. */
export const MAX_CATEGORY_OPTIONS = 40;
export const MAX_CATEGORY_EXAMPLES = 6;
export const MAX_CATEGORY_EXAMPLE = 60;

/** A category a guess may land on, with a few names the person already files under it. */
export type CategoryOption = { name: string; examples: string[] };

/** Something already filed under a category: an activity (`name`) or a block (`title`). */
export type FiledItem = { title: string; category: string };

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The categories a guess may land on, in the order they are listed: the catch-alls are left out, and each keeps
 * the first few distinct things filed under it (activities first, as the person named those on purpose).
 */
export function categoryOptions(categories: readonly { name: string }[], filed: readonly FiledItem[]): CategoryOption[] {
  const options: CategoryOption[] = [];
  for (const category of categories) {
    const name = category.name.trim().slice(0, MAX_CATEGORY);
    if (!name || isCatchAllCategory(name) || options.some((option) => sameName(option.name, name))) continue;
    const examples: string[] = [];
    const seen = new Set<string>();
    for (const item of filed) {
      if (examples.length >= MAX_CATEGORY_EXAMPLES) break;
      if (!sameName(item.category, name)) continue;
      const title = item.title.trim().slice(0, MAX_CATEGORY_EXAMPLE);
      const key = normalizeEmojiTitle(title);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      examples.push(title);
    }
    options.push({ name, examples });
    if (options.length >= MAX_CATEGORY_OPTIONS) break;
  }
  return options;
}

/**
 * The category the person has already given this exact title, or `null`. An activity of that name wins; then the
 * category most of their blocks with that title are in (the latest of them on a tie, as `filed` is oldest
 * first). Only a category that is still on offer counts, so a catch-all or a deleted one is never repeated.
 */
export function guessCategoryFromHistory(
  title: string,
  activities: readonly FiledItem[],
  blocks: readonly FiledItem[],
  options: readonly { name: string }[],
): string | null {
  const wanted = normalizeEmojiTitle(title);
  if (!wanted) return null;
  const offered = (name: string) => options.find((option) => sameName(option.name, name))?.name ?? null;

  for (const activity of activities) {
    if (normalizeEmojiTitle(activity.title) !== wanted) continue;
    const name = offered(activity.category);
    if (name) return name;
  }

  const counts = new Map<string, { name: string; count: number; last: number }>();
  blocks.forEach((block, index) => {
    if (normalizeEmojiTitle(block.title) !== wanted) return;
    const name = offered(block.category);
    if (!name) return;
    const key = name.toLowerCase();
    const entry = counts.get(key) ?? { name, count: 0, last: -1 };
    counts.set(key, { name, count: entry.count + 1, last: index });
  });
  let best: { name: string; count: number; last: number } | null = null;
  for (const entry of counts.values()) {
    if (!best || entry.count > best.count || (entry.count === best.count && entry.last > best.last)) best = entry;
  }
  return best?.name ?? null;
}

/**
 * The category names in the order a quick choice offers them: the ones with the most things filed under them
 * first, then by name. Catch-alls go last, as they are the ones a choice should steer away from.
 */
export function rankCategories(names: readonly string[], filed: readonly FiledItem[]): string[] {
  const counts = new Map<string, number>();
  for (const item of filed) {
    const key = item.category.trim().toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const score = (name: string) => (isCatchAllCategory(name) ? -1 : (counts.get(name.trim().toLowerCase()) ?? 0));
  return [...names].sort((a, b) => score(b) - score(a) || a.localeCompare(b));
}

/**
 * The model's answer as one of the options, or `null` when it is "none" or anything that isn't one of them.
 * Quotes, a trailing full stop and a different case are forgiven.
 */
export function parseCategoryAnswer(answer: string, options: readonly { name: string }[]): string | null {
  const text = answer
    .trim()
    .replace(/\.+$/, "")
    .replace(/^["'“‘`]+|["'”’`]+$/g, "")
    .replace(/\.+$/, "")
    .trim();
  if (!text || text.toLowerCase() === "none") return null;
  return options.find((option) => sameName(option.name, text))?.name ?? null;
}
