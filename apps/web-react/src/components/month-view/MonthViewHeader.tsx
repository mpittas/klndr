import { addMonths, monthTitle } from "@klndr/core";
import { Link } from "@tanstack/react-router";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

export function MonthViewHeader({
  month,
  today,
  isCurrentMonth,
  isDateSelectorOpen,
  monthStats,
  onOpenSelector,
}: {
  month: string;
  today: string;
  isCurrentMonth: boolean;
  isDateSelectorOpen: boolean;
  monthStats: { blocks: number; hours: number; done: number };
  onOpenSelector: () => void;
}) {
  const to = (value: string) => ({ to: "/calendar" as const, search: { m: value } });

  return (
    <header className="mb-5 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          {/* Interactive Month & Year title button */}
          <button
            type="button"
            onClick={onOpenSelector}
            className="group -ml-1.5 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-1.5 py-1 text-2xl font-bold tracking-tight text-foreground transition hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-3xl"
            aria-haspopup="dialog"
            aria-expanded={isDateSelectorOpen}
            title="Click to select month, year, or jump to exact date"
          >
            <span>{monthTitle(month)}</span>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-2xs transition group-hover:border-foreground/30 group-hover:text-foreground sm:h-8 sm:w-8">
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${isDateSelectorOpen ? "rotate-180 text-foreground" : ""}`}
              />
            </span>
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 font-medium text-foreground shadow-xs">
            <span className="h-2 w-2 rounded-full bg-foreground" />
            <span className="font-mono font-semibold">{monthStats.blocks}</span>
            <span className="text-muted-foreground">blocks</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 font-medium text-foreground shadow-xs">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            <span className="font-mono font-semibold">{monthStats.hours}h</span>
            <span className="text-muted-foreground">planned</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 font-medium text-foreground shadow-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="font-mono font-semibold">{monthStats.done}</span>
            <span className="text-muted-foreground">completed</span>
          </span>
        </div>
      </div>

      {/* Compact Date Navigation Control */}
      <div className="flex items-center gap-2">
        <div className="inline-flex h-12 w-full items-center rounded-xl border border-border bg-card p-0.5 shadow-2xs sm:h-9 sm:w-auto">
          <Link
            {...to(addMonths(month, -1).slice(0, 7))}
            className="flex h-11 w-12 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground active:bg-muted sm:h-8 sm:w-8"
            title="Previous month"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-5 w-5 sm:h-4 sm:w-4" />
          </Link>

          <Link
            {...to(today.slice(0, 7))}
            className={`flex h-11 flex-1 items-center justify-center rounded-lg px-2.5 text-sm font-semibold transition sm:h-8 sm:flex-none sm:text-xs ${
              isCurrentMonth ? "cursor-default bg-muted text-muted-foreground" : "text-foreground hover:bg-muted"
            }`}
            title="Go to current month"
          >
            Today
          </Link>

          <Link
            {...to(addMonths(month, 1).slice(0, 7))}
            className="flex h-11 w-12 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground active:bg-muted sm:h-8 sm:w-8"
            title="Next month"
            aria-label="Next month"
          >
            <ChevronRight className="h-5 w-5 sm:h-4 sm:w-4" />
          </Link>

          <div className="mx-0.5 h-5 w-px bg-border sm:h-4" />

          <button
            type="button"
            onClick={onOpenSelector}
            className="flex h-11 w-12 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground active:bg-muted sm:h-8 sm:w-8"
            title="Jump to date"
            aria-label="Jump to date"
          >
            <Calendar className="h-5 w-5 sm:h-4 sm:w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
