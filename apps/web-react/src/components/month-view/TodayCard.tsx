import { formatTime, mediumDate, nowMinutes, type ScheduledTask } from "@klndr/core";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Plus } from "lucide-react";

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
  const done = tasks.filter((task) => task.completed).length;
  const percent = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const open = tasks.filter((task) => !task.completed);
  const now = nowMinutes();
  const next = open.find((task) => task.startMinutes + task.durationMinutes > now) ?? null;

  return (
    <section className="rounded-xl border border-border bg-card p-3 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <h2 className="min-w-0 truncate text-sm font-semibold text-foreground">
          <span className="mr-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">Today</span>
          {mediumDate(today)}
        </h2>
        <Link
          to="/day/$date"
          params={{ date: today }}
          aria-label="Open today"
          title="Open today"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      {tasks.length === 0 ? (
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Nothing planned yet.</p>
          <button
            type="button"
            onClick={() => onAddBlock(today)}
            className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md bg-primary px-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            Plan today
          </button>
        </div>
      ) : (
        <>
          <div className="mt-2 flex items-center gap-2">
            <div
              role="progressbar"
              aria-label="Blocks done today"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
            >
              <div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${percent}%` }} />
            </div>
            <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
              <span className="font-semibold text-foreground">{done}</span>/{tasks.length} done
            </span>
          </div>

          <p className="mt-2 truncate text-xs text-muted-foreground">
            {open.length === 0 ? (
              <span className="font-medium text-emerald-600 dark:text-emerald-400">All done for today 🎉</span>
            ) : next ? (
              <>
                <span className="font-semibold uppercase tracking-wider text-[10px]">
                  {next.startMinutes <= now ? "Now" : "Next"}
                </span>{" "}
                <Link
                  to="/day/$date"
                  params={{ date: today }}
                  className="font-medium text-foreground hover:text-primary"
                >
                  {next.emoji} {next.title}
                </Link>{" "}
                <span className="font-mono tabular-nums">{formatTime(next.startMinutes)}</span>
              </>
            ) : (
              <>
                {open.length} earlier {open.length === 1 ? "block" : "blocks"} still open
              </>
            )}
          </p>
        </>
      )}
    </section>
  );
}
