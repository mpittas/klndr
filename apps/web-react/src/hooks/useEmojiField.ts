import {
  emojiFieldDue,
  emojiFieldReducer,
  emojiFieldState,
  emojiNeedsPicking,
  FALLBACK_EMOJI,
  normalizeEmojiTitle,
  type EmojiKind,
} from "@klndr/core";
import { useEmojiFill, useEmojiSuggester, useRememberedEmoji, type EmojiTarget } from "@klndr/data";
import { useCallback, useEffect, useEffectEvent, useReducer, useRef } from "react";

import { canonicalEmoji } from "@/lib/emojis";

/** Something the person already has with an emoji, such as an activity: the same name gets the same emoji. */
type Known = { name: string; emoji?: string };

/** How long typing has to stop before the title is taken as meant, and an emoji picked for it. */
const TYPING_PAUSE_MS = 600;

/**
 * Chooses an emoji for a title. `peek` answers without waiting, when it can: an emoji the person already uses for
 * that exact name, or one picked for it earlier this session. `pick` asks the model when it has to, and answers
 * `null` when there is nothing to offer (no model set up, a failure, an emoji the picker can't draw), so the
 * caller decides what to use instead. Neither throws.
 */
export function useEmojiPicker(kind: EmojiKind, known?: readonly Known[]) {
  const suggest = useEmojiSuggester();
  const remembered = useRememberedEmoji();

  const own = useCallback(
    (title: string) => {
      const name = normalizeEmojiTitle(title);
      return (name && known?.find((item) => item.emoji && normalizeEmojiTitle(item.name) === name)?.emoji) || null;
    },
    [known],
  );

  const peek = useCallback(
    (title: string) => {
      const before = remembered(title, kind);
      return own(title) ?? ((before && canonicalEmoji(before)) || null);
    },
    [own, remembered, kind],
  );

  const pick = useCallback(
    async (title: string): Promise<string | null> => {
      const now = peek(title);
      if (now) return now;
      const suggested = await suggest(title, kind);
      return (suggested && canonicalEmoji(suggested)) || null;
    },
    [peek, suggest, kind],
  );

  return { own, peek, pick };
}

type FieldOptions = {
  kind: EmojiKind;
  /** The emoji saved so far, or `null` for something new (it is then picked for the title as it is typed). */
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
 * The emoji of a form with a title field. It is picked for the title while the form is filled in, so saving
 * never waits for it: once typing pauses, when the field is left (`settle`), or at once on "Pick for me" (`auto`).
 * An emoji the person picks themselves (`choose`) is never replaced.
 *
 *  - A new item has no emoji (`emoji` is `null`, which the picker draws as a placeholder) until it has a title.
 *  - An item being edited keeps its emoji, unless its title changes and the emoji wasn't chosen by hand.
 *  - `picking` is true while a pick is on its way; the picker pulses, and stays usable.
 *
 * `forSave` gives the emoji to save right now. When the pick isn't back yet, that is the emoji showing (or the
 * fallback), and `fill` puts the picked one on the item once it has been saved and has an id.
 */
export function useEmojiField({ kind, initial, initialTitle, initialByHand = false, title, known }: FieldOptions) {
  const { own, peek, pick } = useEmojiPicker(kind, known);
  const fillEmoji = useEmojiFill();
  const [state, dispatch] = useReducer(emojiFieldReducer, undefined, () =>
    emojiFieldState(initial, initialTitle, initialByHand),
  );
  const asks = useRef(0);

  // The title is the form's; following it here (rather than in an effect) drops an answer for a title that has
  // gone before it can show, and puts a name the person already uses with its emoji in the same render.
  if (state.title !== title) dispatch({ type: "title", title, known: own(title) });

  /** Asks for an emoji for the title as it is now; the answer lands only if it is still wanted (see the reducer). */
  const ask = useCallback((): Promise<string> => {
    const id = ++asks.current;
    const answer = pick(state.title).then((emoji) => emoji ?? FALLBACK_EMOJI[kind]);
    dispatch({ type: "asked", id, title: state.title, answer });
    void answer.then((emoji) => dispatch({ type: "answered", id, emoji }));
    return answer;
  }, [pick, state.title, kind]);

  const due = emojiFieldDue(state);
  const askWhenDue = useEffectEvent(() => {
    if (emojiFieldDue(state)) void ask();
  });

  // Once typing pauses. A title picked before this session is no wait at all.
  useEffect(() => {
    if (!due) return;
    const timer = window.setTimeout(() => askWhenDue(), peek(title) ? 0 : TYPING_PAUSE_MS);
    return () => window.clearTimeout(timer);
  }, [due, title, peek]);

  const choose = useCallback((emoji: string) => dispatch({ type: "choose", emoji }), []);

  /** "Pick for me": chosen again from the title, now. */
  const auto = () => {
    dispatch({ type: "auto" });
    if (normalizeEmojiTitle(state.title) && !state.asked) void ask();
  };

  /** The title field was left: no reason to wait for the typing pause. */
  const settle = () => {
    if (due) void ask();
  };

  /** Back to how the form started, for one that stays open and takes another item. */
  const reset = () => dispatch({ type: "reset", state: emojiFieldState(initial, initialTitle, initialByHand) });

  const forSave = (): { emoji: string; fill?: (target: EmojiTarget) => void } => {
    const shown = state.emoji ?? FALLBACK_EMOJI[kind];
    if (!emojiNeedsPicking(state)) return { emoji: shown };
    const now = peek(state.title);
    if (now) return { emoji: now };
    const later = state.asked?.answer ?? ask();
    return { emoji: shown, fill: (target) => void fillEmoji(target, shown, later) };
  };

  const picking = state.asked !== null;

  return {
    emoji: state.emoji,
    picking,
    /** The emoji showing was chosen by the app, so "Pick for me" is what's in use. */
    automatic: !state.byHand && state.emoji !== null,
    /** For the picker's button: what is going to happen to the emoji, when it isn't just the one showing. */
    hint: picking
      ? "Picking an emoji for you…"
      : state.emoji === null
        ? "An emoji is picked for you as you type the name. Click to choose your own."
        : undefined,
    choose,
    auto,
    settle,
    reset,
    forSave,
  };
}
