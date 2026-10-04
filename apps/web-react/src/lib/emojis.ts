import {
  buildEmojiGroups,
  readRecentEmojis as readRecents,
  rememberEmoji as rememberRecent,
  type CompactEmoji,
  type EmojiGroup,
  type KeyValueStorage,
} from "@klndr/core";

export { searchEmojis } from "@klndr/core";
export type { EmojiEntry, EmojiGroup, KeyValueStorage } from "@klndr/core";

let cache: Promise<EmojiGroup[]> | null = null;

/** Loads the emoji dataset on first use (it is large, so it stays out of the main bundle). */
export function loadEmojiGroups(): Promise<EmojiGroup[]> {
  cache ??= Promise.all([
    import("emojibase-data/en/compact.json"),
    import("emojibase-data/en/messages.json"),
  ])
    .then(([dataMod, messagesMod]) =>
      buildEmojiGroups(
        dataMod.default as CompactEmoji[],
        (messagesMod.default as { groups: { key: string }[] }).groups,
      ),
    )
    .catch((error: unknown) => {
      // Do not keep a failed load (offline, say): the next open should try again.
      cache = null;
      throw error;
    });
  return cache;
}

/** localStorage, or nothing where there is none (a test runner without a window, say). */
const storage = (): KeyValueStorage | null => (typeof window !== "undefined" ? localStorage : null);

export function readRecentEmojis(): string[] {
  return readRecents(storage());
}

export function rememberEmoji(char: string): void {
  rememberRecent(storage(), char);
}
