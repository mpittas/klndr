import { useNotesEditor } from "@klndr/data";

import { NotesEditor } from "@/components/NotesEditor";

/**
 * One day's notes, called the day's "Memo" on screen so it is not mixed up with a block's "Notes" field. It is
 * the same editor as that field (to-dos, lists, headings, bold, italic, strikethrough, "/" for blocks, and on a
 * phone the same full-screen page), filling the panel. The text, the debounce, the "do not clobber unsaved
 * typing" rule and the retry all come from `@klndr/data`'s `useNotesEditor`.
 *
 * The editor is a prop, not something this component makes for itself: `DayPlanner` owns one instance and
 * shows it in the sidebar or the phone's sheet, so the two can never become two savers racing over the
 * same day's text. (Same reason `DailyChecklist` takes its `useChecklist` result as a prop.) `DayPlanner`
 * also keys this component by day, so the editor starts fresh on every day.
 */
export function DayNotes({ notes }: { notes: ReturnType<typeof useNotesEditor> }) {
  const retry = () => (notes.state === "error" ? notes.retryLoad() : void notes.saveNow());

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col">
      {notes.state === "loading" && (
        <div className="space-y-2 p-4" aria-busy="true">
          <div className="h-4 w-2/3 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-1/2 animate-pulse rounded-md bg-muted" />
        </div>
      )}

      {notes.state === "error" && (
        <div className="p-4 text-center text-sm text-muted-foreground">
          <p>Couldn't load the memo for this day.</p>
          <button
            type="button"
            className="btn btn-secondary btn-xs mt-3"
            onClick={() => notes.retryLoad()}
          >
            Try again
          </button>
        </div>
      )}

      {notes.state === "ready" && (
        <NotesEditor
          fill
          label="Memo"
          value={notes.text}
          placeholder="Jot something down, or type / for a to-do list…"
          touchPlaceholder="Jot something down or add a to-do list…"
          onChange={notes.edit}
          // Leaving the text saves right away rather than after the pause.
          onBlur={() => void notes.saveNow()}
          status={
            notes.status === "saving" ? (
              "Saving…"
            ) : notes.status === "saved" ? (
              "Saved"
            ) : notes.status === "error" ? (
              <button
                type="button"
                className="cursor-pointer font-medium text-destructive underline"
                onClick={retry}
              >
                Couldn't save · Retry
              </button>
            ) : null
          }
        />
      )}
    </div>
  );
}
