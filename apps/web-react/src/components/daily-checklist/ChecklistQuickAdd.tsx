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
    <div className="shrink-0 border-t border-border px-3 py-3">
      <form
        className="flex h-10 items-center gap-1 rounded-lg border border-border bg-muted/50 pr-1 transition-[border-color,box-shadow,background-color] focus-within:border-ring focus-within:bg-card focus-within:ring-[3px] focus-within:ring-ring/15 touch:h-12"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <EmojiPicker
          value={emoji}
          onChange={setEmoji}
          label="Pick emoji"
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-l-lg text-base transition-colors hover:bg-foreground/[0.05] focus-visible:bg-foreground/[0.05] focus-visible:outline-none touch:h-11 touch:w-11 touch:text-lg"
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
          className="h-full min-w-0 flex-1 bg-transparent px-1 text-sm placeholder:text-muted-foreground/75 focus-visible:outline-none"
        />

        {/* Shown once there is something to add */}
        {title.trim() !== "" && (
          <button
            type="submit"
            disabled={adding}
            className="btn btn-primary btn-xs h-7 px-3 touch:h-9 touch:px-4 touch:text-sm"
          >
            {adding ? "Adding…" : "Add"}
          </button>
        )}
      </form>

      <div
        className="segmented mt-2 grid w-full grid-cols-2 touch:text-sm"
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
                  "segmented-item h-7 w-full text-xs touch:h-10 touch:text-sm",
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
