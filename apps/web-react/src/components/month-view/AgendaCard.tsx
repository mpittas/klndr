import { addDaysISO, formatTime, formatTimeRange, mediumDate, type ScheduledTask } from "@klndr/core";
import { useCategoryColor, useTaskActions } from "@klndr/data";
import { Link } from "@tanstack/react-router";
import { Check, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { paletteOf } from "@/lib/colors";

/** How many blocks the agenda shows before "Show all". */
const COLLAPSED_COUNT = 8;

/**
 * The next two weeks as a compact list, grouped by day. Each block can be ticked off right here (it updates
 * the month grid at once), and opens its day when clicked. Done blocks can be hidden, and the list follows
 * the calendar's category filter.
 */
export function AgendaCard({
  today,
  tasks,
  loading,
  filtered,
  onAddBlock,
}: {
  today: string;
  /** The blocks of the next two weeks, already narrowed by the category filter, in date and start order. */
  tasks: ScheduledTask[];
  loading: boolean;
  filtered: boolean;
  onAddBlock: (day: string) => void;
}) {
  const colorOf = useCategoryColor();
  const { toggleComplete } = useTaskActions();
  const [hideDone, setHideDone] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const shown = hideDone ? tasks.filter((task) => !task.completed) : tasks;
  const visible = showAll ? shown : shown.slice(0, COLLAPSED_COUNT);
  const doneCount = tasks.filter((task) => task.completed).length;

  const groups = useMemo(() => {
    const byDay = new Map<string, ScheduledTask[]>();
    for (const task of visible) byDay.set(task.day, [...(byDay.get(task.day) ?? []), task]);
    return [...byDay.entries()];
  }, [visible]);

  const tomorrow = addDaysISO(today, 1);
  const labelOf = (day: string) => (day === today ? "Today" : day === tomorrow ? "Tomorrow" : mediumDate(day));

  return (
    <section className="rounded-xl border border-border bg-card p-3 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
          Agenda <span className="ml-1 font-medium normal-case tracking-normal text-muted-foreground">next 14 days</span>
        </h2>
        {doneCount > 0 && (
          <button
            type="button"
            role="switch"
            aria-checked={hideDone}
            onClick={() => setHideDone((value) => !value)}
            className="inline-flex h-6 cursor-pointer items-center gap-1.5 rounded-full px-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
          >
            <span
              aria-hidden="true"
              className={[
                "flex h-3 w-5 items-center rounded-full p-0.5 transition-colors",
                hideDone ? "bg-primary" : "bg-muted-foreground/30",
              ].join(" ")}
            >
              <span
                className={[
                  "h-2 w-2 rounded-full bg-background shadow-xs transition-transform",
                  hideDone ? "translate-x-2" : "",
                ].join(" ")}
              />
            </span>
            Hide done
          </button>
        )}
      </div>

      {loading && tasks.length === 0 ? (
        <div className="mt-2 space-y-1.5" aria-busy="true">
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-8 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="flex items-center justify-between gap-2 py-2">
          <p className="text-xs text-muted-foreground">
            {filtered
              ? "No blocks in the selected categories."
              : tasks.length
                ? "Everything is done. Nice."
                : "Nothing scheduled for two weeks."}
          </p>
          {!filtered && tasks.length === 0 && (
            <button
              type="button"
              onClick={() => onAddBlock(today)}
              className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground transition hover:bg-muted"
            >
              <Plus className="h-3 w-3" aria-hidden="true" />
              Add
            </button>
          )}
        </div>
      ) : (
        <div className="mt-1.5 space-y-2">
          {groups.map(([day, dayTasks]) => (
            <div key={day}>
              <h3
                className={[
                  "px-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  day === today ? "text-primary" : "text-muted-foreground",
                ].join(" ")}
              >
                {labelOf(day)}
              </h3>
              <ul>
                {dayTasks.map((task) => {
                  const tone = paletteOf(colorOf(task));
                  return (
                    <li
                      key={task.id}
                      className="group flex h-8 items-center gap-2 rounded-md px-1 transition hover:bg-muted/60"
                    >
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={task.completed}
                        aria-label={`${task.completed ? "Reopen" : "Complete"} ${task.title}`}
                        onClick={() => void toggleComplete(task)}
                        className={[
                          "flex h-[18px] w-[18px] shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          task.completed ? "border-emerald-500 bg-emerald-500 text-white" : `${tone.check} text-transparent`,
                        ].join(" ")}
                      >
                        <Check className="h-2.5 w-2.5" strokeWidth={3.5} aria-hidden="true" />
                      </button>
                      <Link
                        to="/day/$date"
                        params={{ date: task.day }}
                        title={`${task.title}, ${formatTimeRange(task.startMinutes, task.startMinutes + task.durationMinutes)}`}
                        className="flex min-w-0 flex-1 items-baseline gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span
                          className={[
                            "min-w-0 flex-1 truncate text-[13px] font-medium transition-colors",
                            task.completed ? "text-muted-foreground line-through" : "text-foreground group-hover:text-primary",
                          ].join(" ")}
                        >
                          {task.emoji} {task.title}
                        </span>
                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                          {formatTime(task.startMinutes)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {shown.length > COLLAPSED_COUNT && (
            <button
              type="button"
              onClick={() => setShowAll((value) => !value)}
              className="w-full cursor-pointer rounded-md py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
            >
              {showAll ? "Show less" : `Show all (${shown.length})`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
