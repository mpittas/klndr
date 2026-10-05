import { addDaysISO, formatDuration, longDate, mediumDate } from "@klndr/core";
import { Link } from "@tanstack/react-router";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";

import { DatePickerModal } from "@/components/DatePickerModal";

/**
 * The planner's header. The two arrows are day links, so a jump to another day is an ordinary navigation,
 * the date opens a calendar to pick any day from, and "Today" is only rendered when the day on screen isn't
 * today. The planner's messages go through the
 * app's toast (`@klndr/data`'s `notify`), not through the header.
 */
export function DayPlannerHeader({
  day,
  isToday,
  today,
  stats,
  onCreateBlock,
}: {
  day: string;
  isToday: boolean;
  today: string;
  stats: { scheduled: number; count: number; done: number };
  onCreateBlock: () => void;
}) {
  const [picking, setPicking] = useState(false);

  return (
    <header className="@container relative flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-background pl-1.5 pr-3 short:h-11 sm:h-12 sm:gap-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-1 sm:gap-2">
        <div className="flex shrink-0 items-center">
          <Link
            to="/day/$date"
            params={{ date: addDaysISO(day, -1) }}
            className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground active:bg-muted short:h-10 short:w-10 sm:h-7 sm:w-7"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden="true" />
          </Link>
          <Link
            to="/day/$date"
            params={{ date: addDaysISO(day, 1) }}
            className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground active:bg-muted short:h-10 short:w-10 sm:h-7 sm:w-7"
            aria-label="Next day"
          >
            <ChevronRight className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="shrink-0">
          <h1 className="text-[15px] font-semibold leading-tight tracking-tight text-foreground sm:text-sm">
            <button
              type="button"
              onClick={() => setPicking(true)}
              aria-label="Pick a day"
              title="Pick a day"
              className="-mx-2 flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-2 py-1 text-left transition hover:bg-muted active:bg-muted"
            >
              <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              {/* The long form only where the header has room for it, so the date is never cut off. */}
              <span className="@2xl:hidden">{mediumDate(day)}</span>
              <span className="hidden @2xl:inline">{longDate(day)}</span>
            </button>
          </h1>
          <p className="whitespace-nowrap font-mono text-[11px] leading-tight tabular-nums text-muted-foreground">
            {formatDuration(stats.scheduled)} planned · {stats.done}/{stats.count} done
          </p>
        </div>

        {!isToday && (
          <Link
            to="/day/$date"
            params={{ date: today }}
            className="ml-1 flex h-9 shrink-0 items-center rounded-md border border-border px-3 text-xs font-medium text-foreground transition hover:bg-muted active:bg-muted sm:h-auto sm:px-2 sm:py-1"
          >
            Today
          </Link>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onCreateBlock}
          className="hidden h-7 cursor-pointer items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90 lg:inline-flex"
        >
          <Plus className="h-3.5 w-3.5" />
          Block
        </button>
      </div>
      <DatePickerModal open={picking} initial={day} selected={day} today={today} onClose={() => setPicking(false)} />
    </header>
  );
}
