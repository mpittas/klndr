import type { DayChecklistItem } from "@klndr/core";
import { Check, Ellipsis } from "lucide-react";

const MENU_ITEM_CLASS =
  "flex min-h-9 w-full cursor-pointer items-center rounded-md px-2.5 text-left text-sm transition-colors touch:min-h-11";

/** One routine on the day's checklist, with its actions behind the "…" button. */
export function ChecklistItemRow({
  item,
  completed,
  expanded,
  onToggle,
  onToggleActions,
  onEdit,
  onSkip,
  onRemove,
}: {
  item: DayChecklistItem;
  completed: boolean;
  /** Whether the row's menu is open. Owned by the parent so only one row's menu is open at a time. */
  expanded: boolean;
  onToggle: (id: string) => void;
  onToggleActions: (id: string) => void;
  onEdit: (item: DayChecklistItem) => void;
  onSkip: (item: DayChecklistItem, hidden: boolean) => void;
  onRemove: (item: DayChecklistItem) => void;
}) {
  // Picking an action closes the menu first, so the row is back to rest before anything changes.
  const run = (action: () => void) => {
    onToggleActions(item.id);
    action();
  };

  return (
    <div
      className={[
        "group relative flex items-center rounded-lg transition-colors hover:bg-accent/60",
        expanded ? "bg-accent/60" : "",
      ].join(" ")}
      onKeyDown={(event) => {
        if (event.key === "Escape" && expanded) onToggleActions(item.id);
      }}
    >
      <button
        type="button"
        className="flex min-h-10 min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-lg py-2 pl-2.5 pr-1 text-left touch:min-h-12"
        aria-pressed={completed}
        onClick={() => onToggle(item.id)}
      >
        <span
          className={[
            "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors touch:h-5 touch:w-5",
            completed
              ? "border-foreground bg-foreground text-background"
              : "border-foreground/30 text-transparent group-hover:border-foreground/60",
          ].join(" ")}
          aria-hidden="true"
        >
          <Check className="h-2.5 w-2.5" strokeWidth={3} />
        </span>

        <span
          className={[
            "min-w-0 flex-1 text-sm leading-snug transition-colors",
            completed ? "text-muted-foreground line-through decoration-muted-foreground/40" : "text-foreground",
          ].join(" ")}
        >
          <span className={["mr-1.5 select-none", completed ? "opacity-50" : ""].join(" ")} aria-hidden="true">
            {item.emoji}
          </span>
          {item.title}
          {item.scope === "day" && <span className="ml-1 text-[11px] text-muted-foreground">· this day only</span>}
        </span>
      </button>

      {/* Appears on hover or focus where there is a real pointer; always visible on touch */}
      <button
        type="button"
        className={[
          "mr-1 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition hover:bg-background hover:text-foreground touch:h-11 touch:w-11",
          expanded
            ? "text-foreground"
            : "[@media(hover:hover)]:lg:opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
        ].join(" ")}
        aria-expanded={expanded}
        aria-label={`Actions for ${item.title}`}
        onClick={() => onToggleActions(item.id)}
      >
        <Ellipsis className="h-4 w-4" aria-hidden="true" />
      </button>

      {expanded && (
        <>
          <div className="fixed inset-0 z-30" aria-hidden="true" onClick={() => onToggleActions(item.id)} />
          <div className="absolute right-1 top-full z-40 mt-1 w-40 rounded-lg border border-border bg-popover p-1 shadow-lg touch:w-48">
            {item.scope === "default" && (
              <>
                <button
                  type="button"
                  className={`${MENU_ITEM_CLASS} text-foreground hover:bg-accent`}
                  onClick={() => run(() => onEdit(item))}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className={`${MENU_ITEM_CLASS} text-foreground hover:bg-accent`}
                  onClick={() => run(() => onSkip(item, true))}
                >
                  Skip this day
                </button>
              </>
            )}
            <button
              type="button"
              className={`${MENU_ITEM_CLASS} text-destructive hover:bg-destructive/10`}
              onClick={() => run(() => onRemove(item))}
            >
              {item.scope === "day" ? "Remove" : "Delete"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
