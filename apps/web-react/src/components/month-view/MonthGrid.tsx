import { formatTime, WEEKDAY_LABELS } from "@klndr/core";
import { useCategoryColor } from "@klndr/data";
import { Link } from "@tanstack/react-router";

import type { DayCell } from "@/components/month-view/DayCell";
import { paletteOf } from "@/lib/colors";

/** The month as a grid of days. A block shows the colour of its category. */
export function MonthGrid({ days }: { days: DayCell[] }) {
  const colorOf = useCategoryColor();
  const toneOf = (task: { category: string; color?: string }) => paletteOf(colorOf(task));

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-2.5 text-center font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => (
          <Link
            key={day.iso}
            to="/day/$date"
            params={{ date: day.iso }}
            aria-label={day.label}
            className={[
              "group relative flex min-h-[5rem] flex-col gap-1 border-b border-r border-border/60 p-1.5 transition hover:bg-muted/40 active:bg-muted/60 sm:min-h-[8rem] sm:gap-1.5 sm:p-2.5",
              !day.inMonth ? "bg-muted/20 opacity-60" : day.isWeekend ? "bg-muted/10" : "bg-card",
            ].join(" ")}
          >
            <span className="flex items-center justify-between">
              <span
                className={[
                  "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums transition sm:h-6 sm:w-6 sm:text-xs",
                  day.isToday
                    ? "bg-primary font-bold text-primary-foreground shadow-xs"
                    : day.inMonth
                      ? "text-foreground group-hover:text-foreground"
                      : "text-muted-foreground/60",
                ].join(" ")}
              >
                {day.dayNumber}
              </span>
              {day.total ? (
                <span className="hidden font-mono text-[11px] font-medium tabular-nums text-muted-foreground sm:inline">
                  {day.total}
                </span>
              ) : null}
            </span>

            {/* Mobile task indicators: clean coloured dots */}
            <div className="flex flex-wrap items-center gap-1 pt-0.5 sm:hidden">
              {day.visible.map((task) => (
                <span key={task.id} className={["h-2 w-2 rounded-full", toneOf(task).dot].join(" ")} />
              ))}
              {day.hidden ? (
                <span className="font-mono text-[10px] font-semibold leading-none text-muted-foreground">
                  +{day.hidden}
                </span>
              ) : null}
            </div>

            {/* Desktop task chips: full cards with time and title */}
            <span className="hidden min-h-0 flex-1 flex-col gap-1 overflow-hidden pt-0.5 sm:flex">
              {day.visible.map((task) => (
                <span
                  key={task.id}
                  className={[
                    "flex items-center gap-1.5 truncate rounded-md border px-2 py-0.5 text-xs font-medium tabular-nums shadow-2xs transition",
                    task.completed ? "border-border bg-muted/70 text-muted-foreground line-through opacity-75" : toneOf(task).chip,
                  ].join(" ")}
                >
                  <span
                    className={[
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      task.completed ? "bg-muted-foreground" : toneOf(task).dot,
                    ].join(" ")}
                  />
                  <span className="font-mono text-[11px] opacity-75">{formatTime(task.startMinutes)}</span>
                  <span className="truncate">{task.title}</span>
                </span>
              ))}
              {day.hidden ? (
                <span className="self-start rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs font-medium tabular-nums text-muted-foreground">
                  +{day.hidden} more
                </span>
              ) : null}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
