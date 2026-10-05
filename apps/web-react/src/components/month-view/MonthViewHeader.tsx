import { addMonths, getYear, MONTH_LABELS, getMonthIndex } from "@klndr/core";
import { Link } from "@tanstack/react-router";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { hoursLabel } from "@/components/month-view/stats";

/**
 * The calendar's header: the month and year (a button that opens the date picker), a line of what the month
 * holds with a progress bar, and the controls: previous, today, next, jump to a date, and a new block.
 */
export function MonthViewHeader({
  month,
  today,
  isCurrentMonth,
  isDateSelectorOpen,
  monthStats,
  filtered,
  onOpenSelector,
  onNewBlock,
}: {
  month: string;
  today: string;
  isCurrentMonth: boolean;
  isDateSelectorOpen: boolean;
  monthStats: { blocks: number; minutes: number; done: number };
  /** True while the category filter is hiding some blocks. */
  filtered: boolean;
  onOpenSelector: () => void;
  onNewBlock: () => void;
}) {
  const to = (value: string) => ({ to: "/calendar" as const, search: { m: value } });
  const percent = monthStats.blocks ? Math.round((monthStats.done / monthStats.blocks) * 100) : 0;
  const navButton =
    "flex h-11 w-12 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground active:bg-muted sm:h-8 sm:w-8";

  return (
    <header className="mb-5 flex flex-col gap-4 sm:mb-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <button
          type="button"
          onClick={onOpenSelector}
          className="group -ml-2 inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1 text-left transition hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-haspopup="dialog"
          aria-expanded={isDateSelectorOpen}
          title="Choose a month, a year or an exact date"
        >
          <span className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {MONTH_LABELS[getMonthIndex(month)]}
            <span className="ml-2 font-medium text-muted-foreground">{getYear(month)}</span>
          </span>
          <ChevronDown
            className={`h-5 w-5 text-muted-foreground transition-transform duration-200 group-hover:text-foreground ${isDateSelectorOpen ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>

        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <span>
            <span className="font-mono font-semibold text-foreground">{monthStats.blocks}</span>{" "}
            {monthStats.blocks === 1 ? "block" : "blocks"}
          </span>
          <span>
            <span className="font-mono font-semibold text-foreground">{hoursLabel(monthStats.minutes)}</span> planned
          </span>
          <span className="flex items-center gap-2">
            <span
              role="progressbar"
              aria-label="Blocks done this month"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"
            >
              <span className="block h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${percent}%` }} />
            </span>
            <span>
              <span className="font-mono font-semibold text-foreground">{percent}%</span> done
            </span>
          </span>
          {filtered && (
            <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-xs font-medium text-foreground">
              Filtered
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="inline-flex h-12 flex-1 items-center rounded-xl border border-border bg-card p-0.5 shadow-2xs sm:h-9 sm:flex-none">
          <Link {...to(addMonths(month, -1).slice(0, 7))} className={navButton} title="Previous month" aria-label="Previous month">
            <ChevronLeft className="h-5 w-5 sm:h-4 sm:w-4" />
          </Link>

          <Link
            {...to(today.slice(0, 7))}
            className={`flex h-11 flex-1 items-center justify-center rounded-lg px-3 text-sm font-semibold transition sm:h-8 sm:flex-none sm:text-xs ${
              isCurrentMonth ? "cursor-default bg-muted text-muted-foreground" : "text-foreground hover:bg-muted"
            }`}
            title="Go to the current month"
          >
            Today
          </Link>

          <Link {...to(addMonths(month, 1).slice(0, 7))} className={navButton} title="Next month" aria-label="Next month">
            <ChevronRight className="h-5 w-5 sm:h-4 sm:w-4" />
          </Link>

          <div className="mx-0.5 h-5 w-px bg-border sm:h-4" />

          <button type="button" onClick={onOpenSelector} className={`${navButton} cursor-pointer`} title="Jump to a date" aria-label="Jump to a date">
            <CalendarDays className="h-5 w-5 sm:h-4 sm:w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={onNewBlock}
          className="inline-flex h-12 cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9 sm:rounded-lg sm:px-3 sm:text-xs"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">New block</span>
          <span className="sm:hidden">New</span>
        </button>
      </div>
    </header>
  );
}
