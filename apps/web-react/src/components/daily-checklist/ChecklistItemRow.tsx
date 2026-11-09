import type { DayChecklistItem } from "@klndr/core";
import { Check, Ellipsis } from "lucide-react";

const MENU_ITEM_CLASS = "menu-item";

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
        "group relative flex items-center rounded-lg transition-colors hover:bg-foreground/[0.045]",
        expanded ? "bg-foreground/[0.045]" : "",
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
            "tick pointer-events-none h-[18px] w-[18px] touch:h-5 touch:w-5",
            completed ? "" : "group-hover:border-success",
          ].join(" ")}
          data-done={completed}
          aria-hidden="true"
        >
          <Check className="h-2.5 w-2.5" strokeWidth={3} />
        </span>

        <span
          className={[
            "min-w-0 flex-1 text-sm leading-snug transition-colors",
            completed ? "text-muted-foreground line-through decoration-foreground/25" : "text-foreground",
          ].join(" ")}
        >
          <span className={["mr-1.5 select-none", completed ? "opacity-50" : ""].join(" ")} aria-hidden="true">
            {item.emoji}
          </span>
          {item.title}
          {item.scope === "day" && <span className="ml-1.5 text-xs text-muted-foreground">· this day only</span>}
        </span>
      </button>

      {/* Appears on hover or focus where there is a real pointer; always visible on touch */}
      <button
        type="button"
        className={[
          "btn btn-ghost btn-icon mr-1 h-7 rounded-md hover:bg-foreground/[0.07] touch:h-11",
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
          <div className="menu absolute right-1 top-full z-40 mt-1 w-44 animate-in fade-in-0 zoom-in-95 duration-100 touch:w-52">
            {item.scope === "default" && (
              <>
                <button
                  type="button"
                  className={MENU_ITEM_CLASS}
                  onClick={() => run(() => onEdit(item))}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className={MENU_ITEM_CLASS}
                  onClick={() => run(() => onSkip(item, true))}
                >
                  Skip this day
                </button>
              </>
            )}
            <button
              type="button"
              className={`${MENU_ITEM_CLASS} text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10`}
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
