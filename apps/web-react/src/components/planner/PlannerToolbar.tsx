import { addDaysISO, addMonths, formatDuration, MONTH_LABELS, parseISODate } from "@dayro/core";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import type { ReactNode } from "react";

export type PlannerView = "month" | "week" | "day";

const NOUN: Record<PlannerView, string> = { month: "month", week: "week", day: "day" };
const CURRENT: Record<PlannerView, string> = { month: "This month", week: "This week", day: "Today" };

const short = (date: Date) => `${MONTH_LABELS[date.getMonth()].slice(0, 3)} ${date.getDate()}`;

/**
 * A period's title in two parts, the name in ink and the year beside it in grey, written the same way on
 * every view: "November · 2026", "Nov 2 – 8 · 2026", "Sunday, November 8 · 2026" ("Sun, Nov 8" until the
 * toolbar is 56rem wide, so the date is never cut off beside the controls).
 */
function titleOf(view: PlannerView, anchor: string, end: string) {
  const date = parseISODate(anchor);
  const year = String(date.getFullYear());

  if (view === "month") return { long: MONTH_LABELS[date.getMonth()], short: MONTH_LABELS[date.getMonth()], year };

  if (view === "day") {
    return {
      long: date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
      short: date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      year,
    };
  }

  const last = parseISODate(end);
  const sameMonth = date.getMonth() === last.getMonth();
  const range = `${short(date)} – ${sameMonth ? last.getDate() : short(last)}`;
  const years = date.getFullYear() === last.getFullYear() ? year : `${year} – ${String(last.getFullYear()).slice(2)}`;
  return { long: range, short: range, year: years };
}

/** The first day of the period `offset` periods away, as the route for that view expects it. */
/** The ISO 8601 week number of a day (weeks from Monday, week 1 holds the year's first Thursday). */
function isoWeek(iso: string): number {
  const date = parseISODate(iso);
  const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));
  const yearStart = Date.UTC(day.getUTCFullYear(), 0, 1);
  return Math.ceil(((day.getTime() - yearStart) / 86_400_000 + 1) / 7);
}

function periodAt(view: PlannerView, anchor: string, offset: number) {
  if (view === "month") return addMonths(anchor, offset).slice(0, 7);
  return addDaysISO(anchor, offset * (view === "week" ? 7 : 1));
}

/** A link to a period of the given view: `/calendar?m=YYYY-MM`, `/week/<day>` or `/day/<day>`. */
function PeriodLink({
  view,
  value,
  ...props
}: {
  view: PlannerView;
  value: string;
  className?: string;
  title?: string;
  "aria-label"?: string;
  "aria-disabled"?: boolean;
  tabIndex?: number;
  children: ReactNode;
}) {
  if (view === "month") return <Link to="/calendar" search={{ m: value }} {...props} />;
  if (view === "week") return <Link to="/week/$date" params={{ date: value }} {...props} />;
  return <Link to="/day/$date" params={{ date: value }} {...props} />;
}

/**
 * The one toolbar of the planner, the same on the month, the week and the day (modelled on the calendars on
 * Mobbin: Notion Calendar, Motion, Proton):
 *
 *   [sidebar]  Title ▾  (This week)           [●●● Categories]  [‹ Today ›]  [+ New block]
 *              5h planned · 2/6 done
 *
 * The title opens the date picker, but only where the sidebar's mini calendar isn't on screen (phones, tablets,
 * or the sidebar folded away); beside the mini calendar it is plain text, as in those calendars. The period
 * controls sit at the right edge, so paging never moves them however long the title is, and "Today" is always
 * there (quiet when the current period is on screen) rather than appearing and pushing things around. The
 * sidebar button only exists from `lg`, where there is a sidebar.
 */
export function PlannerToolbar({
  view,
  anchor,
  end = anchor,
  today,
  isCurrent,
  stats,
  filter,
  pickerOpen,
  onOpenPicker,
  onCreate,
  sidebar,
}: {
  view: PlannerView;
  /** The first day of the period on screen (any day of the month, for the month). */
  anchor: string;
  /** The period's last day, for the week's range. */
  end?: string;
  today: string;
  /** Whether today is in the period on screen. */
  isCurrent: boolean;
  stats: { minutes: number; done: number; count: number };
  /** The Categories control (`CategoryFilter`), from `sm`. */
  filter?: ReactNode;
  pickerOpen: boolean;
  onOpenPicker: () => void;
  onCreate: () => void;
  /** The sidebar's switch, for views that have a sidebar. */
  sidebar?: { open: boolean; onToggle: () => void };
}) {
  const title = titleOf(view, anchor, end);
  const noun = NOUN[view];
  const allDone = stats.count > 0 && stats.done === stats.count;
  const step = "btn btn-ghost btn-icon h-full w-10 rounded-[9px] sm:w-8";
  // While the sidebar is showing (from `lg`, when open), its mini calendar is the way to another date, so the
  // title is plain text there: one date picker on screen, never two.
  const calendarInSidebar = sidebar?.open === true;

  const titleText = (
    <span className="truncate text-[17px] font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-xl sm:tracking-[-0.025em]">
      <span className="@4xl:hidden">{title.short}</span>
      <span className="hidden @4xl:inline">{title.long}</span>
      {/* Phones leave the year out rather than cut it short. */}
      <span className="ml-1.5 hidden font-normal text-muted-foreground/80 @md:inline">{title.year}</span>
    </span>
  );

  return (
    <header className="@container flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background pl-[max(1rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] short:h-12 sm:h-16 sm:gap-3 sm:px-5">
      {sidebar ? (
        <button
          type="button"
          onClick={sidebar.onToggle}
          aria-expanded={sidebar.open}
          aria-controls="planner-sidebar"
          aria-label={sidebar.open ? "Hide sidebar" : "Show sidebar"}
          title={sidebar.open ? "Hide sidebar (\\)" : "Show sidebar (\\)"}
          className="btn btn-ghost btn-icon -ml-1.5 hidden h-9 shrink-0 text-muted-foreground hover:text-foreground lg:inline-flex"
        >
          {sidebar.open ? <PanelLeftClose aria-hidden="true" /> : <PanelLeftOpen aria-hidden="true" />}
        </button>
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          {/* The negative margin is the heading's, not the button's: on the button it would come off the width the
              title is measured at, and cut the year short. */}
          <h1 className="-mx-1.5 min-w-0">
            <button
              type="button"
              onClick={onOpenPicker}
              aria-haspopup="dialog"
              aria-expanded={pickerOpen}
              title={`Go to another ${noun}`}
              className={[
                "group flex max-w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-0.5 text-left transition-colors hover:bg-foreground/[0.05]",
                calendarInSidebar ? "lg:hidden" : "",
              ].join(" ")}
            >
              {titleText}
              <ChevronDown
                className={[
                  "h-4 w-4 shrink-0 text-muted-foreground transition-[color,rotate] duration-200 group-hover:text-foreground",
                  pickerOpen ? "rotate-180" : "",
                ].join(" ")}
                aria-hidden="true"
              />
            </button>
            {calendarInSidebar ? <span className="hidden max-w-full px-1.5 py-0.5 lg:flex">{titleText}</span> : null}
          </h1>
          {isCurrent ? (
            <span className="hidden shrink-0 rounded-full bg-brand/12 px-2 py-0.5 text-[11px] font-semibold leading-4 text-brand @lg:inline">
              {CURRENT[view]}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-xs leading-tight tabular-nums text-muted-foreground">
          {view === "week" ? (
            <span className="@max-md:hidden">
              Week {isoWeek(addDaysISO(anchor, 3))}
              <span className="px-1.5 text-muted-foreground/50" aria-hidden="true">
                ·
              </span>
            </span>
          ) : null}
          {formatDuration(stats.minutes)}
          <span className="@max-md:hidden"> planned</span>
          <span className="px-1.5 text-muted-foreground/50" aria-hidden="true">
            ·
          </span>
          <span className={allDone ? "font-medium text-success" : undefined}>
            {stats.done}/{stats.count} done
          </span>
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {filter ? <div className="hidden sm:block">{filter}</div> : null}
        <nav
          aria-label={`Change ${noun}`}
          className="inline-flex h-10 items-center gap-0.5 rounded-xl border border-border bg-card p-[3px] shadow-xs sm:h-9"
        >
          <PeriodLink
            view={view}
            value={periodAt(view, anchor, -1)}
            className={step}
            aria-label={`Previous ${noun}`}
            title={`Previous ${noun} (←)`}
          >
            <ChevronLeft aria-hidden="true" />
          </PeriodLink>
          <PeriodLink
            view={view}
            value={view === "month" ? today.slice(0, 7) : today}
            aria-disabled={isCurrent || undefined}
            tabIndex={isCurrent ? -1 : undefined}
            title={isCurrent ? undefined : `Back to ${CURRENT[view].toLowerCase()} (T)`}
            className={[
              "btn h-full rounded-[9px] px-2.5 text-[13px] sm:px-3",
              isCurrent ? "pointer-events-none text-muted-foreground/70" : "btn-ghost text-foreground",
            ].join(" ")}
          >
            Today
          </PeriodLink>
          <PeriodLink
            view={view}
            value={periodAt(view, anchor, 1)}
            className={step}
            aria-label={`Next ${noun}`}
            title={`Next ${noun} (→)`}
          >
            <ChevronRight aria-hidden="true" />
          </PeriodLink>
        </nav>

        <button
          type="button"
          onClick={onCreate}
          title="New block (N)"
          className="btn btn-primary btn-md h-10 w-10 px-0 sm:h-9 sm:w-auto sm:px-3.5"
        >
          <Plus aria-hidden="true" />
          <span className="max-sm:sr-only">New block</span>
        </button>
      </div>
    </header>
  );
}
