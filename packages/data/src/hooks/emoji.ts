import { normalizeEmojiTitle, type ActivityTemplate, type Category, type EmojiKind } from "@klndr/core";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { findTask, patchTask } from "../cache";
import { queryKeys } from "../keys";
import type { MutationDeps } from "../mutations/types";
import { useData } from "../provider";

/** Past this the caller stops waiting and uses something local instead. */
export const EMOJI_TIMEOUT_MS = 5000;
const CACHE_LIMIT = 200;

const cacheKey = (title: string, kind: EmojiKind) => `${kind}:${normalizeEmojiTitle(title)}`;

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

      const key = cacheKey(title, kind);
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

/** The emoji already suggested this session for a title, without asking anyone; `null` when there is none yet. */
export function useRememberedEmoji(): (text: string, kind: EmojiKind) => string | null {
  const { emojiCache } = useData();
  return useCallback((text, kind) => (text.trim() ? (emojiCache.get(cacheKey(text, kind)) ?? null) : null), [emojiCache]);
}

/** Something saved whose emoji can be filled in afterwards. An activity's blocks are `task`s; the library's are `template`s. */
export type EmojiTarget = { kind: "task" | "template" | "category"; id: string };

type Found = { emoji: string | null } | undefined;

function emojiIn(d: Pick<MutationDeps, "queryClient">, target: EmojiTarget): Found {
  const qc = d.queryClient;
  const item =
    target.kind === "task"
      ? findTask(qc, target.id)
      : target.kind === "template"
        ? qc.getQueryData<ActivityTemplate[]>(queryKeys.templates)?.find((entry) => entry.id === target.id)
        : qc.getQueryData<Category[]>(queryKeys.categories)?.find((entry) => entry.id === target.id);
  return item && { emoji: item.emoji || null };
}

function showEmoji(d: Pick<MutationDeps, "queryClient">, target: EmojiTarget, emoji: string | null) {
  const qc = d.queryClient;
  const value = emoji ?? undefined;
  if (target.kind === "task") patchTask(qc, target.id, { emoji: value ?? "" });
  else if (target.kind === "template") {
    qc.setQueryData<ActivityTemplate[]>(queryKeys.templates, (list) =>
      list?.map((entry) => (entry.id === target.id ? { ...entry, emoji: value ?? "" } : entry)),
    );
  } else {
    qc.setQueryData<Category[]>(queryKeys.categories, (list) =>
      list?.map((entry) => (entry.id === target.id ? { ...entry, emoji: value } : entry)),
    );
  }
}

const keyOf = (target: EmojiTarget) =>
  target.kind === "task" ? queryKeys.tasks.all : target.kind === "template" ? queryKeys.templates : queryKeys.categories;

/**
 * Gives something that was saved before its emoji was ready the emoji once it is, so saving never waits on a
 * model. `saved` is the emoji it was saved with (`null` for none), and `later` the pick still on its way.
 *
 * Nothing changes when the pick brings nothing new, or when the item's emoji is no longer the one it was saved
 * with: the person chose another in the meantime, and their choice wins. The change shows at once and is quiet:
 * no message, and no step to undo. It never throws; if saving fails, the item keeps the emoji it had.
 */
export async function fillEmoji(
  d: Pick<MutationDeps, "api" | "queryClient">,
  target: EmojiTarget,
  saved: string | null,
  later: Promise<string | null>,
): Promise<void> {
  let emoji: string | null;
  try {
    emoji = await later;
  } catch {
    return;
  }
  if (!emoji || emoji === saved) return;

  // Not in the cache (a block saved to a day nobody has open) is no reason to skip it; changed is.
  const before = emojiIn(d, target);
  if (before && before.emoji !== saved) return;

  // An older answer arriving after this change would put the saved emoji back on screen.
  await d.queryClient.cancelQueries({ queryKey: keyOf(target) });
  showEmoji(d, target, emoji);
  try {
    if (target.kind === "task") await d.api.updateTask(target.id, { emoji });
    else if (target.kind === "template") await d.api.updateTemplate(target.id, { emoji });
    else await d.api.updateCategory(target.id, { emoji });
  } catch {
    if (emojiIn(d, target)?.emoji === emoji) showEmoji(d, target, saved);
  }
}

/** `fillEmoji` for the person signed in. It keeps working after the form that called it has closed. */
export function useEmojiFill(): (target: EmojiTarget, saved: string | null, later: Promise<string | null>) => Promise<void> {
  const { api } = useData();
  const queryClient = useQueryClient();
  return useCallback((target, saved, later) => fillEmoji({ api, queryClient }, target, saved, later), [api, queryClient]);
}
