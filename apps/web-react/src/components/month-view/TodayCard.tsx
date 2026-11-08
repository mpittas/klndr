import { formatTime, mediumDate, nowMinutes, type ScheduledTask } from "@klndr/core";
import { useCategoryColor } from "@klndr/data";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Plus } from "lucide-react";

import { paletteOf } from "@/lib/colors";

/**
 * Where today stands in one compact block: the date, how many blocks are done, and what comes next (or a
 * way to start planning when the day is empty).
 */
export function TodayCard({
  today,
  tasks,
  onAddBlock,
}: {
  today: string;
  /** Today's blocks, in start order. */
  tasks: ScheduledTask[];
  onAddBlock: (day: string) => void;
}) {
  const colorOf = useCategoryColor();
  const done = tasks.filter((task) => task.completed).length;
  const percent = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const open = tasks.filter((task) => !task.completed);
  const now = nowMinutes();
  const next = open.find((task) => task.startMinutes + task.durationMinutes > now) ?? null;
  const isNow = next ? next.startMinutes <= now : false;

  return (
    <section className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="card-title min-w-0 truncate">
          <span className="text-brand">Today</span>
          <span className="card-meta ml-1.5">{mediumDate(today)}</span>
        </h2>
        <Link
          to="/day/$date"
          params={{ date: today }}
          aria-label="Open today"
          title="Open today"
          className="btn btn-ghost btn-xs btn-icon -mr-1.5"
        >
          <ArrowUpRight aria-hidden="true" />
        </Link>
      </div>

      {tasks.length === 0 ? (
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-[13px] text-muted-foreground">Nothing planned yet.</p>
          <button type="button" onClick={() => onAddBlock(today)} className="btn btn-primary btn-xs px-2.5">
            <Plus aria-hidden="true" />
            Plan today
          </button>
        </div>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-3">
            <div
              role="progressbar"
              aria-label="Blocks done today"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="progress flex-1"
            >
              <span className="progress-bar" style={{ width: `${percent}%` }} />
            </div>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              <span className="font-semibold text-foreground">{done}</span>/{tasks.length} done
            </span>
          </div>

          {open.length === 0 ? (
            <p className="mt-3 text-[13px] font-medium text-success">All done for today 🎉</p>
          ) : next ? (
            <Link
              to="/day/$date"
              params={{ date: today }}
              className="group mt-3 flex items-center gap-3 rounded-lg border border-border/80 bg-muted/40 p-2 transition-colors hover:bg-muted"
            >
              <span
                className={[
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm leading-none",
                  paletteOf(colorOf(next)).icon,
                ].join(" ")}
                aria-hidden="true"
              >
                {next.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-foreground">{next.title}</span>
                <span className="block text-xs tabular-nums text-muted-foreground">
                  <span className={isNow ? "font-semibold text-brand" : "font-medium"}>{isNow ? "Now" : "Next"}</span>
                  {" · "}
                  {formatTime(next.startMinutes)}
                </span>
              </span>
              <ArrowUpRight
                className="mr-0.5 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                aria-hidden="true"
              />
            </Link>
          ) : (
            <p className="mt-3 text-[13px] text-muted-foreground">
              {open.length} earlier {open.length === 1 ? "block" : "blocks"} still open
            </p>
          )}
        </>
      )}
    </section>
  );
}
