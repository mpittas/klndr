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
    <section className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="card-title">
          Agenda <span className="card-meta ml-1.5">Next 14 days</span>
        </h2>
        {doneCount > 0 && (
          <button
            type="button"
            role="switch"
            aria-checked={hideDone}
            onClick={() => setHideDone((value) => !value)}
            className="-mr-1.5 inline-flex h-6 cursor-pointer items-center gap-1.5 rounded-full px-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            <span
              aria-hidden="true"
              className={[
                "flex h-3.5 w-6 items-center rounded-full p-0.5 transition-colors",
                hideDone ? "bg-primary" : "bg-foreground/15",
              ].join(" ")}
            >
              <span
                className={[
                  "h-2.5 w-2.5 rounded-full bg-background shadow-xs transition-transform",
                  hideDone ? "translate-x-2.5" : "",
                ].join(" ")}
              />
            </span>
            Hide done
          </button>
        )}
      </div>

      {loading && tasks.length === 0 ? (
        <div className="mt-3 space-y-1.5" aria-busy="true">
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-8 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-[13px] text-muted-foreground">
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
              className="btn btn-secondary btn-xs"
            >
              <Plus className="h-3 w-3" aria-hidden="true" />
              Add
            </button>
          )}
        </div>
      ) : (
        <div className="-mx-1.5 mt-2 space-y-2.5">
          {groups.map(([day, dayTasks]) => (
            <div key={day}>
              <h3
                className={[
                  "px-1.5 pb-1 text-xs font-medium",
                  day === today ? "text-brand" : "text-muted-foreground",
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
                      className="group flex h-9 items-center gap-2.5 rounded-lg px-1.5 transition-colors hover:bg-muted/70"
                    >
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={task.completed}
                        aria-label={`${task.completed ? "Reopen" : "Complete"} ${task.title}`}
                        onClick={() => void toggleComplete(task)}
                        className={[
                          "tick h-[18px] w-[18px]",
                          task.completed ? "" : tone.check,
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
                            task.completed ? "text-muted-foreground line-through decoration-foreground/30" : "text-foreground",
                          ].join(" ")}
                        >
                          {task.emoji} {task.title}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
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
              className="btn btn-ghost btn-xs w-full"
            >
              {showAll ? "Show less" : `Show all (${shown.length})`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
