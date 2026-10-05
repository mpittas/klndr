import { formatTime, parseISODate, type ScheduledTask } from "@klndr/core";
import { useCategoryColor } from "@klndr/data";
import { Link } from "@tanstack/react-router";

import { paletteOf } from "@/lib/colors";

export function MonthSidebar({ upcoming }: { upcoming: ScheduledTask[] }) {
  const colorOf = useCategoryColor();
  const toneOf = (task: { category: string; color?: string }) => paletteOf(colorOf(task));

  return (
    <aside className="space-y-4">
      <section className="rounded-xl border border-border bg-card p-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">Upcoming</h2>
          <span className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 font-mono text-xs font-medium text-muted-foreground">
            Next 14 days
          </span>
        </div>
        {upcoming.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Nothing scheduled yet. Open a date and drop activities onto the timeline.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {upcoming.map((task) => (
              <li key={task.id}>
                <Link
                  to="/day/$date"
                  params={{ date: task.day }}
                  className="group flex min-h-12 items-start gap-2.5 rounded-lg border border-border bg-card p-3 shadow-2xs transition hover:border-foreground/20 hover:bg-muted/40 hover:shadow-xs active:bg-muted/60 sm:p-2.5"
                >
                  <span className={["mt-1.5 h-2 w-2 shrink-0 rounded-full", toneOf(task).dot].join(" ")} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                      {task.emoji} {task.title}
                    </span>
                    <span className="block font-mono text-xs tabular-nums text-muted-foreground">
                      {parseISODate(task.day).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                      {" · "}
                      {formatTime(task.startMinutes)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-4 shadow-xs">
        <h2 className="border-b border-border pb-2 text-xs font-semibold uppercase tracking-wider text-foreground">
          Tips &amp; Shortcuts
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2.5">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
            <span className="touch:hidden">Click any date cell to plan that day's schedule</span>
            <span className="hidden touch:inline">Tap any date to plan that day's schedule</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
            <span className="touch:hidden">Drag activities directly onto the timeline grid</span>
            <span className="hidden touch:inline">
              Tap Activities to drop one onto the timeline, or tap an empty slot to add a block
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
            <span className="touch:hidden">Click a block to edit it or toggle its completion</span>
            <span className="hidden touch:inline">Tap a block to edit it. Press and hold, then drag, to move it</span>
          </li>
        </ul>
      </section>
    </aside>
  );
}
