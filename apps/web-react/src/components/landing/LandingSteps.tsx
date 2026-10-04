import type { CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { MockBlock } from "@/components/landing/MockBlock";
import { paletteOf } from "@/lib/colors";

// October 2026 starts on a Thursday, so the grid opens with the last days of September.
const DOTS: Record<number, string[]> = {
  1: ["amber", "indigo", "emerald"],
  2: ["amber", "rose"],
  5: ["indigo"],
  6: ["indigo", "emerald"],
  8: ["amber", "indigo", "violet"],
  9: ["emerald"],
  12: ["indigo", "slate"],
  13: ["emerald", "rose"],
  15: ["indigo"],
  16: ["amber", "emerald"],
  19: ["indigo", "violet"],
  20: ["emerald"],
  22: ["rose"],
  23: ["indigo", "emerald"],
  27: ["amber"],
  29: ["indigo"],
};
const cells = [
  ...[27, 28, 29, 30].map((n) => ({ n, inMonth: false, dots: [] as string[] })),
  ...Array.from({ length: 31 }, (_, i) => ({ n: i + 1, inMonth: true, dots: DOTS[i + 1] ?? [] })),
];
const TODAY = 1;
const PICKED = 8;

// The drop cursor, shared by the step scenes that show it. `cell.n === PICKED` is the tapped day.
function PointerArrow({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        d="M5.5 3.2v15.6c0 .5.6.7.9.4l3.6-3.7 2.4 5.4c.2.4.6.6 1 .4l1.9-.9c.4-.2.6-.6.4-1l-2.4-5.3h5.1c.5 0 .7-.6.4-.9L6.4 2.8c-.3-.3-.9-.1-.9.4z"
        fill="#0a0a0a"
        stroke="#fff"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 1: the month grid, with the eighth picked. */
function MonthScene() {
  return (
    <div className="scene w-[15.5rem] rounded-xl border border-border bg-card p-3 shadow-xs">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-tight text-foreground">October 2026</span>
        <span className="flex gap-1 text-muted-foreground">
          <ChevronLeft className="h-3.5 w-3.5" />
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="mt-2 grid grid-cols-7 text-center font-mono text-[9px] font-semibold uppercase text-muted-foreground">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-0.5">
        {cells.map((cell) => (
          <span
            key={`${cell.inMonth}-${cell.n}`}
            className={[
              "relative flex h-[1.65rem] flex-col items-center rounded-md pt-0.5 text-[10px] font-medium tabular-nums",
              !cell.inMonth ? "text-muted-foreground/50" : "text-foreground",
              cell.inMonth && cell.n === PICKED ? "bg-muted ring-1 ring-foreground/25" : "",
            ].join(" ")}
          >
            <span
              className={[
                "flex h-4 w-4 items-center justify-center rounded-full leading-none",
                cell.inMonth && cell.n === TODAY ? "bg-primary font-bold text-primary-foreground" : "",
              ].join(" ")}
            >
              {cell.n}
            </span>
            <span className="mt-px flex gap-px">
              {cell.dots.map((dot, i) => (
                <span key={i} className={`h-1 w-1 rounded-full ${paletteOf(dot).dot}`} />
              ))}
            </span>
            {cell.inMonth && cell.n === PICKED ? (
              <PointerArrow className="step-tap absolute left-3 top-3 z-10 h-5 w-5 drop-shadow" />
            ) : null}
          </span>
        ))}
      </div>
    </div>
  );
}

/** 2: dragging an activity onto an open slot. */
function DragScene() {
  const labels = ["9 AM", "", "10 AM", "", "11 AM", ""];

  return (
    <div className="scene relative w-[15.5rem] rounded-xl border border-border bg-card py-3 pr-3 shadow-xs">
      <div className="flex">
        <div className="w-11 shrink-0 border-r border-border pr-1.5 text-right font-mono text-[10px] text-muted-foreground">
          {labels.map((label, i) => (
            <div key={i} className="relative h-7">
              {label ? <span className="absolute -top-2 right-1.5">{label}</span> : null}
            </div>
          ))}
        </div>
        <div className="relative flex-1 border-t border-border">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className={["h-7 border-b", i % 2 === 0 ? "border-border/70" : "border-dashed border-border/30"].join(
                " ",
              )}
            />
          ))}
          <div className="absolute inset-x-1 top-[2px] h-[80px]">
            <MockBlock emoji="🛠️" title="Deep work" color="indigo" meta="9:00 – 10:30 AM" />
            <span className="absolute inset-x-0 bottom-1 mx-auto h-0.5 w-6 rounded-full bg-foreground/25" />
            <span className="absolute -right-1 bottom-0 translate-y-1/2 rounded-md bg-primary px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary-foreground shadow-xs">
              1h 30m
            </span>
          </div>
          <div
            className={`absolute inset-x-1.5 top-[86px] flex h-[52px] items-center justify-center rounded-lg border border-dashed ${paletteOf("emerald").ghost}`}
          />
        </div>
      </div>
      <div className="step-float absolute left-14 top-[6.6rem] flex w-40 items-center gap-2 rounded-md border border-border bg-card px-2 py-1 shadow-lg">
        <span
          className={`flex h-5 w-5 items-center justify-center rounded text-[10px] ${paletteOf("emerald").icon}`}
        >
          🏋️
        </span>
        <span className="flex-1 truncate text-[11px] font-medium text-foreground">Workout</span>
        <span className="font-mono text-[10px] text-muted-foreground">1h</span>
        <PointerArrow className="absolute -bottom-3 right-5 h-5 w-5 drop-shadow" />
      </div>
    </div>
  );
}

/** 3: ticking blocks off, with the now-line between them. */
function TickScene() {
  return (
    <div className="scene w-[15.5rem] rounded-xl border border-border bg-card p-3 shadow-xs">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-tight text-foreground">Today</span>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">3/4 done</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-3/4 rounded-full bg-emerald-500" />
      </div>
      <div className="mt-3 space-y-1.5">
        <div className="h-8">
          <MockBlock compact done emoji="☀️" title="Morning routine" color="amber" />
        </div>
        <div className="h-8">
          <MockBlock compact done emoji="🛠️" title="Working on projects" color="indigo" />
        </div>
        <div className="h-8">
          <MockBlock compact done emoji="🏋️" title="Workout" color="emerald" />
        </div>
        <div className="relative flex items-center py-0.5">
          <span className="absolute -left-1 h-2 w-2 rounded-full bg-rose-500" />
          <span className="h-[1.5px] w-full bg-rose-500/80" />
        </div>
        <div className="h-8">
          <MockBlock compact emoji="📚" title="Study / learning" color="rose" />
        </div>
      </div>
    </div>
  );
}

// Each step's scene is tinted with the color of what it shows.
const steps = [
  {
    tint: "#6366f1",
    title: "Pick a day",
    text: "Open the month view and choose any date. Every day shows what's planned, so busy and open days stand out.",
  },
  {
    tint: "#10b981",
    title: "Drag in activities",
    text: "Drop deep work, workouts or chores onto the timeline. Blocks snap to the quarter hour and stretch to fit.",
  },
  {
    tint: "#f59e0b",
    title: "Tick them off",
    text: "Check blocks off as you go. A live now-line shows where you are, with your daily routines up top.",
  },
];

export function LandingSteps() {
  return (
    <section id="how-it-works" className="scroll-mt-16 border-t border-border/60 bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div data-reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-4xl font-semibold tracking-[-0.04em] text-foreground sm:text-5xl lg:text-[3.5rem] lg:leading-[1.04]">
            Three moves <span className="block text-muted-foreground">to a planned day.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            No setup and no learning curve. Tomorrow is planned in the time it takes to make a coffee.
          </p>
        </div>

        <ol className="mt-14 grid gap-5 sm:mt-16 md:grid-cols-3">
          {steps.map((step, index) => (
            <li
              key={step.title}
              data-reveal
              style={{ "--reveal-delay": `${index * 90}ms`, "--tint": step.tint } as CSSProperties}
              className="lift-card flex flex-col rounded-2xl border border-border bg-card p-2 shadow-2xs"
            >
              <div
                aria-hidden="true"
                className="stage relative flex h-60 items-center justify-center overflow-hidden rounded-xl"
              >
                {index === 0 ? <MonthScene /> : index === 1 ? <DragScene /> : <TickScene />}
              </div>

              <div className="px-4 pb-5 pt-5 sm:px-5">
                <h3 className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-foreground">
                  <span className="step-badge flex h-6 w-6 shrink-0 items-center justify-center rounded-md border font-mono text-xs font-semibold text-foreground">
                    {index + 1}
                  </span>
                  {step.title}
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
