import { useState } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";

export const HABIT_EMOJIS = [
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
  const [pickerOpen, setPickerOpen] = useState(false);
  // The default list applies to every day; a one-off only to the day being viewed.
  const [everyDay, setEveryDay] = useState(true);

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onSubmit({ title: trimmed, emoji, scope: everyDay ? "default" : "day" });
    setTitle("");
    // Walk down the emoji list, so adding several habits in a row needs no tapping.
    const currentIndex = HABIT_EMOJIS.indexOf(emoji);
    if (currentIndex >= 0 && currentIndex < HABIT_EMOJIS.length - 1) setEmoji(HABIT_EMOJIS[currentIndex + 1]);
    setPickerOpen(false);
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
        <div className="relative shrink-0">
          <button
            type="button"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-base transition-colors hover:bg-accent touch:h-11 touch:w-11 touch:text-lg"
            title="Pick emoji"
            aria-label="Pick emoji"
            aria-expanded={pickerOpen}
            onClick={() => setPickerOpen((open) => !open)}
          >
            {emoji}
          </button>

          {pickerOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setPickerOpen(false)} />
              <div className="absolute bottom-full left-0 z-40 mb-2 grid w-52 grid-cols-6 gap-1 rounded-xl border border-border bg-popover p-2 shadow-lg touch:w-72">
                {HABIT_EMOJIS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={[
                      "flex h-8 w-full cursor-pointer items-center justify-center rounded-md text-base transition-colors hover:bg-accent touch:h-11 touch:text-xl",
                      emoji === option ? "bg-accent" : "",
                    ].join(" ")}
                    onClick={() => {
                      setEmoji(option);
                      setPickerOpen(false);
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

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
