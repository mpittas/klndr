import { COLOR_KEYS } from "@klndr/core";
import { ArrowUpDown, Check, Clock, Columns2, Contrast, Plus } from "lucide-react";

import { MockBlock } from "@/components/landing/MockBlock";
import { paletteOf } from "@/lib/colors";

type Chip = { time: string; title: string; color: string };

// Two weeks of the month view around "today" (Thursday, October 1).
const weeks: { n: number; inMonth: boolean; total?: string; chips: Chip[]; more?: number }[][] = [
  [
    { n: 27, inMonth: false, chips: [] },
    { n: 28, inMonth: false, chips: [] },
    { n: 29, inMonth: false, chips: [] },
    { n: 30, inMonth: false, chips: [] },
    {
      n: 1,
      inMonth: true,
      total: "5h",
      chips: [
        { time: "7:00", title: "Morning routine", color: "amber" },
        { time: "9:00", title: "Working on projects", color: "indigo" },
        { time: "11:30", title: "Emails & admin", color: "slate" },
      ],
      more: 2,
    },
    {
      n: 2,
      inMonth: true,
      total: "3h 45m",
      chips: [
        { time: "7:00", title: "Morning routine", color: "amber" },
        { time: "10:00", title: "Deep clean", color: "indigo" },
        { time: "3:00", title: "Study / learning", color: "rose" },
      ],
    },
    { n: 3, inMonth: true, total: "1h", chips: [{ time: "1:00", title: "Errands", color: "pink" }] },
  ],
  [
    { n: 4, inMonth: true, chips: [] },
    {
      n: 5,
      inMonth: true,
      total: "3h",
      chips: [
        { time: "9:00", title: "Working on projects", color: "indigo" },
        { time: "6:00", title: "Workout", color: "emerald" },
      ],
    },
    { n: 6, inMonth: true, total: "1h", chips: [{ time: "8:00", title: "Meeting", color: "violet" }] },
    {
      n: 7,
      inMonth: true,
      total: "1h 45m",
      chips: [
        { time: "7:00", title: "Morning routine", color: "amber" },
        { time: "6:00", title: "Workout", color: "emerald" },
      ],
    },
    {
      n: 8,
      inMonth: true,
      total: "2h 45m",
      chips: [
        { time: "9:00", title: "Working on projects", color: "indigo" },
        { time: "12:30", title: "Meals", color: "orange" },
      ],
    },
    { n: 9, inMonth: true, total: "1h", chips: [{ time: "4:00", title: "Study / learning", color: "rose" }] },
    { n: 10, inMonth: true, total: "30m", chips: [{ time: "10:00", title: "Walk outside", color: "emerald" }] },
  ],
];

const routines = [
  { emoji: "💊", title: "Take vitamins & pills", done: true },
  { emoji: "🥤", title: "Drink protein shake", done: false },
  { emoji: "🚿", title: "Morning shower", done: true },
  { emoji: "💧", title: "Drink 2L water", done: false },
  { emoji: "🧘", title: "10 min stretch / meditate", done: true },
];

const details = [
  { title: "Quarter-hour precision", text: "Blocks move and resize in 15-minute steps.", icon: Clock },
  { title: "Overlaps side by side", text: "Two things at once sit next to each other.", icon: Columns2 },
  { title: "Keyboard friendly", text: "Focus a block, nudge it with the arrow keys.", icon: ArrowUpDown },
  { title: "Light and dark", text: "Follows your system, or pick a side.", icon: Contrast },
];

const WEEKDAY_INITIALS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LENGTHS = ["15m", "30m", "45m", "1h", "1h 30m"];
const PHONE_ACTIVITIES = [
  { emoji: "🏋️", title: "Workout", length: "1h", color: "emerald" },
  { emoji: "🚶", title: "Walk outside", length: "30m", color: "emerald" },
  { emoji: "📚", title: "Study / learning", length: "1h", color: "rose" },
];

export function LandingFeatures() {
  return (
    <section id="features" className="scroll-mt-16 border-t border-border/60 bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div data-reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-4xl font-semibold tracking-[-0.04em] text-foreground sm:text-5xl lg:text-[3.5rem] lg:leading-[1.04]">
            Everything a day needs. <span className="block text-muted-foreground">Nothing it doesn't.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            A calendar, a timeline and the small daily things that keep you on track, together in one calm place.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:mt-16 lg:grid-cols-3">
          {/* Month view */}
          <article
            data-reveal
            className="lift-card flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xs lg:col-span-2"
          >
            <div className="px-6 pt-6 sm:px-7 sm:pt-7">
              <h3 className="text-lg font-semibold tracking-tight text-foreground">See the whole month</h3>
              <p className="mt-1.5 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
                Every date lists its blocks with start times. Spot the packed days and the open ones, then jump into
                any of them.
              </p>
            </div>
            <div aria-hidden="true" className="relative mt-6 flex-1 overflow-hidden pl-6 sm:pl-7">
              <div className="scene w-[50rem] origin-top-left overflow-hidden rounded-tl-xl border-l border-t border-border bg-card shadow-xs [mask-image:linear-gradient(to_bottom,black_70%,transparent)] max-sm:-translate-x-[19rem]">
                <div className="grid grid-cols-7 border-b border-border bg-muted/40">
                  {WEEKDAY_INITIALS.map((label) => (
                    <span
                      key={label}
                      className="py-2 text-center font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {label}
                    </span>
                  ))}
                </div>
                {weeks.map((week, w) => (
                  <div key={w} className="grid grid-cols-7">
                    {week.map((day) => (
                      <div
                        key={day.n}
                        className={[
                          "flex h-32 flex-col gap-1.5 border-b border-r border-border/60 p-2",
                          !day.inMonth ? "bg-muted/20 opacity-60" : "bg-card",
                        ].join(" ")}
                      >
                        <span className="flex items-center justify-between">
                          <span
                            className={[
                              "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                              day.inMonth && day.n === 1
                                ? "bg-primary font-bold text-primary-foreground shadow-xs"
                                : day.inMonth
                                  ? "text-foreground"
                                  : "text-muted-foreground/60",
                            ].join(" ")}
                          >
                            {day.n}
                          </span>
                          {day.total ? (
                            <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                              {day.total}
                            </span>
                          ) : null}
                        </span>
                        {day.chips.map((chip) => (
                          <span
                            key={chip.title + chip.time}
                            className={`flex items-center gap-1 truncate rounded-md border px-1.5 py-0.5 text-[11px] font-medium shadow-2xs ${paletteOf(chip.color).chip}`}
                          >
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${paletteOf(chip.color).dot}`} />
                            <span className="font-mono text-[10px] opacity-75">{chip.time}</span>
                            <span className="truncate">{chip.title}</span>
                          </span>
                        ))}
                        {day.more ? (
                          <span className="self-start rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                            +{day.more} more
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </article>

          {/* Activity library */}
          <article
            data-reveal
            className="lift-card flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xs [--reveal-delay:80ms] [--tint:#8b5cf6]"
          >
            <div className="px-6 pt-6 sm:px-7 sm:pt-7">
              <h3 className="text-lg font-semibold tracking-tight text-foreground">Activities you reuse</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
                Save what you do with an emoji, a color and a usual length. Make it once, drag it in any day.
              </p>
            </div>
            <div aria-hidden="true" className="stage m-2 mt-6 flex flex-1 items-center justify-center rounded-xl p-5">
              <div className="scene w-full max-w-[18rem] space-y-3.5 rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base ${paletteOf("violet").icon}`}>
                    🎹
                  </span>
                  <span className="flex h-9 flex-1 items-center rounded-md border border-foreground/40 bg-background px-2.5 text-sm text-foreground ring-2 ring-foreground/5">
                    Piano practice
                    <span className="feature-caret ml-px h-4 w-px bg-foreground" />
                  </span>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground">Color</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {COLOR_KEYS.map((key) => (
                      <span
                        key={key}
                        className={[
                          "h-5 w-5 rounded-full",
                          paletteOf(key).swatch,
                          key === "violet" ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : "",
                        ].join(" ")}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground">Usual length</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {LENGTHS.map((length) => (
                      <span
                        key={length}
                        className={[
                          "rounded-md border px-2 py-0.5 font-mono text-[11px]",
                          length === "45m"
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-muted-foreground",
                        ].join(" ")}
                      >
                        {length}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs">
                  <span className="text-muted-foreground">Category</span>
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <span className="h-2 w-2 rounded-full bg-rose-500" /> Growth
                  </span>
                </div>
              </div>
            </div>
          </article>

          {/* Routines */}
          <article
            data-reveal
            className="lift-card flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xs [--tint:#10b981]"
          >
            <div aria-hidden="true" className="stage m-2 flex h-52 items-center justify-center rounded-xl px-4">
              <div className="scene flex max-w-[17rem] flex-wrap justify-center gap-1.5">
                {routines.map((routine) => (
                  <span
                    key={routine.title}
                    className={[
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium shadow-2xs",
                      routine.done
                        ? "border-border/60 bg-muted/60 text-muted-foreground line-through"
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
                <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground">
                  <Plus className="h-3 w-3" />
                  Manage
                </span>
              </div>
            </div>
            <div className="px-5 pb-6 pt-4 sm:px-6">
              <h3 className="text-lg font-semibold tracking-tight text-foreground">Daily routines</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
                Vitamins, water, a stretch. Tick off the small habits that repeat every day, right above your timeline.
              </p>
            </div>
          </article>

          {/* Notes */}
          <article
            data-reveal
            className="lift-card flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xs [--reveal-delay:80ms] [--tint:#f59e0b]"
          >
            <div aria-hidden="true" className="stage m-2 flex h-52 items-center justify-center rounded-xl px-4">
              <div className="scene w-full max-w-[16rem] -rotate-1 rounded-xl border border-border bg-card p-4 text-[13px] leading-relaxed text-foreground shadow-sm">
                <p className="text-[15px] font-semibold tracking-tight">Thursday</p>
                <ul className="mt-2 space-y-1">
                  <li className="flex items-center gap-2 text-muted-foreground line-through">
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-[4px] bg-foreground text-background">
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                    Call the dentist
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded-[4px] border border-muted-foreground/50" />
                    Book train for Friday
                  </li>
                </ul>
                <p className="mt-2.5">
                  <strong className="font-semibold">Idea:</strong> batch all errands on Saturday.
                </p>
                <p className="mt-1 text-muted-foreground">
                  Dinner: <span className="text-foreground underline underline-offset-2">pasta al limone</span>
                </p>
              </div>
            </div>
            <div className="px-5 pb-6 pt-4 sm:px-6">
              <h3 className="text-lg font-semibold tracking-tight text-foreground">A note for every day</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
                Thoughts, links and quick to-dos in a markdown note that lives on its date.
              </p>
            </div>
          </article>

          {/* Phone */}
          <article
            data-reveal
            className="lift-card flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xs [--reveal-delay:160ms] [--tint:#0ea5e9]"
          >
            <div aria-hidden="true" className="stage m-2 flex h-52 justify-center overflow-hidden rounded-xl">
              <div className="scene mt-5 h-[19rem] w-44 shrink-0 origin-top rounded-[1.9rem] border-[5px] border-zinc-900 bg-background shadow-lg dark:border-zinc-950">
                <div className="relative h-full overflow-hidden rounded-[1.55rem]">
                  <div className="flex items-center justify-between px-4 pt-2 font-mono text-[8px] font-semibold text-foreground">
                    <span>9:41</span>
                    <span className="h-1.5 w-3 rounded-[2px] border border-foreground/70" />
                  </div>
                  <div className="border-b border-border px-3 pb-1.5 pt-1.5">
                    <p className="text-[10px] font-semibold text-foreground">Thu, Oct 1</p>
                    <p className="font-mono text-[7px] text-muted-foreground">4h planned · 1/4 done</p>
                  </div>
                  <div className="space-y-1 px-2 pt-2">
                    <div className="h-7 [&_p]:text-[9px] [&>div]:rounded-md">
                      <MockBlock compact done emoji="☀️" title="Morning routine" color="amber" />
                    </div>
                    <div className="h-12 [&_p]:text-[9px] [&>div]:rounded-md">
                      <MockBlock compact emoji="🛠️" title="Working on projects" color="indigo" />
                    </div>
                  </div>
                  {/* Bottom sheet */}
                  <div className="absolute inset-0 top-[5.4rem] bg-zinc-950/25" />
                  <div className="absolute inset-x-0 bottom-0 top-[6.6rem] rounded-t-2xl border-t border-border bg-card px-2.5 pt-1.5 shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.35)]">
                    <span className="mx-auto block h-1 w-8 rounded-full bg-muted-foreground/30" />
                    <p className="mt-1.5 text-[10px] font-semibold text-foreground">Activities</p>
                    <div className="mt-1.5 space-y-1">
                      {PHONE_ACTIVITIES.map((item) => (
                        <div
                          key={item.title}
                          className="flex items-center gap-1.5 rounded-md border border-border/70 px-1.5 py-1"
                        >
                          <span
                            className={`flex h-4 w-4 items-center justify-center rounded text-[8px] ${paletteOf(item.color).icon}`}
                          >
                            {item.emoji}
                          </span>
                          <span className="flex-1 truncate text-[9px] font-medium text-foreground">{item.title}</span>
                          <span className="font-mono text-[8px] text-muted-foreground">{item.length}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-5 pb-6 pt-4 sm:px-6">
              <h3 className="text-lg font-semibold tracking-tight text-foreground">At home on your phone</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
                Bottom sheets, big tap targets, press and hold to move a block. Planning on the go feels native.
              </p>
            </div>
          </article>
        </div>

        {/* Smaller details */}
        <ul
          data-reveal
          className="mt-5 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4"
        >
          {details.map((detail) => {
            const Icon = detail.icon;
            return (
              <li key={detail.title} className="bg-card p-5 sm:p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-canvas text-foreground shadow-2xs">
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-foreground">{detail.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{detail.text}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
