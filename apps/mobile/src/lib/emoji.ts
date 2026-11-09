import {
  buildEmojiGroups,
  readRecentEmojis,
  rememberEmoji,
  type CompactEmoji,
  type EmojiGroup,
  type KeyValueStorage,
} from "@klndr/core";

import { storage } from "./storage";

/** MMKV as the key-value store the shared emoji code remembers recents in. */
const recents: KeyValueStorage = {
  getItem: (key) => storage.getString(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};

let groups: Promise<EmojiGroup[]> | null = null;

/** Loads the emoji dataset the first time the picker opens: it is large, and most sessions never need it. */
export function loadEmojiGroups(): Promise<EmojiGroup[]> {
  groups ??= Promise.all([import("emojibase-data/en/compact.json"), import("emojibase-data/en/messages.json")]).then(
    ([data, messages]) =>
      buildEmojiGroups(
        data.default as CompactEmoji[],
        (messages.default as { groups: { key: string }[] }).groups,
      ),
  );
  return groups;
}

export const recentEmojis = () => readRecentEmojis(recents);
export const rememberRecentEmoji = (char: string) => rememberEmoji(recents, char);

/**
 * Handing a choice back across a sheet. The picker is a screen of its own, opened over the editor, and a route
 * cannot return a value; so the editor leaves a function here before it opens the picker, and the picker calls
 * it once. One at a time, since only one picker can be open.
 */
let waiting: ((emoji: string) => void) | null = null;

export function askForEmoji(onPick: (emoji: string) => void): void {
  waiting = onPick;
}

export function answerEmoji(emoji: string): void {
  waiting?.(emoji);
  waiting = null;
}
