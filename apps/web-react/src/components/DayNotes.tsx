import { renderMarkdown, toggleTaskLine } from "@klndr/core";
import { useNotesEditor } from "@klndr/data";
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";

const MAX_LENGTH = 20_000;

/**
 * One day's notes: a rendered preview until it is clicked, then a plain Markdown editor. The text, the
 * debounce, the "do not clobber unsaved typing" rule and the retry all come from `@klndr/data`'s
 * `useNotesEditor`.
 *
 * The editor is a prop, not something this component makes for itself: `DayPlanner` owns one instance and
 * shows it in the sidebar or the phone's sheet, so the two can never become two savers racing over the
 * same day's text. (Same reason `DailyChecklist` takes its `useChecklist` result as a prop.) `DayPlanner`
 * also keys this component by day, so the preview/editor choice starts fresh on every day.
 */
export function DayNotes({ notes }: { notes: ReturnType<typeof useNotesEditor> }) {
  const areaRef = useRef<HTMLTextAreaElement | null>(null);

  // `null` until the reader decides: an empty note opens straight into the editor, a written one shows
  // its preview, and a click flips it either way.
  const [editing, setEditing] = useState<boolean | null>(null);
  const autoEdit = notes.state === "ready" && notes.text.trim().length === 0;
  const isEditing = editing ?? autoEdit;

  useEffect(() => {
    if (!isEditing) return;
    const area = areaRef.current;
    if (!area || document.activeElement === area) return;
    area.focus();
    area.setSelectionRange(area.value.length, area.value.length);
  }, [isEditing]);

  const stopEditing = () => {
    void notes.saveNow();
    if (notes.text.trim()) setEditing(false);
  };

  const retry = () => (notes.state === "error" ? notes.retryLoad() : void notes.saveNow());

  const onPreviewClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("a")) return; // let links open
    if (target instanceof HTMLInputElement && target.dataset.line) {
      notes.edit(toggleTaskLine(notes.text, Number(target.dataset.line)));
      return;
    }
    if (notes.state === "ready") setEditing(true);
  };

  // Only the preview needs the HTML, so typing in the editor does not re-render the Markdown each keystroke.
  const html = useMemo(
    () => (notes.state === "ready" && !isEditing ? renderMarkdown(notes.text) : ""),
    [notes.state, notes.text, isEditing],
  );

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col bg-background">
      {notes.state === "loading" && (
        <div className="space-y-2 p-4" aria-busy="true">
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      )}

      {notes.state === "error" && (
        <div className="p-4 text-center text-sm text-muted-foreground">
          <p>Couldn't load the notes for this day.</p>
          <button
            type="button"
            className="mt-2 cursor-pointer rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-xs hover:bg-accent"
            onClick={() => notes.retryLoad()}
          >
            Try again
          </button>
        </div>
      )}

      {notes.state === "ready" && (
        <>
          <textarea
            ref={areaRef}
            value={notes.text}
            maxLength={MAX_LENGTH}
            spellCheck
            aria-label="Notes for this day"
            placeholder={"Jot something down…\n\n# Heading   - list   - [ ] task   **bold**   `code`"}
            className={[
              "min-h-0 w-full flex-1 resize-none bg-transparent px-4 py-3 pb-8 font-mono text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground focus-visible:outline-none",
              isEditing ? "" : "hidden",
            ].join(" ")}
            onChange={(event) => notes.edit(event.target.value)}
            onBlur={stopEditing}
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              event.stopPropagation();
              event.preventDefault();
              event.currentTarget.blur();
            }}
          />
          {!isEditing && (
            <div
              className="notes-prose min-h-0 flex-1 cursor-text overflow-y-auto px-4 py-3 pb-8 text-sm text-foreground"
              onClick={onPreviewClick}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}

          <p
            className="pointer-events-none absolute bottom-2 right-3 text-[11px] text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            {notes.status === "saving" && "Saving…"}
            {notes.status === "saved" && "Saved"}
            {notes.status === "error" && (
              <button
                type="button"
                className="pointer-events-auto cursor-pointer font-medium text-destructive underline"
                onClick={retry}
              >
                Couldn't save · Retry
              </button>
            )}
          </p>
        </>
      )}
    </div>
  );
}

