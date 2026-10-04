import type { CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { MockBlock } from "@/components/landing/MockBlock";
import type { LandingStart } from "@/components/landing/types";

// A loose stack of tomorrow's blocks beside the closing pitch.
const stack = [
  {
    emoji: "☀️",
    title: "Morning routine",
    color: "amber",
    meta: "7:00 – 7:45 AM",
    style: { top: "0", left: "8%", rotate: "-4deg" },
  },
  {
    emoji: "🛠️",
    title: "Working on projects",
    color: "indigo",
    meta: "9:00 – 11:00 AM",
    style: { top: "26%", left: "22%", rotate: "2deg" },
  },
  {
    emoji: "🏋️",
    title: "Workout",
    color: "emerald",
    meta: "6:00 – 7:00 PM",
    style: { top: "52%", left: "4%", rotate: "-1.5deg" },
  },
  {
    emoji: "🌙",
    title: "Evening wind-down",
    color: "violet",
    meta: "10:00 – 10:30 PM",
    style: { top: "76%", left: "18%", rotate: "3deg" },
  },
];

export function LandingCta({ start, signedIn }: { start: LandingStart; signedIn: boolean }) {
  return (
    <section className="bg-background px-4 pb-6 pt-4 sm:px-8 sm:pb-8">
      <div
        data-reveal
        className="relative isolate mx-auto grid max-w-6xl items-center gap-12 overflow-hidden rounded-3xl bg-zinc-900 px-6 py-16 text-white sm:px-12 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:px-16 dark:bg-[#1e1f22] dark:ring-1 dark:ring-border"
      >
        {/* Timeline rules and a glow in the activity colors behind the blocks */}
        <div aria-hidden="true" className="cta-rules pointer-events-none absolute inset-0 -z-10" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -right-24 -top-32 h-96 w-96 rounded-full bg-indigo-500/35 blur-3xl" />
          <div className="absolute -bottom-40 right-1/4 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="absolute -left-32 -top-40 h-80 w-80 rounded-full bg-amber-400/10 blur-3xl" />
        </div>

        <div className="relative">
          <h2 className="text-balance text-4xl font-semibold leading-[1.04] tracking-[-0.045em] sm:text-5xl lg:text-6xl">
            Tomorrow is a blank timeline.
          </h2>
          <p className="mt-5 max-w-md text-pretty text-base leading-relaxed text-white/65 sm:text-lg">
            Give it a shape tonight. Pick the date, drag in what matters, and start the day already knowing the plan.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              to={start.to}
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-[15px] font-medium text-zinc-900 shadow-[0_8px_24px_-8px_rgb(255_255_255/0.35)] transition hover:bg-white/90 active:scale-[0.98]"
            >
              {start.label}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
            {!signedIn ? (
              <Link
                to="/login"
                className="inline-flex h-12 items-center justify-center rounded-xl px-6 text-[15px] font-medium text-white/85 ring-1 ring-white/20 transition hover:bg-white/10 hover:text-white active:scale-[0.98]"
              >
                I have an account
              </Link>
            ) : null}
          </div>
        </div>

        <div aria-hidden="true" className="relative hidden h-72 lg:block">
          {stack.map((block, index) => (
            <div
              key={block.title}
              className="cta-card absolute h-16 w-72"
              style={{ ...block.style, "--i": index } as CSSProperties}
            >
              <div className="h-full rounded-md bg-white shadow-[0_16px_40px_-12px_rgb(0_0_0/0.65)] dark:bg-card">
                <MockBlock emoji={block.emoji} title={block.title} color={block.color} meta={block.meta} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
