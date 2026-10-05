import { emojiNeedsPicking, FALLBACK_EMOJI, normalizeEmojiTitle, type EmojiKind } from "@klndr/core";
import { useEmojiSuggester } from "@klndr/data";
import { useCallback, useState } from "react";

import { canonicalEmoji } from "@/lib/emojis";

/** Something the person already has with an emoji, such as an activity: the same name gets the same emoji. */
type Known = { name: string; emoji?: string };

/**
 * Chooses an emoji for a title, and always has an answer. In order: one the person already uses for that exact
 * name (free, and consistent), the model's suggestion (if it is an emoji the picker offers), and the neutral
 * fallback for the kind of thing it is. Nothing here throws, so saving never waits on a failure.
 */
export function useEmojiPicker(kind: EmojiKind, known?: readonly Known[]): (title: string) => Promise<string> {
  const suggest = useEmojiSuggester();

  return useCallback(
    async (title) => {
      const name = normalizeEmojiTitle(title);
      const own = known?.find((item) => item.emoji && normalizeEmojiTitle(item.name) === name)?.emoji;
      if (own) return own;
      const suggested = await suggest(title, kind);
      return (suggested && canonicalEmoji(suggested)) || FALLBACK_EMOJI[kind];
    },
    [suggest, kind, known],
  );
}

type FieldOptions = {
  kind: EmojiKind;
  /** The emoji saved so far, or `null` for something new (it is then picked when the form is saved). */
  initial: string | null;
  /** The title that emoji belongs to; empty for something new. */
  initialTitle: string;
  /** The person chose `initial` themselves, so it stays whatever the title becomes (e.g. an activity's own emoji). */
  initialByHand?: boolean;
  /** What the title field says now. */
  title: string;
  known?: readonly Known[];
};

/**
 * The emoji of a form that is saved with a button. The emoji is automatic until the person picks one: it is
 * chosen when they save, never while they type or leave the title field, and never over one they chose.
 *
 *  - A new item has no emoji (`emoji` is `null`, which the picker draws as a placeholder) and gets one on save.
 *  - An item being edited keeps its emoji, unless its title changed and the emoji wasn't chosen by hand: then
 *    `stale` is true (the picker says a new one is coming) and save picks again.
 *  - `choose` is the person picking one themselves; `auto` hands the choice back to the app.
 *
 * `resolve` returns the emoji to save, picking it first when needed, and shows it in the field as it does.
 */
export function useEmojiField({ kind, initial, initialTitle, initialByHand = false, title, known }: FieldOptions) {
  const pick = useEmojiPicker(kind, known);
  const [emoji, setEmoji] = useState(initial);
  const [pickedFor, setPickedFor] = useState(initialTitle);
  const [byHand, setByHand] = useState(initialByHand);
  const [pending, setPending] = useState(false);

  const needsPicking = emojiNeedsPicking({ emoji, pickedFor, byHand, title });

  const choose = useCallback((next: string) => {
    setEmoji(next);
    setByHand(true);
  }, []);

  const auto = useCallback(() => {
    setEmoji(null);
    setByHand(false);
  }, []);

  /** Back to how the form started, for one that stays open and takes another item. */
  const reset = useCallback(() => {
    setEmoji(initial);
    setPickedFor(initialTitle);
    setByHand(initialByHand);
  }, [initial, initialTitle, initialByHand]);

  const resolve = useCallback(async (): Promise<string> => {
    if (!needsPicking) return emoji ?? FALLBACK_EMOJI[kind];
    setPending(true);
    try {
      const picked = await pick(title);
      setEmoji(picked);
      setPickedFor(title);
      setByHand(false);
      return picked;
    } finally {
      setPending(false);
    }
  }, [needsPicking, emoji, kind, pick, title]);

  const stale = emoji !== null && needsPicking;

  return {
    emoji,
    /** An emoji is showing, but a new one will be picked on save because the title has moved on from it. */
    stale,
    /** For the picker's button: what is going to happen to the emoji, when it isn't just the one showing. */
    hint:
      emoji === null
        ? "Emoji picked for you when you save. Click to choose your own."
        : stale
          ? "A new emoji will be picked for you when you save. Click to keep this one."
          : undefined,
    pending,
    choose,
    auto,
    reset,
    resolve,
  };
}
