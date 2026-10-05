import { DURATION_CHOICES, formatDuration, type ActivityTemplate } from "@klndr/core";
import { useEffect, useRef, useState } from "react";

import { CategorySelect } from "@/components/category/CategorySelect";
import { EmojiPicker } from "@/components/EmojiPicker";
import { useEmojiField } from "@/hooks/useEmojiField";

/** The fields the activity form edits; the color is the category's. */
export type ActivityDraft = {
  name: string;
  emoji: string;
  category: string;
  defaultDuration: number;
  notes: string;
};

/** What the form starts from: `emoji` is `null` for a new activity, which gets one as its name is typed. */
export type ActivityFormInitial = Omit<ActivityDraft, "emoji"> & { emoji: string | null };

/**
 * The name-and-emoji field, the category picker, the default length and the notes, plus the
 * cancel/submit pair pinned to the bottom on a phone.
 *
 * `initial` seeds the form once. To start over on something else, the parent remounts it with a new
 * `key` when the thing being edited changes.
 *
 * The emoji is picked as the name is typed (see `useEmojiField`), and `onSubmit` always gets one: when the pick
 * isn't back yet, it is a stand-in that is replaced once the activity `onSubmit` resolves to has been saved.
 */
export function ActivityForm({
  initial,
  templates,
  submitLabel,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  initial: ActivityFormInitial;
  templates: ActivityTemplate[];
  submitLabel: string;
  busy?: boolean;
  error?: string | null;
  /** Saves the activity, and resolves to it (or to `null` when saving failed). */
  onSubmit: (draft: ActivityDraft) => Promise<ActivityTemplate | null>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Omit<ActivityDraft, "emoji">>(() => {
    const { emoji: _emoji, ...rest } = initial;
    return rest;
  });
  const emoji = useEmojiField({
    kind: "activity",
    initial: initial.emoji,
    initialTitle: initial.name,
    title: draft.name,
    known: templates,
  });
  const [nameError, setNameError] = useState(false);
  const nameRef = useRef<HTMLInputElement | null>(null);

  // The name field takes focus when the form opens.
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const submit = async () => {
    if (busy) return;
    if (!draft.name.trim()) {
      setNameError(true);
      nameRef.current?.focus();
      return;
    }
    const picked = emoji.forSave();
    const saved = await onSubmit({ ...draft, emoji: picked.emoji });
    if (saved) picked.fill?.({ kind: "template", id: saved.id });
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        event.preventDefault();
        onCancel();
      }}
    >
      {/* Name + emoji */}
      <div>
        <label htmlFor="activity-name" className="text-xs font-medium text-foreground">
          Name
        </label>
        <div
          className={[
            "mt-1 flex h-11 w-full items-center rounded-md border bg-background shadow-xs transition-colors focus-within:ring-1 focus-within:ring-ring sm:h-9",
            nameError ? "border-destructive" : "border-input",
          ].join(" ")}
        >
          <EmojiPicker
            value={emoji.emoji}
            busy={emoji.picking}
            automatic={emoji.automatic}
            autoDisabled={!draft.name.trim()}
            hint={emoji.hint}
            onChange={emoji.choose}
            onAuto={emoji.auto}
          />
          <span className="h-5 w-px shrink-0 bg-border" />
          <input
            id="activity-name"
            ref={nameRef}
            value={draft.name}
            maxLength={80}
            autoComplete="off"
            placeholder="e.g. Deep work, Gym, Read"
            className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none"
            onChange={(event) => {
              const name = event.target.value;
              setNameError(false);
              setDraft((d) => ({ ...d, name }));
            }}
            onBlur={emoji.settle}
          />
        </div>
        {nameError ? (
          <p className="mt-1 text-xs font-medium text-destructive" role="alert">
            Give your activity a name.
          </p>
        ) : null}
      </div>

      {/* Category */}
      <div>
        <span className="text-xs font-medium text-foreground">Category</span>
        <CategorySelect
          value={draft.category}
          templates={templates}
          className="mt-1"
          onChange={(category) => setDraft((d) => ({ ...d, category }))}
        />
      </div>

      {/* Duration */}
      <div>
        <span className="text-xs font-medium text-foreground">Default length</span>
        <div role="radiogroup" aria-label="Default length" className="mt-1 flex flex-wrap gap-2 sm:gap-1.5">
          {DURATION_CHOICES.map((minutes) => (
            <button
              key={minutes}
              type="button"
              role="radio"
              aria-checked={draft.defaultDuration === minutes}
              className={[
                "h-10 min-w-14 cursor-pointer rounded-md border px-3 text-sm font-medium tabular-nums transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:h-7 sm:min-w-11 sm:px-2 sm:text-xs",
                draft.defaultDuration === minutes
                  ? "border-primary bg-primary text-primary-foreground shadow-xs"
                  : "border-input bg-background text-foreground hover:bg-accent",
              ].join(" ")}
              onClick={() => setDraft((d) => ({ ...d, defaultDuration: minutes }))}
            >
              {formatDuration(minutes)}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="activity-notes" className="text-xs font-medium text-foreground">
          Notes <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <textarea
          id="activity-notes"
          value={draft.notes}
          rows={1}
          maxLength={500}
          placeholder="A short description or intention"
          className="mt-1 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:py-1.5"
          onChange={(event) => {
            const notes = event.target.value;
            setDraft((d) => ({ ...d, notes }));
          }}
        />
      </div>

      {error ? (
        <p
          className="rounded-md border border-destructive/20 bg-destructive/10 p-2.5 text-xs font-medium text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="sticky -bottom-[max(1rem,env(safe-area-inset-bottom))] -mx-4 -mb-[max(1rem,env(safe-area-inset-bottom))] flex gap-2 border-t border-border bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:static sm:mx-0 sm:mb-0 sm:justify-end sm:border-t-0 sm:px-0 sm:pb-0 sm:pt-1">
        <button
          type="button"
          className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground shadow-xs transition hover:bg-accent sm:h-8 sm:flex-none"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 flex-[1.6] cursor-pointer items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 sm:h-8 sm:flex-none"
        >
          {busy ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

