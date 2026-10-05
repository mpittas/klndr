import type { CSSProperties, RefObject } from "react";
import { formatDuration, formatTime, formatTimeRange, gutterLabel } from "@klndr/core";
import { Check, ChevronLeft, ChevronRight, Moon, Plus, Search } from "lucide-react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { MockBlock } from "@/components/landing/MockBlock";
import { paletteOf } from "@/lib/colors";

/**
 * The hero's picture of the day planner: the
 * activity library beside a morning on the timeline, with one activity being dragged across and
 * dropped into an open slot, on a loop.
 */

const START = 8 * 60;
const END = 13 * 60;
const SLOT = 44; // px per half hour
const NOW = 10 * 60 + 20;

const top = (minutes: number) => ((minutes - START) / 30) * SLOT;
const height = (duration: number) => (duration / 30) * SLOT - 4;
const rows = Array.from({ length: (END - START) / 30 }, (_, i) => START + i * 30);
const span = (start: number, duration: number) => formatTimeRange(start, start + duration);

const blocks = [
  { emoji: "☀️", title: "Morning routine", color: "amber", start: 8 * 60, duration: 45, done: true },
  { emoji: "🛠️", title: "Working on projects", color: "indigo", start: 9 * 60, duration: 120 },
  { emoji: "📬", title: "Emails & admin", color: "slate", start: 11 * 60, duration: 30 },
  { emoji: "🍽️", title: "Lunch", color: "orange", start: 12 * 60, duration: 45 },
];

const dropped = { emoji: "🚶", title: "Walk outside", color: "emerald", start: 11 * 60 + 30, duration: 30 };

const groups = [
  {
    name: "Daily routines",
    color: "amber",
    items: [
      { emoji: "☀️", title: "Morning routine", duration: 45 },
      { emoji: "🍽️", title: "Meals", duration: 45 },
      { emoji: "🌙", title: "Evening wind-down", duration: 30 },
    ],
  },
  {
    name: "Work",
    color: "indigo",
    items: [
      { emoji: "🛠️", title: "Working on projects", duration: 120 },
      { emoji: "📬", title: "Emails & admin", duration: 30 },
      { emoji: "👥", title: "Meeting", duration: 60 },
    ],
  },
  {
    name: "Health",
    color: "emerald",
    items: [
      { emoji: "🏋️", title: "Workout", duration: 60 },
      { emoji: "🚶", title: "Walk outside", duration: 30 },
    ],
  },
];

const collapsedGroups = [
  { name: "Home", color: "violet", count: 3 },
  { name: "Growth", color: "rose", count: 1 },
];

const routines = [
  { emoji: "💊", title: "Vitamins", done: true },
  { emoji: "💧", title: "Drink 2L water", done: false },
  { emoji: "🧘", title: "10 min stretch", done: true },
  { emoji: "🚿", title: "Morning shower", done: false },
];

/** Position of `el` inside `ancestor` in layout pixels, so the hero's entrance transform can't skew it. */
function offsetWithin(el: HTMLElement, ancestor: HTMLElement) {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== ancestor) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

export function PlannerMock() {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const sourceRef = useRef<HTMLLIElement | null>(null);
  const targetRef = useRef<HTMLDivElement | null>(null);
  const [flight, setFlight] = useState<CSSProperties | null>(null);
  const [playing, setPlaying] = useState(false);

  // The dragged chip flies from the library item to the open slot. Both move with the layout,
  // so the path is measured rather than hard-coded. Phones hide the library and skip the flight.
  const measure = useCallback(() => {
    const root = bodyRef.current;
    const from = sourceRef.current;
    const to = targetRef.current;
    if (!root || !from || !to || !from.offsetParent) {
      setFlight(null);
      return;
    }
    const a = offsetWithin(from, root);
    const b = offsetWithin(to, root);
    setFlight({
      top: `${a.y}px`,
      left: `${a.x}px`,
      width: `${from.offsetWidth}px`,
      "--dx": `${b.x - a.x + 12}px`,
      "--dy": `${b.y - a.y + (to.offsetHeight - from.offsetHeight) / 2}px`,
    } as CSSProperties);
  }, []);

  useLayoutEffect(() => {
    measure();

    const root = bodyRef.current;
    if (!root) return;

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(root);

    // Only loop while the mock is on screen.
    const visibilityObserver = new IntersectionObserver(([entry]) => setPlaying(entry.isIntersecting));
    visibilityObserver.observe(root);

    return () => {
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
    };
  }, [measure]);

  return <PlannerMockBody bodyRef={bodyRef} sourceRef={sourceRef} targetRef={targetRef} flight={flight} playing={playing} />;
}

/**
 * The mock's markup. It is separate from `PlannerMock` only so the refs that drive the drag
 * measurement and the visibility loop can live in the stateful half; nothing here is interactive.
 */
type PlannerMockBodyProps = {
  bodyRef: RefObject<HTMLDivElement | null>;
  sourceRef: RefObject<HTMLLIElement | null>;
  targetRef: RefObject<HTMLDivElement | null>;
  flight: CSSProperties | null;
  playing: boolean;
};

function PlannerMockBody({ bodyRef, sourceRef, targetRef, flight, playing }: PlannerMockBodyProps) {
  return (
    <div
      role="img"
      aria-label="The klndr. day planner: an activity library beside an hour-by-hour timeline, with a walk being dragged into an open slot at 11:30 AM."
      className="overflow-hidden rounded-2xl border border-border bg-background text-left shadow-xs"
    >
      {/* App bar */}
      <div className="flex h-11 items-center justify-between border-b border-border px-3 sm:px-4">
        <div className="flex items-center gap-3">
          <span className="text-[15px] font-bold tracking-tight text-foreground">klndr.</span>
          <span className="hidden h-7 items-center rounded-lg bg-muted p-0.5 text-[11px] font-medium text-muted-foreground sm:inline-flex">
            <span className="px-2.5 py-1">Calendar</span>
            <span className="rounded-md bg-primary px-2.5 py-1 font-semibold text-primary-foreground shadow-xs">
              Day
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-input text-foreground">
            <Moon className="h-3.5 w-3.5" />
          </span>
          <span className="flex h-7 items-center gap-1.5 rounded-md border border-input px-1 text-[11px] font-medium text-foreground sm:pr-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[9px] font-semibold text-primary-foreground">
              AL
            </span>
            <span className="hidden sm:inline">Alex</span>
          </span>
        </div>
      </div>

      <div ref={bodyRef} className={`relative grid md:grid-cols-[15rem_minmax(0,1fr)] ${playing ? "is-playing" : ""}`}>
        {/* Activity library */}
        <aside className="hidden flex-col border-r border-border bg-background md:flex">
          <div className="flex items-center gap-0.5 whitespace-nowrap border-b border-border px-2 py-2 text-[11px] font-medium text-muted-foreground">
            <span className="rounded-md bg-muted px-2 py-1 font-semibold text-foreground">
              Activities <span className="ml-0.5 font-mono font-medium text-muted-foreground">12</span>
            </span>
            <span className="px-1.5 py-1">
              Checklist <span className="font-mono">2/4</span>
            </span>
            <span className="px-1.5 py-1">Notes</span>
          </div>
          <div className="px-3 pb-2 pt-2.5">
            <div className="flex h-8 items-center gap-2 rounded-lg border border-input bg-background px-2.5 text-xs text-muted-foreground shadow-xs">
              <Search className="h-3.5 w-3.5" />
              Search activities
            </div>
          </div>
          <div className="space-y-2 px-2 pb-3 pt-1">
            {groups.map((group) => (
              <section key={group.name} className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-2xs">
                <div className="flex items-center justify-between gap-2 bg-muted/40 px-2.5 py-1.5 text-xs font-semibold text-foreground">
                  <span className="flex items-center gap-2">
                    <ChevronRight className="h-3 w-3 rotate-90 text-foreground" />
                    <span className={`h-2 w-2 rounded-full ${paletteOf(group.color).dot}`} />
                    {group.name}
                  </span>
                  <span className="rounded-full border border-border bg-background px-1.5 font-mono text-[10px] text-muted-foreground">
                    {group.items.length}
                  </span>
                </div>
                <ul className="space-y-0.5 border-t border-border/40 p-1">
                  {group.items.map((item) => (
                    <li
                      key={item.title}
                      ref={item.title === dropped.title ? sourceRef : undefined}
                      className={[
                        "flex items-center gap-2 rounded-md px-2 py-1",
                        item.title === dropped.title ? "mock-source" : "",
                      ].join(" ")}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs leading-none ${paletteOf(group.color).icon}`}
                      >
                        {item.emoji}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{item.title}</span>
                      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                        {formatDuration(item.duration)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {collapsedGroups.map((group) => (
              <div
                key={group.name}
                className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/40 px-2.5 py-1.5 text-xs font-semibold text-foreground shadow-2xs"
              >
                <span className="flex items-center gap-2">
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  <span className={`h-2 w-2 rounded-full ${paletteOf(group.color).dot}`} />
                  {group.name}
                </span>
                <span className="rounded-full border border-border bg-background px-1.5 font-mono text-[10px] text-muted-foreground">
                  {group.count}
                </span>
              </div>
            ))}
          </div>
        </aside>

        <div className="min-w-0">
          {/* Day header */}
          <div className="flex h-12 items-center justify-between gap-2 border-b border-border pl-1.5 pr-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
              <span className="flex text-muted-foreground">
                <ChevronLeft className="h-7 w-7 p-1.5" />
                <ChevronRight className="h-7 w-7 p-1.5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-tight tracking-tight text-foreground">
                  Thursday, October 1
                </p>
                <p className="relative font-mono text-[11px] leading-tight tabular-nums text-muted-foreground">
                  <span className="mock-stat-before">4h planned · 1/4 done</span>
                  <span className="mock-stat-after absolute inset-0 whitespace-nowrap">
                    4h 30m planned · 1/5 done
                  </span>
                </p>
              </div>
            </div>
            <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground">
              <Plus className="h-3.5 w-3.5" />
              Block
            </span>
          </div>

          {/* Routines */}
          <div className="flex items-center gap-2 overflow-hidden border-b border-border/40 px-3 py-2.5 [mask-image:linear-gradient(to_right,black_85%,transparent)] sm:px-5">
            <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
              Routines
            </span>
            {routines.map((routine) => (
              <span
                key={routine.title}
                className={[
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium shadow-2xs",
                  routine.done
                    ? "border-border/60 bg-muted/50 text-muted-foreground line-through opacity-70"
                    : "border-border bg-card text-foreground",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-3.5 w-3.5 items-center justify-center rounded-full border text-[9px]",
                    routine.done
                      ? "border-emerald-600 bg-emerald-600 font-bold text-white"
                      : "border-muted-foreground/40 text-transparent",
                  ].join(" ")}
                >
                  ✓
                </span>
                {routine.emoji} {routine.title}
              </span>
            ))}
          </div>

          {/* Timeline */}
          <div className="flex pb-5 pr-3 pt-5 sm:pr-5">
            <div className="relative w-14 shrink-0 border-r border-border pr-1.5 sm:w-16 sm:pr-2.5">
              {rows.map((minute) => (
                <div key={minute} className="relative" style={{ height: `${SLOT}px` }}>
                  {gutterLabel(minute) ? (
                    <span className="absolute -top-2.5 right-1.5 font-mono text-[11px] font-medium tracking-tight text-muted-foreground sm:right-2 sm:text-xs">
                      {gutterLabel(minute)}
                    </span>
                  ) : null}
                </div>
              ))}
              <span
                className="absolute right-0.5 z-30 -translate-y-1/2 whitespace-nowrap rounded-md bg-rose-500 px-1 py-0.5 font-mono text-[10px] font-bold leading-none text-white shadow-xs sm:right-1 sm:px-1.5"
                style={{ top: `${top(NOW)}px` }}
              >
                {formatTime(NOW)}
              </span>
            </div>

            <div className="relative flex-1 border-t border-border" style={{ height: `${rows.length * SLOT}px` }}>
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

              {/* Now line */}
              <div className="absolute inset-x-0 z-20 flex items-center" style={{ top: `${top(NOW)}px` }}>
                <span className="absolute -left-1 flex h-2 w-2 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
                </span>
                <span className="h-[1.5px] w-full bg-rose-500/80" />
              </div>

              {blocks.map((block) => (
                <div
                  key={block.title}
                  className="absolute left-[1%] z-10 w-[98%]"
                  style={{ top: `${top(block.start) + 2}px`, height: `${height(block.duration)}px` }}
                >
                  <MockBlock
                    emoji={block.emoji}
                    title={block.title}
                    color={block.color}
                    done={block.done}
                    meta={span(block.start, block.duration)}
                  />
                </div>
              ))}

              {/* Where the dragged activity will land */}
              <div
                className={`mock-ghost absolute left-[2%] z-30 flex w-[96%] items-center justify-center rounded-lg border border-dashed ${paletteOf(dropped.color).ghost}`}
                style={{ top: `${top(dropped.start)}px`, height: `${(dropped.duration / 30) * SLOT}px` }}
              >
                <span className="rounded-full border border-border bg-background px-3 py-1 font-mono text-xs font-semibold text-foreground shadow-2xs">
                  {dropped.title} · {formatTime(dropped.start)}
                </span>
              </div>

              <div
                ref={targetRef}
                className="mock-drop absolute left-[1%] z-10 w-[98%]"
                style={{ top: `${top(dropped.start) + 2}px`, height: `${height(dropped.duration)}px` }}
              >
                <MockBlock
                  emoji={dropped.emoji}
                  title={dropped.title}
                  color={dropped.color}
                  meta={span(dropped.start, dropped.duration)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* The activity being dragged, with the pointer carrying it */}
        {flight ? (
          <div className="mock-flight pointer-events-none absolute z-40" style={flight}>
            <div className="mock-chip flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1 shadow-lg">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs leading-none ${paletteOf(dropped.color).icon}`}
              >
                {dropped.emoji}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{dropped.title}</span>
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {formatDuration(dropped.duration)}
              </span>
            </div>
            <svg className="mock-cursor absolute -bottom-3.5 left-1/2 h-6 w-6 drop-shadow-md" viewBox="0 0 24 24">
              <path
                d="M5.5 3.2v15.6c0 .5.6.7.9.4l3.6-3.7 2.4 5.4c.2.4.6.6 1 .4l1.9-.9c.4-.2.6-.6.4-1l-2.4-5.3h5.1c.5 0 .7-.6.4-.9L6.4 2.8c-.3-.3-.9-.1-.9.4z"
                fill="#0a0a0a"
                stroke="#fff"
                strokeWidth={1.4}
                strokeLinejoin="round"
              />
            </svg>
          </div>
        ) : null}
      </div>
    </div>
  );
}
