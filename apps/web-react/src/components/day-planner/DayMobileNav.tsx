import { Check, FileText, Settings } from "lucide-react";

const TAB =
  "relative flex min-h-12 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl text-muted-foreground transition-colors hover:text-foreground active:bg-foreground/[0.05] short:min-h-9 short:flex-row short:gap-2";

/**
 * The day's bottom bar below `xl`, where there is no day panel: the checklist and the notes open as sheets, and
 * below `lg`, where there is no sidebar either, the library too. A new block is the toolbar's "+", as on the month
 * and the week.
 */
export function DayMobileNav({
  checklistStats,
  hasNotes,
  onOpenSheet,
  onCustomize,
}: {
  checklistStats: { total: number; done: number };
  hasNotes: boolean;
  onOpenSheet: (sheet: "checklist" | "notes") => void;
  onCustomize: () => void;
}) {
  return (
    <nav
      aria-label="Day tools"
      className="z-30 flex shrink-0 items-center justify-around gap-1 border-t border-border bg-background/95 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur-xl pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] pt-1 short:pt-0.5 xl:hidden"
    >
      <button type="button" className={TAB} onClick={() => onOpenSheet("checklist")}>
        <Check className="h-5 w-5 text-foreground short:h-4 short:w-4" aria-hidden="true" />
        <span className="text-[11px] font-medium">Checklist</span>
        {checklistStats.total > 0 && (
          <span
            className={[
              "absolute right-1/2 top-0 flex h-3.5 min-w-3.5 translate-x-[calc(50%+14px)] items-center justify-center rounded-full px-1 text-[9px] font-bold tabular-nums shadow-xs short:static short:translate-x-0",
              checklistStats.done === checklistStats.total
                ? "bg-success text-success-foreground"
                : "bg-foreground text-background",
            ].join(" ")}
          >
            {checklistStats.done}/{checklistStats.total}
          </span>
        )}
      </button>

      <button type="button" className={TAB} onClick={() => onOpenSheet("notes")}>
        <FileText className="h-5 w-5 text-foreground short:h-4 short:w-4" aria-hidden="true" />
        <span className="text-[11px] font-medium">Notes</span>
        {hasNotes && (
          <span
            className="absolute right-1/2 top-1.5 h-1.5 w-1.5 translate-x-[calc(50%+12px)] rounded-full bg-brand short:static short:translate-x-0"
            aria-label="Has notes"
          />
        )}
      </button>

      {/* Without a sidebar, this is where activities and categories are edited */}
      <button type="button" className={`${TAB} lg:hidden`} aria-label="Edit activities and categories" onClick={onCustomize}>
        <Settings className="h-5 w-5 text-foreground short:h-4 short:w-4" aria-hidden="true" />
        <span className="text-[11px] font-medium">Library</span>
      </button>
    </nav>
  );
}
