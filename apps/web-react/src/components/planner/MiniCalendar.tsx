import { addMonths, longDate, MONTH_LABELS, monthMatrix, parseISODate, weekdayLabels } from "@dayro/core";
import { useRangeTasks } from "@dayro/data";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import type { PlannerView } from "@/components/planner/PlannerToolbar";

/**
 * The sidebar's month at a glance, as in every calendar on Mobbin (Motion, Proton, Front, Rise): it shows where
 * the view is (the day as an ink disc, the week as a band across its row) and which days already have blocks (a
 * dot), and a click on a date moves the view you are in there. Its own arrows page it without moving the view
 * (the month slides in from the side it came from); its title brings it back to the view's month, and it comes
 * back by itself whenever the view moves to another month.
 *
 * Everything under the pointer answers softly: a date gets a tinted disc that grows a touch, a whole row lights up
 * on the week (where a click picks the week), and a press sinks back in.
 */
export function MiniCalendar({
  view,
  anchor,
  end = anchor,
  today,
  weekStartsOnMonday,
  onPick,
}: {
  view: PlannerView;
  /** The view's day, the week's first day, or any day of the month on screen. */
  anchor: string;
  /** The week's last day. */
  end?: string;
  today: string;
  weekStartsOnMonday: boolean;
  onPick: (date: string) => void;
}) {
  const anchorMonth = anchor.slice(0, 7);
  const [shown, setShown] = useState(`${anchorMonth}-01`);
  /** The way the last page turned, so the next month slides in from that side. */
  const [direction, setDirection] = useState<1 | -1>(1);
  const [following, setFollowing] = useState(anchorMonth);
  if (following !== anchorMonth) {
    setDirection(anchorMonth > following ? 1 : -1);
    setFollowing(anchorMonth);
    setShown(`${anchorMonth}-01`);
  }

  const page = (offset: 1 | -1) => {
    setDirection(offset);
    setShown(addMonths(shown, offset));
  };

  const cells = useMemo(() => monthMatrix(shown, weekStartsOnMonday), [shown, weekStartsOnMonday]);
  const rows = useMemo(
    () => Array.from({ length: cells.length / 7 }, (_, row) => cells.slice(row * 7, row * 7 + 7)),
    [cells],
  );

  // A dot under every day that has a block (the month grid asks for the same range, so it's usually cached).
  const { data } = useRangeTasks(cells[0], cells[cells.length - 1]);
  const busy = useMemo(() => new Set((data ?? []).map((task) => task.day)), [data]);

  const date = parseISODate(shown);
  const shownMonth = shown.slice(0, 7);
  const away = shownMonth !== anchorMonth;
  const isSelected = (iso: string) => view === "day" && iso === anchor;
  const isInWeek = (row: string[]) => view === "week" && row[0] <= end && row[6] >= anchor;

  const arrow =
    "btn btn-ghost btn-icon h-7 rounded-md text-muted-foreground transition-[background-color,color,scale] duration-200 hover:text-foreground active:scale-90";

  return (
    <section aria-label="Calendar" className="shrink-0 px-3 pb-3">
      <div className="flex h-16 items-center justify-between short:h-12">
        <h2 className="min-w-0">
          <button
            type="button"
            onClick={() => {
              if (!away) return;
              setDirection(shownMonth < anchorMonth ? 1 : -1);
              setShown(`${anchorMonth}-01`);
            }}
            title={away ? "Back to the month on screen" : undefined}
            className={[
              "flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] font-semibold tracking-[-0.005em] text-foreground transition-colors duration-200",
              away ? "cursor-pointer hover:bg-foreground/[0.06]" : "cursor-default",
            ].join(" ")}
          >
            {MONTH_LABELS[date.getMonth()]}
            <span className="font-normal text-muted-foreground">{date.getFullYear()}</span>
            {/* A brand dot while the calendar is away from the view's month: the title leads back. */}
            <span
              aria-hidden="true"
              className={[
                "h-1.5 w-1.5 rounded-full bg-brand transition-[opacity,scale] duration-200",
                away ? "scale-100 opacity-100" : "scale-0 opacity-0",
              ].join(" ")}
            />
          </button>
        </h2>
        <div className="flex items-center">
          <button type="button" onClick={() => page(-1)} aria-label="Show the previous month" className={arrow}>
            <ChevronLeft aria-hidden="true" />
          </button>
          <button type="button" onClick={() => page(1)} aria-label="Show the next month" className={arrow}>
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 pb-1" aria-hidden="true">
        {weekdayLabels(weekStartsOnMonday).map((label) => (
          <span key={label} className="text-center text-[11px] font-medium text-muted-foreground/80">
            {label.slice(0, 2)}
          </span>
        ))}
      </div>

      {/* Keyed by month, so a new page slides in from the side it was turned to. */}
      <div
        key={shownMonth}
        className={[
          "space-y-0.5 animate-in fade-in-0 duration-200 ease-out motion-reduce:animate-none",
          direction > 0 ? "slide-in-from-right-3" : "slide-in-from-left-3",
        ].join(" ")}
      >
        {rows.map((row) => {
          const inWeek = isInWeek(row);
          return (
            <div
              key={row[0]}
              className={[
                "grid grid-cols-7 rounded-lg transition-colors duration-200 ease-out",
                inWeek
                  ? "bg-foreground/[0.08]"
                  : view === "week"
                    ? "hover:bg-foreground/[0.045]"
                    : "",
              ].join(" ")}
            >
              {row.map((iso) => {
                const inMonth = iso.slice(0, 7) === shownMonth;
                const selected = isSelected(iso);
                const isToday = iso === today;
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => onPick(iso)}
                    aria-label={`${longDate(iso)}${busy.has(iso) ? ", has blocks" : ""}`}
                    aria-current={isToday ? "date" : undefined}
                    aria-pressed={selected || undefined}
                    className="group flex h-8 cursor-pointer items-center justify-center focus-visible:outline-none"
                  >
                    <span
                      className={[
                        "relative flex h-7 w-7 items-center justify-center rounded-full text-xs tabular-nums",
                        "transition-[background-color,color,box-shadow,scale] duration-200 ease-out",
                        "group-hover:scale-[1.08] group-active:scale-95 group-focus-visible:ring-2 group-focus-visible:ring-ring motion-reduce:transition-none motion-reduce:group-hover:scale-100",
                        selected
                          ? isToday
                            ? "bg-brand font-semibold text-brand-foreground shadow-[0_1px_3px_rgb(var(--brand-shade)/0.3)]"
                            : "bg-foreground font-semibold text-background shadow-[0_1px_3px_rgb(var(--shade)/0.25)]"
                          : isToday
                            ? "font-semibold text-brand group-hover:bg-brand/12"
                            : inMonth
                              ? "font-medium text-foreground group-hover:bg-foreground/[0.08]"
                              : "text-muted-foreground/50 group-hover:bg-foreground/[0.06] group-hover:text-muted-foreground",
                      ].join(" ")}
                    >
                      {parseISODate(iso).getDate()}
                      {busy.has(iso) ? (
                        <span
                          aria-hidden="true"
                          className={[
                            "absolute bottom-[3px] left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full transition-colors duration-200",
                            selected ? "bg-current opacity-70" : isToday ? "bg-brand" : "bg-muted-foreground/60",
                          ].join(" ")}
                        />
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}
