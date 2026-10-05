import { Check, FileText, Plus, Settings } from "lucide-react";

const TAB =
  "relative flex min-h-11 flex-1 cursor-pointer flex-col items-center justify-center gap-px rounded-lg text-muted-foreground transition hover:text-foreground active:bg-muted/60 short:min-h-9 short:flex-row short:gap-2";

/**
 * The phones' bottom bar: the one place a phone reaches the checklist, the notes and the library, since it
 * has no sidebar.
 */
export function DayMobileNav({
  checklistStats,
  hasNotes,
  onOpenSheet,
  onCreateBlock,
  onCustomize,
}: {
  checklistStats: { total: number; done: number };
  hasNotes: boolean;
  onOpenSheet: (sheet: "checklist" | "notes") => void;
  onCreateBlock: () => void;
  onCustomize: () => void;
}) {
  return (
    <nav
      aria-label="Day tools"
      className="z-30 flex shrink-0 items-center justify-around gap-1 border-t border-border bg-background pb-[max(0.25rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] pt-1 short:pt-0.5 lg:hidden"
    >
      <button
        type="button"
        className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-95 short:h-8"
        onClick={onCreateBlock}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Block</span>
      </button>

      <button type="button" className={TAB} onClick={() => onOpenSheet("checklist")}>
        <Check className="h-5 w-5 text-foreground short:h-4 short:w-4" aria-hidden="true" />
        <span className="text-[10px] font-medium">Checklist</span>
        {checklistStats.total > 0 && (
          <span
            className={[
              "absolute right-1/2 top-0 flex h-3.5 min-w-3.5 translate-x-[calc(50%+14px)] items-center justify-center rounded-full px-1 font-mono text-[9px] font-bold tabular-nums shadow-xs short:static short:translate-x-0",
              checklistStats.done === checklistStats.total
                ? "bg-emerald-600 text-white"
                : "bg-foreground text-background",
            ].join(" ")}
          >
            {checklistStats.done}/{checklistStats.total}
          </span>
        )}
      </button>

      <button type="button" className={TAB} onClick={() => onOpenSheet("notes")}>
        <FileText className="h-5 w-5 text-foreground short:h-4 short:w-4" aria-hidden="true" />
        <span className="text-[10px] font-medium">Notes</span>
        {hasNotes && (
          <span
            className="absolute right-1/2 top-1 h-1.5 w-1.5 translate-x-[calc(50%+12px)] rounded-full bg-primary short:static short:translate-x-0"
            aria-label="Has notes"
          />
        )}
      </button>

      {/* Phones have no sidebar, so this is where activities and categories are edited */}
      <button type="button" className={TAB} aria-label="Edit activities and categories" onClick={onCustomize}>
        <Settings className="h-5 w-5 text-foreground short:h-4 short:w-4" aria-hidden="true" />
        <span className="text-[10px] font-medium">Library</span>
      </button>
    </nav>
  );
}
