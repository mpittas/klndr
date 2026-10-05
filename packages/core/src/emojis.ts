export type EmojiEntry = { char: string; label: string; tags: string[] };
export type EmojiGroup = { key: string; label: string; icon: string; emojis: EmojiEntry[] };

/** One row of the compact emojibase dataset (`emojibase-data/en/compact.json`). */
export type CompactEmoji = { unicode: string; label: string; tags?: string[]; group?: number };

/** The groups worth showing; anything else (skin-tone components) has no entry and is skipped. */
export const EMOJI_GROUP_META: Record<string, { label: string; icon: string }> = {
  "smileys-emotion": { label: "Smileys & Emotion", icon: "😀" },
  "people-body": { label: "People & Body", icon: "👋" },
  "animals-nature": { label: "Animals & Nature", icon: "🐻" },
  "food-drink": { label: "Food & Drink", icon: "🍔" },
  "travel-places": { label: "Travel & Places", icon: "✈️" },
  activities: { label: "Activities", icon: "⚽" },
  objects: { label: "Objects", icon: "💡" },
  symbols: { label: "Symbols", icon: "🔣" },
  flags: { label: "Flags", icon: "🏁" },
};

/**
 * Turn the compact emojibase dataset into the groups a picker shows. `groupKeys` is the `groups`
 * array of `emojibase-data/en/messages.json`, whose order is what the dataset's `group` indexes into.
 * The data itself is loaded by the app (a bundler concern); this is the shape it is turned into.
 */
export function buildEmojiGroups(
  data: readonly CompactEmoji[],
  groupKeys: readonly { key: string }[],
  meta: Record<string, { label: string; icon: string }> = EMOJI_GROUP_META,
): EmojiGroup[] {
  return groupKeys
    .map((group, index): EmojiGroup | null => {
      const known = meta[group.key];
      if (!known) return null; // skips skin-tone "components"
      const emojis = data
        .filter((item) => item.group === index)
        .map((item) => ({ char: item.unicode, label: item.label, tags: item.tags ?? [] }));
      return { key: group.key, ...known, emojis };
    })
    .filter((group): group is EmojiGroup => group !== null);
}

export function searchEmojis(groups: EmojiGroup[], query: string): EmojiEntry[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const results: EmojiEntry[] = [];
  for (const group of groups) {
    for (const emoji of group.emojis) {
      const haystack = `${emoji.label} ${emoji.tags.join(" ")}`.toLowerCase();
      if (terms.every((term) => haystack.includes(term))) results.push(emoji);
    }
  }
  return results;
}

/** A titled run of emojis in a picker: "Recent", then one per group. */
export type EmojiSection = { id: string; label: string; emojis: EmojiEntry[] };

/** One line of a picker's grid: a section title, or up to `columns` emojis starting at `start` in `cells`. */
export type EmojiRow = { kind: "header"; id: string; label: string } | { kind: "emojis"; start: number; count: number };

/**
 * Lay sections out as fixed-width rows, so a picker can place any row by its index and draw only the
 * ones on screen. `cells` is every emoji in reading order; a row refers to it by position, so moving a
 * cursor around the grid is arithmetic on one list. A section starts on a new row.
 */
export function buildEmojiRows(
  sections: readonly EmojiSection[],
  columns: number,
  withHeaders = true,
): { rows: EmojiRow[]; cells: EmojiEntry[] } {
  const rows: EmojiRow[] = [];
  const cells: EmojiEntry[] = [];
  for (const section of sections) {
    if (!section.emojis.length) continue;
    if (withHeaders) rows.push({ kind: "header", id: section.id, label: section.label });
    for (let at = 0; at < section.emojis.length; at += columns) {
      const line = section.emojis.slice(at, at + columns);
      rows.push({ kind: "emojis", start: cells.length, count: line.length });
      cells.push(...line);
    }
  }
  return { rows, cells };
}

export type EmojiMove = "left" | "right" | "up" | "down";

/** Where the cursor goes for an arrow key: up and down keep the column, clamped to a shorter row. */
export function moveEmojiCursor(rows: readonly EmojiRow[], total: number, cursor: number, move: EmojiMove): number {
  if (total === 0) return -1;
  if (cursor < 0 || cursor >= total) return 0;
  if (move === "left") return Math.max(0, cursor - 1);
  if (move === "right") return Math.min(total - 1, cursor + 1);

  const at = rows.findIndex((row) => row.kind === "emojis" && cursor >= row.start && cursor < row.start + row.count);
  if (at < 0) return cursor;
  const here = rows[at] as Extract<EmojiRow, { kind: "emojis" }>;
  const column = cursor - here.start;
  const step = move === "up" ? -1 : 1;
  for (let i = at + step; i >= 0 && i < rows.length; i += step) {
    const row = rows[i];
    if (row.kind === "emojis") return row.start + Math.min(column, row.count - 1);
  }
  return cursor;
}

/** Just enough of a key-value store to remember the recently used emojis (localStorage, MMKV, …). */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const RECENT_EMOJIS_KEY = "klndr:recent-emojis";
export const RECENT_EMOJIS_MAX = 16;

/** Recently used emojis, newest first. No storage (or a failing one) simply means none. */
export function readRecentEmojis(storage: KeyValueStorage | null | undefined): string[] {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(RECENT_EMOJIS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function rememberEmoji(storage: KeyValueStorage | null | undefined, char: string): void {
  if (!storage) return;
  const next = [char, ...readRecentEmojis(storage).filter((item) => item !== char)].slice(0, RECENT_EMOJIS_MAX);
  try {
    storage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable; recents are optional
  }
}

// ---- Emoji picked for a title ----

/** What an emoji is picked for: an activity (or block) is a thing to do, a category is a group of them. */
export type EmojiKind = "activity" | "category";

export const isEmojiKind = (value: unknown): value is EmojiKind => value === "activity" || value === "category";

/** What an item gets when no better emoji can be found. */
export const FALLBACK_EMOJI: Record<EmojiKind, string> = { activity: "📌", category: "📁" };

/** A title as compared for "did it change": a different case or spacing is the same title. */
export const normalizeEmojiTitle = (title: string) => title.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Whether saving needs to pick an emoji first: there is none yet, or the emoji was picked for the app (not by
 * hand) for a title that has since changed. An emoji chosen by hand is never replaced.
 *
 * `emoji` is `null` while it is still to be picked; `pickedFor` is the title it was picked for; `byHand` says the
 * person chose it themselves.
 */
export function emojiNeedsPicking(state: { emoji: string | null; pickedFor: string; byHand: boolean; title: string }): boolean {
  if (!normalizeEmojiTitle(state.title)) return false;
  if (state.emoji === null) return true;
  return !state.byHand && normalizeEmojiTitle(state.title) !== normalizeEmojiTitle(state.pickedFor);
}
