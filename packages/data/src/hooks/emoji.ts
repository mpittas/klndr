import { normalizeEmojiTitle, type EmojiKind } from "@klndr/core";
import { useCallback } from "react";
import { useData } from "../provider";

/** Past this the person is waiting on a button, so the caller falls back to something local. */
export const EMOJI_TIMEOUT_MS = 5000;
const CACHE_LIMIT = 200;

/**
 * Asking the server for an emoji that suits a title. It answers `null` for anything that goes wrong (no model
 * set up, an error, too slow), so a caller only ever has to decide what to use instead.
 *
 * Remembers the answers for the session: adding "Gym" three times asks once. The memory belongs to the
 * `DataProvider`, so a new person starts with none.
 */
export function useEmojiSuggester(): (text: string, kind: EmojiKind) => Promise<string | null> {
  const { api, emojiCache } = useData();

  return useCallback(
    async (text, kind) => {
      const title = text.trim();
      if (!title) return null;

      const key = `${kind}:${normalizeEmojiTitle(title)}`;
      const known = emojiCache.get(key);
      if (known) return known;

      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const emoji = await Promise.race([
          api.suggestEmoji(title, kind),
          new Promise<null>((resolve) => {
            timer = setTimeout(() => resolve(null), EMOJI_TIMEOUT_MS);
          }),
        ]);
        if (emoji) {
          emojiCache.set(key, emoji);
          // Oldest first: a Map remembers the order things were added in.
          if (emojiCache.size > CACHE_LIMIT) emojiCache.delete(emojiCache.keys().next().value as string);
        }
        return emoji;
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    },
    [api, emojiCache],
  );
}
