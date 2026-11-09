import {
  buildEmojiGroups,
  readRecentEmojis as readRecents,
  rememberEmoji as rememberRecent,
  type CompactEmoji,
  type EmojiEntry,
  type EmojiGroup,
  type KeyValueStorage,
} from "@klndr/core";

import emojiData from "./emoji-data.json";

export { buildEmojiRows, moveEmojiCursor, searchEmojis } from "@klndr/core";
export type { EmojiEntry, EmojiGroup, EmojiMove, EmojiRow, EmojiSection, KeyValueStorage } from "@klndr/core";

/** Windows has no flag emoji: it draws a country's flag as two letters ("US"), which is no use as an icon. */
const canDrawFlags = () => typeof navigator === "undefined" || !/Windows/i.test(navigator.userAgent);

let groups: EmojiGroup[] | null = null;

/**
 * Every group the picker offers. The data is part of the planner's own code (about 40 KB gzipped, and
 * the landing page never loads it), so there is nothing to fetch when a picker opens: it is simply here.
 * The groups are built the first time they are asked for, then kept.
 */
export function emojiGroups(): EmojiGroup[] {
  groups ??= buildEmojiGroups(emojiData.emojis as CompactEmoji[], emojiData.groups).filter(
    (group) => group.key !== "flags" || canDrawFlags(),
  );
  return groups;
}

let lookup: Map<string, EmojiEntry> | null = null;

/** Every emoji by its character, to give a recent one (stored as just the character) its name. */
export function emojiLookup(): ReadonlyMap<string, EmojiEntry> {
  lookup ??= new Map(emojiGroups().flatMap((group) => group.emojis).map((emoji) => [emoji.char, emoji] as const));
  return lookup;
}

const withoutVariation = (char: string) => char.replace(/️/g, "");
let canonical: Map<string, string> | null = null;

/**
 * The picker's own form of an emoji, or `null` when the picker doesn't offer it. An emoji from outside the
 * set (one too new for most devices to draw, a skin tone, a flag on Windows) would show as an empty box, so
 * anything a model suggests goes through this before it is used. The invisible variation selector is ignored
 * when matching, and the picker's spelling is returned, so the emoji draws the same everywhere.
 */
export function canonicalEmoji(char: string): string | null {
  canonical ??= new Map([...emojiLookup().keys()].map((known) => [withoutVariation(known), known]));
  return canonical.get(withoutVariation(char)) ?? null;
}

/** The emojis offered before anyone has picked one. */
export const SUGGESTED_EMOJIS = [
  "📌", "💼", "📚", "🏃", "🧘", "🍳", "☕", "🛒",
  "💊", "💧", "🚿", "🧹", "📞", "✉️", "🎧", "🌙",
];

/** An emoji known only by its character (a recent one), turned into an entry the grid can draw. */
export const emojiEntryOf = (char: string, known: ReadonlyMap<string, EmojiEntry>): EmojiEntry =>
  known.get(char) ?? { char, label: "", tags: [] };

/** localStorage, or nothing where there is none (a test runner without a window, say). */
const storage = (): KeyValueStorage | null => (typeof window !== "undefined" ? localStorage : null);

export function readRecentEmojis(): string[] {
  return readRecents(storage());
}

export function rememberEmoji(char: string): void {
  rememberRecent(storage(), char);
}
