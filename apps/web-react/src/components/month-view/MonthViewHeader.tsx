import { addMonths, getYear, MONTH_LABELS, getMonthIndex } from "@klndr/core";
import { Link } from "@tanstack/react-router";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Plus } from "lucide-react";

/**
 * The calendar's header: the month and year (a button that opens the date picker), a note while the category filter
 * is on, and the controls: previous, today, next, jump to a date, and a new block.
 */
export function MonthViewHeader({
  month,
  today,
  isCurrentMonth,
  isDateSelectorOpen,
  filtered,
  onOpenSelector,
  onNewBlock,
}: {
  month: string;
  today: string;
  isCurrentMonth: boolean;
  isDateSelectorOpen: boolean;
  /** True while the category filter is hiding some blocks. */
  filtered: boolean;
  onOpenSelector: () => void;
  onNewBlock: () => void;
}) {
  const to = (value: string) => ({ to: "/calendar" as const, search: { m: value } });
  const navButton = "btn btn-ghost btn-icon h-full rounded-[9px] max-sm:w-12";

  return (
    <header className="mb-5 flex flex-col gap-4 sm:mb-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-2">
        <h1 className="min-w-0">
        <button
          type="button"
          onClick={onOpenSelector}
          className="group -ml-2 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2 py-1 text-left transition-colors hover:bg-foreground/[0.04]"
          aria-haspopup="dialog"
          aria-expanded={isDateSelectorOpen}
          title="Choose a month, a year or an exact date"
        >
          <span className="text-[1.75rem] font-semibold leading-none tracking-[-0.035em] text-foreground sm:text-[2.125rem]">
            {MONTH_LABELS[getMonthIndex(month)]}
            <span className="ml-2 font-normal text-muted-foreground/80">{getYear(month)}</span>
          </span>
          <ChevronDown
            className={`mt-1 h-5 w-5 text-muted-foreground transition-transform duration-200 group-hover:text-foreground ${isDateSelectorOpen ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
        </h1>
        {filtered && (
          <span className="inline-flex h-6 items-center rounded-full bg-brand/10 px-2.5 text-xs font-medium text-brand">
            Filtered
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="inline-flex h-12 flex-1 items-center gap-0.5 rounded-xl border border-border bg-card p-[3px] shadow-xs sm:h-9 sm:flex-none">
          <Link {...to(addMonths(month, -1).slice(0, 7))} className={navButton} title="Previous month" aria-label="Previous month">
            <ChevronLeft aria-hidden="true" />
          </Link>

          <Link
            {...to(today.slice(0, 7))}
            aria-disabled={isCurrentMonth || undefined}
            className={`btn h-full flex-1 rounded-[9px] px-3 text-[13px] sm:flex-none ${
              isCurrentMonth ? "pointer-events-none text-muted-foreground/70" : "btn-ghost text-foreground"
            }`}
            title="Go to the current month"
          >
            Today
          </Link>

          <Link {...to(addMonths(month, 1).slice(0, 7))} className={navButton} title="Next month" aria-label="Next month">
            <ChevronRight aria-hidden="true" />
          </Link>

          <div className="mx-0.5 h-5 w-px bg-border sm:h-4" />

          <button type="button" onClick={onOpenSelector} className={navButton} title="Jump to a date" aria-label="Jump to a date">
            <CalendarDays aria-hidden="true" />
          </button>
        </div>

        <button type="button" onClick={onNewBlock} className="btn btn-primary btn-md max-sm:h-12 max-sm:rounded-xl max-sm:px-4">
          <Plus aria-hidden="true" />
          <span className="hidden sm:inline">New block</span>
          <span className="sm:hidden">New</span>
        </button>
      </div>
    </header>
  );
}
