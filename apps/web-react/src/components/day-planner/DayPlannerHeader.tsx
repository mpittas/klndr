import { addDaysISO, formatDuration, longDate, mediumDate } from "@klndr/core";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronLeft, ChevronRight, Plus } from "lucide-react";
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
  const arrow = "btn btn-ghost btn-icon h-11 rounded-lg short:h-10 sm:h-8";

  return (
    <header className="@container relative flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-background/95 pl-1.5 pr-3 short:h-12 sm:h-16 sm:gap-3 sm:pl-4 sm:pr-5">
      <div className="flex min-w-0 items-center gap-1 sm:gap-2.5">
        <div className="flex shrink-0 items-center">
          <Link to="/day/$date" params={{ date: addDaysISO(day, -1) }} className={arrow} aria-label="Previous day">
            <ChevronLeft className="size-5 sm:size-4" aria-hidden="true" />
          </Link>
          <Link to="/day/$date" params={{ date: addDaysISO(day, 1) }} className={arrow} aria-label="Next day">
            <ChevronRight className="size-5 sm:size-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="min-w-0 shrink-0">
          <h1 className="text-base font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-[17px]">
            <button
              type="button"
              onClick={() => setPicking(true)}
              aria-label="Pick a day"
              title="Pick a day"
              className="group -mx-1.5 flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-1.5 py-0.5 text-left transition-colors hover:bg-foreground/[0.05]"
            >
              {/* The long form only where the header has room for it, so the date is never cut off. */}
              <span className="@2xl:hidden">{mediumDate(day)}</span>
              <span className="hidden @2xl:inline">{longDate(day)}</span>
              {isToday ? (
                <span className="rounded-full bg-brand/12 px-1.5 py-px text-[11px] font-semibold tracking-normal text-brand">
                  Today
                </span>
              ) : null}
              <ChevronDown
                className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                aria-hidden="true"
              />
            </button>
          </h1>
          <p className="mt-0.5 whitespace-nowrap text-xs leading-tight tabular-nums text-muted-foreground">
            {formatDuration(stats.scheduled)} planned
            <span className="px-1.5 text-muted-foreground/50">·</span>
            {stats.done}/{stats.count} done
          </p>
        </div>

        {!isToday && (
          <Link to="/day/$date" params={{ date: today }} className="btn btn-secondary btn-xs ml-1 h-9 px-3 sm:h-7 sm:px-2.5">
            Today
          </Link>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={onCreateBlock} className="btn btn-primary btn-sm hidden lg:inline-flex">
          <Plus aria-hidden="true" />
          New block
        </button>
      </div>
      <DatePickerModal open={picking} initial={day} selected={day} today={today} onClose={() => setPicking(false)} />
    </header>
  );
}
