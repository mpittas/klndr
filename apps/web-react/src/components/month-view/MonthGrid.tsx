import { WEEKDAY_LABELS } from "@klndr/core";
import { useCategoryColor } from "@klndr/data";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import type { DayCell } from "@/components/month-view/DayCell";
import { shortTime } from "@/components/month-view/stats";
import { paletteOf } from "@/lib/colors";

/**
 * The month as a grid of days. Each cell is a link to its day, with a "+" on hover to add a block to it
 * without leaving; a block shows its emoji, title and the color of its category, and the day's progress is a
 * thin bar along the bottom. Today is tinted, and days that have passed are quieter.
 */
export function MonthGrid({ days, onAddBlock }: { days: DayCell[]; onAddBlock: (day: string) => void }) {
  const colorOf = useCategoryColor();
  const toneOf = (task: { category: string; color?: string }) => paletteOf(colorOf(task));

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40">
        {WEEKDAY_LABELS.map((label, index) => (
          <div
            key={label}
            className={[
              "py-2.5 text-center font-mono text-[11px] font-semibold uppercase tracking-wider sm:text-xs",
              index === 0 || index === 6 ? "text-muted-foreground/70" : "text-muted-foreground",
            ].join(" ")}
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, index) => (
          <div
            key={day.iso}
            className={[
              "group @container relative flex min-h-[5rem] flex-col gap-1 border-border/60 p-1.5 transition-colors sm:min-h-[8.5rem] sm:gap-1.5 sm:p-2",
              index % 7 !== 6 ? "border-r" : "",
              index < days.length - 7 ? "border-b" : "",
              day.isToday
                ? "bg-primary/[0.06]"
                : !day.inMonth
                  ? "bg-muted/25"
                  : day.isWeekend
                    ? "bg-muted/15 hover:bg-muted/30"
                    : "bg-card hover:bg-muted/30",
            ].join(" ")}
          >
            {/* The whole cell opens the day; the number, chips and "+" sit above it. */}
            <Link
              to="/day/$date"
              params={{ date: day.iso }}
              aria-label={day.label}
              aria-current={day.isToday ? "date" : undefined}
              className="absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            />

            <div className="pointer-events-none relative z-10 flex items-center justify-between">
              <span
                className={[
                  "flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums sm:h-7 sm:min-w-7 sm:text-[13px]",
                  day.isToday
                    ? "bg-primary font-bold text-primary-foreground shadow-xs"
                    : day.inMonth
                      ? day.isPast
                        ? "text-muted-foreground"
                        : "text-foreground"
                      : "text-muted-foreground/50",
                ].join(" ")}
              >
                {day.dayNumber}
              </span>
              <span className="flex items-center gap-1">
                {day.total ? (
                  <span className="hidden font-mono text-[11px] font-medium tabular-nums text-muted-foreground @[7rem]:inline">
                    {day.total}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => onAddBlock(day.iso)}
                  aria-label={`Add a block on ${day.iso}`}
                  title="Add a block"
                  className="pointer-events-auto hidden h-6 w-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground opacity-0 transition hover:bg-primary hover:text-primary-foreground focus-visible:opacity-100 group-hover:opacity-100 sm:flex touch:hidden"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </span>
            </div>

            {/* Phones: one dot per block. */}
            <div className="pointer-events-none relative z-10 flex flex-wrap items-center gap-1 pt-0.5 sm:hidden">
              {day.visible.map((task) => (
                <span
                  key={task.id}
                  className={["h-2 w-2 rounded-full", task.completed ? "bg-muted-foreground/40" : toneOf(task).dot].join(" ")}
                />
              ))}
              {day.hidden ? (
                <span className="font-mono text-[10px] font-semibold leading-none text-muted-foreground">+{day.hidden}</span>
              ) : null}
            </div>

            {/* Larger screens: a chip per block. */}
            <span className="pointer-events-none relative z-10 hidden min-h-0 flex-1 flex-col gap-1 overflow-hidden pb-1.5 sm:flex">
              {day.visible.map((task) => (
                <span
                  key={task.id}
                  title={task.title}
                  className={[
                    "flex items-center gap-1 truncate rounded-md border px-1.5 py-0.5 text-xs font-medium",
                    task.completed
                      ? "border-border bg-muted/60 text-muted-foreground line-through"
                      : toneOf(task).chip,
                    day.isPast && !task.completed ? "opacity-75" : "",
                  ].join(" ")}
                >
                  <span aria-hidden="true" className="shrink-0 text-[11px] leading-none">
                    {task.emoji}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{task.title}</span>
                  <span className="hidden shrink-0 font-mono text-[10px] tabular-nums opacity-60 @[9.5rem]:inline">
                    {shortTime(task.startMinutes)}
                  </span>
                </span>
              ))}
              {day.hidden ? (
                <span className="self-start rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
                  +{day.hidden} more
                </span>
              ) : null}
            </span>

            {day.count > 0 && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-1.5 bottom-1 z-10 hidden h-0.5 overflow-hidden rounded-full bg-border/70 sm:block"
              >
                <span
                  className="block h-full rounded-full bg-emerald-500 transition-[width]"
                  style={{ width: `${Math.round((day.done / day.count) * 100)}%` }}
                />
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
