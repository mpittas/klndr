import type { CSSProperties } from "react";
import { formatDuration, formatTimeRange, gutterLabel } from "@klndr/core";
import { ArrowRight, CircleHelp } from "lucide-react";

import { MockBlock } from "@/components/landing/MockBlock";

const START = 9 * 60;
const END = 19 * 60;
const SLOT = 22; // px per half hour
const rows = Array.from({ length: (END - START) / 30 }, (_, i) => START + i * 30);

// The same six tasks, first as a list and then given a time.
const tasks = [
  { emoji: "🛠️", title: "Finish the project draft", color: "indigo", start: 9 * 60, duration: 120 },
  { emoji: "📬", title: "Answer emails", color: "slate", start: 11 * 60, duration: 30 },
  { emoji: "🛒", title: "Groceries", color: "pink", start: 13 * 60, duration: 60 },
  { emoji: "🧽", title: "Clean the kitchen", color: "violet", start: 14 * 60 + 30, duration: 45 },
  { emoji: "🏋️", title: "Gym", color: "emerald", start: 17 * 60, duration: 60 },
  { emoji: "📖", title: "Read 20 pages", color: "rose", start: 18 * 60 + 30, duration: 30 },
];
const listOrder = [4, 1, 0, 5, 2, 3].map((i) => tasks[i]);
const planned = tasks.reduce((sum, task) => sum + task.duration, 0);

export function LandingCompare() {
  return (
    <section id="why" className="scroll-mt-16 overflow-hidden border-t border-border/60 bg-canvas py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div data-reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-4xl font-semibold tracking-[-0.04em] text-foreground sm:text-5xl lg:text-[3.5rem] lg:leading-[1.04]">
            <span className="block text-muted-foreground">A to-do list says what.</span> A timeline says when.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            Lists only grow, because nothing on them has a time. Give each task a slot and you'll see whether your day
            actually fits, before it starts.
          </p>
        </div>

        <div className="isolate mx-auto mt-14 grid max-w-4xl items-center gap-4 sm:mt-16 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-6">
          {/* Before: a list */}
          <div
            data-reveal
            className="flex h-full flex-col rounded-2xl border border-border bg-card/70 p-5 shadow-2xs sm:p-6"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">To-do</p>
              <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                {tasks.length}
              </span>
            </div>
            <ul className="mt-4 flex-1 divide-y divide-border/70">
              {listOrder.map((task) => (
                <li key={task.title} className="flex items-center gap-3 py-3 text-[15px] text-muted-foreground">
                  <span className="h-4.5 w-4.5 shrink-0 rounded-full border-[1.5px] border-muted-foreground/40" />
                  {task.title}
                </li>
              ))}
            </ul>
            <p className="mt-4 flex items-center gap-2 rounded-lg bg-muted/70 px-3 py-2.5 text-[13px] text-muted-foreground">
              <CircleHelp className="h-4 w-4 shrink-0" aria-hidden="true" />
              No times, no order. Does it all fit?
            </p>
          </div>

          {/* Arrow */}
          <div data-reveal className="flex justify-center [--reveal-delay:80ms]" aria-hidden="true">
            <span className="btn-primary flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <ArrowRight className="h-4 w-4 rotate-90 lg:rotate-0" />
            </span>
          </div>

          {/* After: the same tasks on a timeline */}
          <div data-reveal className="relative [--reveal-delay:160ms]">
            <div aria-hidden="true" className="pointer-events-none absolute -inset-8 -z-10">
              <div className="absolute left-0 top-[10%] h-1/2 w-2/3 rounded-full bg-indigo-300/40 blur-3xl dark:bg-indigo-500/20" />
              <div className="absolute bottom-[6%] right-0 h-1/2 w-2/3 rounded-full bg-emerald-200/50 blur-3xl dark:bg-emerald-500/15" />
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_2px_rgb(15_23_42/0.05),0_24px_56px_-28px_rgb(15_23_42/0.35)] sm:p-6 dark:shadow-[0_24px_56px_-28px_rgb(0_0_0/0.7)]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">Thursday</p>
                <span className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                  {formatDuration(planned)} planned
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {formatDuration(END - START - planned)} free
                  </span>
                </span>
              </div>
              <div
                className="mt-5 flex"
                role="img"
                aria-label={`The same six tasks placed on a timeline from 9 AM to 7 PM, ${formatDuration(planned)} planned.`}
              >
                <div className="w-12 shrink-0 border-r border-border pr-2 text-right" aria-hidden="true">
                  {rows.map((minute) => (
                    <div key={minute} className="relative" style={{ height: `${SLOT}px` }}>
                      {gutterLabel(minute) ? (
                        <span className="absolute -top-2 right-0 font-mono text-[10px] text-muted-foreground">
                          {gutterLabel(minute)}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div className="relative flex-1 border-t border-border" aria-hidden="true">
                  {rows.map((minute) => (
                    <div
                      key={minute}
                      style={{ height: `${SLOT}px` }}
                      className={[
                        "border-b",
                        (minute + 30) % 60 === 0 ? "border-border/70" : "border-dashed border-border/30",
                      ].join(" ")}
                    />
                  ))}
                  {tasks.map((task, index) => (
                    <div
                      key={task.title}
                      className="compare-block absolute left-[2%] w-[96%]"
                      style={
                        {
                          top: `${((task.start - START) / 30) * SLOT + 2}px`,
                          height: `${(task.duration / 30) * SLOT - 4}px`,
                          "--i": index,
                        } as CSSProperties
                      }
                    >
                      <MockBlock
                        emoji={task.emoji}
                        title={task.title}
                        color={task.color}
                        compact={task.duration < 60}
                        meta={
                          task.duration >= 120 ? formatTimeRange(task.start, task.start + task.duration) : undefined
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
