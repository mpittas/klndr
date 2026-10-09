import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowRight, ArrowUp, Check } from "lucide-react";

import { useAuth } from "@/auth";
import { PlannerMock } from "@/components/landing/PlannerMock";
import type { LandingStart } from "@/components/landing/types";

const perks = ["Desktop and phone", "Light and dark", "Sign in with Google"];

// Matches the routines strip in the planner mock: two of four ticked off.
const ROUTINES_DONE = 2;
const ROUTINES_TOTAL = 4;
const RING = 2 * Math.PI * 15;

export function LandingHero({ start, signedIn }: { start: LandingStart; signedIn: boolean }) {
  const { continueAsGuest } = useAuth();
  const navigate = useNavigate();

  // A guest needs no account, so the planner opens at once.
  const tryAsGuest = () => {
    continueAsGuest();
    void navigate({ to: "/calendar" });
  };

  return (
    // overflow-clip, not hidden: a hidden overflow is a scroll container and would pin the tilt's view timeline.
    <section className="relative isolate overflow-clip">
      {/* Faint timeline rules behind the hero */}
      <div aria-hidden="true" className="hero-rules pointer-events-none absolute inset-x-0 -top-16 bottom-0 -z-10" />

      <div className="mx-auto max-w-6xl px-5 pb-20 pt-12 sm:px-8 sm:pb-28 sm:pt-20 lg:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="hero-rise text-balance text-[2.75rem] font-semibold leading-[1.04] tracking-[-0.045em] text-foreground sm:text-6xl lg:text-[5rem]">
            Plan your day,{" "}
            <span className="whitespace-nowrap">
              <span className="word-block hero-drop border-indigo-200 bg-indigo-50 dark:border-indigo-400/30 dark:bg-indigo-500/15">
                <span
                  aria-hidden="true"
                  className="absolute inset-y-[0.2em] left-[0.14em] w-[0.06em] min-w-[3px] rounded-full bg-indigo-500"
                />
                block
              </span>
              {" by "}
              <span className="word-block hero-drop border-emerald-200 bg-emerald-50 [--d:180ms] dark:border-emerald-400/30 dark:bg-emerald-500/15">
                <span
                  aria-hidden="true"
                  className="absolute inset-y-[0.2em] left-[0.14em] w-[0.06em] min-w-[3px] rounded-full bg-emerald-500"
                />
                block
              </span>
            </span>
          </h1>

          <p className="hero-rise mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground [--d:120ms] sm:text-lg">
            klndr. is a visual day planner. Pick a date, drag activities like deep work, workouts and chores onto an
            hour-by-hour timeline, and tick them off as your day unfolds.
          </p>

          <div className="hero-rise mt-9 flex flex-col items-stretch justify-center gap-3 [--d:220ms] sm:flex-row sm:items-center">
            <Link
              to={start.to}
              className="btn-primary group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-[15px] font-medium text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98]"
            >
              {start.label}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
            {!signedIn ? (
              <>
                <button
                  type="button"
                  onClick={tryAsGuest}
                  className="inline-flex h-12 items-center justify-center rounded-xl border border-border bg-background/80 px-6 text-[15px] font-medium text-foreground shadow-2xs backdrop-blur transition hover:bg-accent active:scale-[0.98]"
                >
                  Try as a guest
                </button>
                <Link
                  to="/login"
                  className="inline-flex h-12 items-center justify-center rounded-xl border border-border bg-background/80 px-6 text-[15px] font-medium text-foreground shadow-2xs backdrop-blur transition hover:bg-accent active:scale-[0.98]"
                >
                  Log in
                </Link>
              </>
            ) : (
              <a
                href="#how-it-works"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-border bg-background/80 px-6 text-[15px] font-medium text-foreground shadow-2xs backdrop-blur transition hover:bg-accent active:scale-[0.98]"
              >
                See how it works
              </a>
            )}
          </div>

          <ul className="hero-rise mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] text-muted-foreground [--d:300ms]">
            {perks.map((perk) => (
              <li key={perk} className="flex items-center gap-1.5">
                <Check
                  className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                  strokeWidth={3}
                />
                {perk}
              </li>
            ))}
          </ul>
        </div>

        <div className="hero-rise relative mx-auto mt-14 max-w-5xl [--d:380ms] sm:mt-20">
          {/* A soft wash of the activity colors behind the product */}
          <div aria-hidden="true" className="pointer-events-none absolute -inset-x-16 -top-16 bottom-0 -z-10">
            <div className="absolute left-0 top-[8%] h-[55%] w-[42%] rounded-full bg-indigo-400/15 blur-3xl dark:bg-indigo-500/15" />
            <div className="absolute right-0 top-[4%] h-1/2 w-[40%] rounded-full bg-emerald-300/20 blur-3xl dark:bg-emerald-500/10" />
            <div className="absolute left-[30%] top-0 h-[38%] w-[40%] rounded-full bg-amber-200/30 blur-3xl dark:bg-amber-400/[0.07]" />
            <div className="absolute bottom-0 left-[8%] h-[45%] w-[40%] rounded-full bg-sky-300/15 blur-3xl dark:bg-sky-500/[0.07]" />
            <div className="absolute bottom-[4%] right-[6%] h-[45%] w-[38%] rounded-full bg-rose-300/15 blur-3xl dark:bg-rose-500/[0.07]" />
          </div>

          <div className="hero-tilt">
            <div className="rounded-[1.375rem] bg-white/55 p-1.5 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_40px_80px_-36px_rgb(15_23_42/0.4)] ring-1 ring-slate-900/[0.07] sm:p-2 dark:bg-white/[0.04] dark:shadow-[0_40px_80px_-36px_rgb(0_0_0/0.75)] dark:ring-white/10">
              <PlannerMock />
            </div>
          </div>

          {/* Floating details on wide screens */}
          <div
            aria-hidden="true"
            className="hero-float absolute -left-20 -bottom-8 z-10 hidden w-56 items-center gap-3 rounded-2xl border border-border/80 bg-card/90 p-3.5 shadow-[0_24px_48px_-20px_rgb(15_23_42/0.35)] backdrop-blur-md xl:flex dark:shadow-[0_24px_48px_-20px_rgb(0_0_0/0.7)]"
          >
            <svg viewBox="0 0 36 36" className="h-11 w-11 shrink-0 -rotate-90">
              <circle cx="18" cy="18" r="15" fill="none" className="stroke-muted" strokeWidth={4} />
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                className="stroke-emerald-500"
                strokeWidth={4}
                strokeLinecap="round"
                strokeDasharray={`${(RING * ROUTINES_DONE) / ROUTINES_TOTAL} ${RING}`}
              />
            </svg>
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight text-foreground">Daily routines</p>
              <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                {ROUTINES_DONE} of {ROUTINES_TOTAL} done today
              </p>
            </div>
          </div>

          <div
            aria-hidden="true"
            className="hero-float absolute -right-20 top-[46%] z-10 hidden w-60 rounded-2xl border border-border/80 bg-card/90 p-3.5 shadow-[0_24px_48px_-20px_rgb(15_23_42/0.35)] backdrop-blur-md [--float-delay:-3s] xl:block dark:shadow-[0_24px_48px_-20px_rgb(0_0_0/0.7)]"
          >
            <div className="flex items-center gap-1.5">
              <span className="keycap">
                <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span className="keycap">
                <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span className="ml-1.5 text-sm font-semibold tracking-tight text-foreground">Nudge 15 minutes</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Focus a block and move it with the arrow keys.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
