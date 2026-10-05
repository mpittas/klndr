import { useState } from "react";

import { EmojiPicker } from "@/components/EmojiPicker";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";

/** The emojis a new habit is given in turn, so adding several in a row needs no picking. */
const HABIT_EMOJIS = [
  "💊", "🥤", "🚿", "💧", "🧘", "🏋️", "🏃", "🥗", "🍳",
  "📚", "🧹", "☀️", "🌙", "🦷", "🛌", "🚶", "☕", "✨",
];

const SCOPES = [
  { label: "Every day", everyDay: true, tip: "Shows up on every day's checklist." },
  { label: "This day only", everyDay: false, tip: "Only appears on the day you're viewing." },
];

/** The "add a habit" row pinned under the checklist. */
export function ChecklistQuickAdd({
  adding,
  onSubmit,
}: {
  adding: boolean;
  onSubmit: (payload: { title: string; emoji: string; scope: "default" | "day" }) => void;
}) {
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("💊");
  // The default list applies to every day; a one-off only to the day being viewed.
  const [everyDay, setEveryDay] = useState(true);

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onSubmit({ title: trimmed, emoji, scope: everyDay ? "default" : "day" });
    setTitle("");
    const currentIndex = HABIT_EMOJIS.indexOf(emoji);
    if (currentIndex >= 0 && currentIndex < HABIT_EMOJIS.length - 1) setEmoji(HABIT_EMOJIS[currentIndex + 1]);
  };

  return (
    <div className="shrink-0 border-t border-border px-3 py-2.5">
      <form
        className="flex items-center gap-1"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <EmojiPicker
          value={emoji}
          onChange={setEmoji}
          label="Pick emoji"
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-base transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none touch:h-11 touch:w-11 touch:text-lg"
        />

        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          type="text"
          enterKeyHint="done"
          autoComplete="off"
          aria-label="New checklist item"
          placeholder="Add a habit…"
          maxLength={100}
          className="h-9 min-w-0 flex-1 bg-transparent px-1 text-sm placeholder:text-muted-foreground focus-visible:outline-none touch:h-11"
        />

        {/* Shown once there is something to add */}
        {title.trim() !== "" && (
          <button
            type="submit"
            disabled={adding}
            className="flex h-9 shrink-0 cursor-pointer items-center rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40 touch:h-11 touch:px-4 touch:text-sm"
          >
            {adding ? "Adding…" : "Add"}
          </button>
        )}
      </form>

      <div
        className="mt-2 grid grid-cols-2 rounded-lg bg-muted p-0.5 text-xs touch:text-sm"
        role="group"
        aria-label="Where to add the item"
      >
        {SCOPES.map((option) => (
          <Tooltip key={option.label}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-pressed={everyDay === option.everyDay}
                className={[
                  "inline-flex h-7 w-full cursor-pointer items-center justify-center rounded-md font-medium transition-colors touch:h-10",
                  everyDay === option.everyDay
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
                onClick={() => setEveryDay(option.everyDay)}
              >
                {option.label}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{option.tip}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
