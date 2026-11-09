import type { ActivityTemplate } from "@dayro/core";
import { useCategoryColor } from "@dayro/data";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

import type { DayCell } from "@/components/month-view/DayCell";
import { shortTime } from "@/components/month-view/stats";
import { paletteOf } from "@/lib/colors";

/** A chip's height and the gap between chips, in px (`h-5`, `gap-[3px]`), and the "+N more" line's height. */
const CHIP = 20;
const CHIP_GAP = 3;
const MORE = 14;
/** Chips shown before the grid has measured its cells. */
const DEFAULT_CHIPS = 3;

/** How many of a day's blocks to show as chips in a list `height` px tall, leaving room for "+N more" if needed. */
function chipsFor(count: number, height: number | null): number {
  if (height === null) return count <= DEFAULT_CHIPS ? count : DEFAULT_CHIPS - 1;
  const all = Math.floor((height + CHIP_GAP) / (CHIP + CHIP_GAP));
  if (count <= all) return count;
  return Math.max(1, Math.floor((height - MORE) / (CHIP + CHIP_GAP)));
}
/** Dots per day on phones. */
const DOTS = 4;

/**
 * The month as a grid of days, edge to edge under the toolbar like the week's columns. The rows share the height
 * of the screen, down to a minimum height, below which the grid scrolls.
 *
 * Each cell is a link to its day, with a "+" on hover to add a block to it without leaving; a block shows its
 * emoji, title and the color of its category, and the day's progress is a thin bar along the bottom. A cell
 * shows as many blocks as it has room for (measured, so it follows the window) and "+N more" for the rest.
 * Today's number sits on the brand disc, as on the week, and days that have passed are quieter. An activity
 * dragged out of the sidebar can be dropped on a day: it goes in after that day's last block.
 */
export function MonthGrid({
  days,
  weekdays,
  todayColumn,
  onAddBlock,
  dropping = null,
  onDropActivity,
}: {
  days: DayCell[];
  /** The weekday names in column order (Monday first when the profile says so). */
  weekdays: string[];
  /** The column today falls in when this month is on screen, else `null`. */
  todayColumn: number | null;
  onAddBlock: (day: string) => void;
  /** The activity being dragged out of the sidebar, if any. */
  dropping?: ActivityTemplate | null;
  onDropActivity?: (day: string) => void;
}) {
  const colorOf = useCategoryColor();
  const toneOf = (task: { category: string; color?: string }) => paletteOf(colorOf(task));

  // Every cell is the same height, so measuring the first one's block list says how many chips fit in all.
  const listRef = useRef<HTMLSpanElement | null>(null);
  const [listHeight, setListHeight] = useState<number | null>(null);
  /** The day an activity is being held over. */
  const [dropDay, setDropDay] = useState<string | null>(null);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const height = list.clientHeight;
      if (height > 0) setListHeight(height);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

  const rows = days.length / 7;

  return (
    <div className="flex flex-[1_0_auto] flex-col">
      {/* The weekday names, kept in view while the month scrolls on small screens */}
      <div className="sticky top-0 z-20 grid grid-cols-7 border-b border-border bg-background/95 backdrop-blur-sm">
        {weekdays.map((label, index) => (
          <div
            key={label}
            className={[
              "py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.06em]",
              index === todayColumn ? "text-brand" : "text-muted-foreground",
              index > 0 ? "border-l border-border/60" : "",
            ].join(" ")}
          >
            {label}
          </div>
        ))}
      </div>

      <div
        className="grid flex-1 grid-cols-7 [--row-min:4.75rem] sm:[--row-min:7.5rem] lg:[--row-min:6.5rem]"
        style={{ gridTemplateRows: `repeat(${rows}, minmax(var(--row-min), 1fr))` }}
      >
        {days.map((day, index) => {
          const chips = day.tasks.slice(0, chipsFor(day.tasks.length, listHeight));
          const more = day.tasks.length - chips.length;
          const isDropTarget = dropping !== null && dropDay === day.iso;
          return (
            <div
              key={day.iso}
              onDragOver={(event) => {
                if (!dropping) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
                if (dropDay !== day.iso) setDropDay(day.iso);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropDay(null);
              }}
              onDrop={(event) => {
                if (!dropping) return;
                event.preventDefault();
                setDropDay(null);
                onDropActivity?.(day.iso);
              }}
              className={[
                "group @container relative flex min-h-0 flex-col gap-1 overflow-hidden border-border/60 p-1.5 transition-colors duration-150 sm:gap-1.5 sm:p-2",
                index % 7 !== 0 ? "border-l" : "",
                index < days.length - 7 ? "border-b" : "",
                isDropTarget
                  ? "bg-brand/[0.07] shadow-[inset_0_0_0_1.5px_color-mix(in_oklab,var(--brand)_55%,transparent)]"
                  : day.isToday
                  ? "bg-brand/[0.035] hover:bg-brand/[0.06]"
                  : !day.inMonth
                    ? "bg-foreground/[0.025] hover:bg-foreground/[0.04]"
                    : day.isWeekend
                      ? "bg-foreground/[0.012] hover:bg-foreground/[0.03]"
                      : "hover:bg-foreground/[0.025]",
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

              <div className="pointer-events-none relative z-10 flex shrink-0 items-center justify-between">
                <span
                  className={[
                    "flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums sm:h-7 sm:min-w-7 sm:text-[13px]",
                    day.isToday
                      ? "bg-brand text-brand-foreground shadow-[0_1px_2px_rgb(var(--brand-shade)/0.3)]"
                      : day.inMonth
                        ? day.isPast
                          ? "font-medium text-muted-foreground"
                          : "text-foreground"
                        : "font-medium text-muted-foreground/45",
                  ].join(" ")}
                >
                  {day.dayNumber}
                </span>
                <span className="flex items-center gap-1">
                  {day.total ? (
                    <span className="hidden text-[11px] font-medium tabular-nums text-muted-foreground/80 @[7rem]:inline">
                      {day.total}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onAddBlock(day.iso)}
                    aria-label={`Add a block on ${day.iso}`}
                    title="Add a block"
                    className="btn btn-icon pointer-events-auto hidden h-6 rounded-md text-muted-foreground opacity-0 hover:bg-primary hover:text-primary-foreground focus-visible:opacity-100 group-hover:opacity-100 sm:flex touch:hidden"
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                  </button>
                </span>
              </div>

              {/* Phones: one dot per block. */}
              <div className="pointer-events-none relative z-10 flex flex-wrap items-center gap-1 pt-0.5 sm:hidden">
                {day.tasks.slice(0, DOTS).map((task) => (
                  <span
                    key={task.id}
                    className={["h-1.5 w-1.5 rounded-full", task.completed ? "bg-muted-foreground/35" : toneOf(task).dot].join(" ")}
                  />
                ))}
                {day.tasks.length > DOTS ? (
                  <span className="text-[10px] font-semibold leading-none text-muted-foreground">
                    +{day.tasks.length - DOTS}
                  </span>
                ) : null}
              </div>

              {/* Larger screens: a chip per block, as many as fit. */}
              <span
                ref={index === 0 ? listRef : undefined}
                className="pointer-events-none relative z-10 mb-1.5 hidden min-h-0 flex-1 flex-col gap-[3px] overflow-hidden sm:flex"
              >
                {chips.map((task) => (
                  <span
                    key={task.id}
                    title={task.title}
                    className={[
                      "flex h-5 shrink-0 items-center gap-1 truncate rounded-[5px] border px-1.5 text-xs font-medium leading-none",
                      task.completed
                        ? "border-transparent bg-foreground/[0.04] text-muted-foreground line-through decoration-foreground/30"
                        : toneOf(task).chip,
                      day.isPast && !task.completed ? "opacity-70" : "",
                    ].join(" ")}
                  >
                    <span aria-hidden="true" className={["shrink-0 text-[11px] leading-none", task.completed ? "opacity-50" : ""].join(" ")}>
                      {task.emoji}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{task.title}</span>
                    <span className="hidden shrink-0 text-[10px] tabular-nums opacity-65 @[9.5rem]:inline">
                      {shortTime(task.startMinutes)}
                    </span>
                  </span>
                ))}
                {more > 0 ? (
                  <span className="h-3.5 shrink-0 self-start px-1 text-[11px] font-medium leading-[14px] tabular-nums text-muted-foreground">
                    +{more} more
                  </span>
                ) : null}
              </span>

              {day.count > 0 && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-2 bottom-1.5 z-10 hidden h-[3px] overflow-hidden rounded-full bg-foreground/[0.06] sm:block"
                >
                  <span
                    className="block h-full rounded-full bg-success transition-[width] duration-500"
                    style={{ width: `${Math.round((day.done / day.count) * 100)}%` }}
                  />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
