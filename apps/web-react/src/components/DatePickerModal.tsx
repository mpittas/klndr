import { addMonths, MONTH_LABELS, monthMatrix, monthTitle, WEEKDAY_LABELS } from "@klndr/core";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { Modal } from "@/components/Modal";

/** What the calendar is showing: the days of a month, the months of a year, or a page of years. */
type View = "days" | "months" | "years";

/** Years per page of the year grid (4 × 3). */
const YEARS_PER_PAGE = 12;

const pad = (n: number) => String(n).padStart(2, "0");
const firstOf = (year: number, monthIndex: number) => `${String(year).padStart(4, "0")}-${pad(monthIndex + 1)}-01`;

/**
 * The one date picker, used by the day view and the month view alike.
 *
 * It opens on the days of a month. The title ("April 2031 ▾") is a button that zooms out to the months of
 * that year, and the year there zooms out again to a page of years, so any date is a few taps away without
 * paging month by month. Picking a year or a month zooms back in. Choosing a day opens that day; "View
 * month" opens the month grid for the month being looked at, so a month can be reached without picking a
 * day in it.
 *
 * `selected` is the day on screen (the day view); the month view has none and passes `activeMonth` instead,
 * the month it is already showing.
 */
export function DatePickerModal({
  open,
  initial,
  selected = null,
  activeMonth = null,
  today,
  onClose,
}: {
  open: boolean;
  /** Any date in the month the calendar opens on. */
  initial: string;
  selected?: string | null;
  /** `YYYY-MM` of the month grid already on screen, if that is where this is opened from. */
  activeMonth?: string | null;
  today: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();

  // Where the calendar is looking; back to the screen's own month, in days, each time the picker opens.
  const [shown, setShown] = useState(initial);
  const [view, setView] = useState<View>("days");
  const [yearsFrom, setYearsFrom] = useState(() => Number(initial.slice(0, 4)) - 4);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setShown(initial);
      setView("days");
    }
  }

  const year = Number(shown.slice(0, 4));
  const monthIndex = Number(shown.slice(5, 7)) - 1;
  const shownMonth = shown.slice(0, 7);
  const todayYear = Number(today.slice(0, 4));
  const todayMonth = today.slice(0, 7);

  const openDay = (date: string) => {
    onClose();
    if (date !== selected) void navigate({ to: "/day/$date", params: { date } });
  };
  const openMonth = () => {
    onClose();
    void navigate({ to: "/calendar", search: { m: shownMonth } });
  };

  const zoomOut = () => {
    if (view === "days") setView("months");
    else if (view === "months") {
      setYearsFrom(year - 4);
      setView("years");
    }
  };
  const step = (direction: 1 | -1) => {
    if (view === "days") setShown(addMonths(shown, direction));
    else if (view === "months") setShown(firstOf(year + direction, monthIndex));
    else setYearsFrom(yearsFrom + direction * YEARS_PER_PAGE);
  };

  const title =
    view === "days" ? monthTitle(shown) : view === "months" ? String(year) : `${yearsFrom} – ${yearsFrom + YEARS_PER_PAGE - 1}`;
  const stepLabel = view === "days" ? "month" : view === "months" ? "year" : "years";
  const titleHint = view === "days" ? "Choose month or year" : view === "months" ? "Choose year" : "";

  const stepButton =
    "flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border bg-card text-foreground transition hover:bg-muted active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-8 sm:w-8";
  const footerButton =
    "inline-flex h-11 flex-1 cursor-pointer items-center justify-center rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-default disabled:opacity-50 sm:h-8 sm:text-xs";
  const cell = (state: "selected" | "today" | "normal" | "muted") =>
    [
      "flex cursor-pointer items-center justify-center rounded-lg tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      state === "selected"
        ? "bg-primary font-bold text-primary-foreground shadow-2xs"
        : state === "today"
          ? "border border-primary font-semibold text-foreground hover:bg-muted"
          : state === "normal"
            ? "font-medium text-foreground hover:bg-muted"
            : "text-muted-foreground/50 hover:bg-muted",
    ].join(" ");

  return (
    <Modal open={open} title="Go to date" subtitle="Pick a day, or open a whole month" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <button type="button" className={stepButton} onClick={() => step(-1)} aria-label={`Previous ${stepLabel}`}>
            <ChevronLeft className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden="true" />
          </button>

          {view === "years" ? (
            <span className="flex-1 text-center text-sm font-semibold tabular-nums text-foreground" aria-live="polite">
              {title}
            </span>
          ) : (
            <button
              type="button"
              onClick={zoomOut}
              title={titleHint}
              aria-label={`${title}. ${titleHint}`}
              className="group inline-flex h-11 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-foreground transition hover:bg-muted active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-8"
            >
              <span aria-live="polite" className="truncate tabular-nums">
                {title}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-foreground" aria-hidden="true" />
            </button>
          )}

          <button type="button" className={stepButton} onClick={() => step(1)} aria-label={`Next ${stepLabel}`}>
            <ChevronRight className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Keyed by view, so each zoom level fades in rather than snapping. The height is that of the days, so the
            dialog doesn't jump when zooming out to the months or years. */}
        <div key={view} className="animate-in fade-in-0 flex min-h-[19.75rem] flex-col duration-150 sm:min-h-[17rem]">
          {view === "days" && (
            <div>
              <div className="grid grid-cols-7">
                {WEEKDAY_LABELS.map((label) => (
                  <div
                    key={label}
                    className="py-1.5 text-center font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {label}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {monthMatrix(shown).map((date) => {
                  const inMonth = date.slice(0, 7) === shownMonth;
                  const isSelected = date === selected;
                  return (
                    <button
                      key={date}
                      type="button"
                      onClick={() => openDay(date)}
                      aria-label={date}
                      aria-current={isSelected ? "date" : undefined}
                      className={`${cell(isSelected ? "selected" : date === today ? "today" : inMonth ? "normal" : "muted")} h-11 text-sm sm:h-9 sm:text-xs`}
                    >
                      {Number(date.slice(8))}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {view === "months" && (
            <div className="grid flex-1 grid-cols-3 content-center gap-2 sm:grid-cols-4">
              {MONTH_LABELS.map((name, index) => {
                const month = firstOf(year, index).slice(0, 7);
                const isShown = index === monthIndex;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      setShown(firstOf(year, index));
                      setView("days");
                    }}
                    aria-label={`${name} ${year}`}
                    aria-pressed={isShown}
                    className={`${cell(isShown ? "selected" : month === todayMonth ? "today" : "normal")} h-12 text-sm sm:h-11`}
                  >
                    {name.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          )}

          {view === "years" && (
            <div className="grid flex-1 grid-cols-3 content-center gap-2 sm:grid-cols-4">
              {Array.from({ length: YEARS_PER_PAGE }, (_, i) => yearsFrom + i).map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => {
                    setShown(firstOf(y, monthIndex));
                    setView("months");
                  }}
                  aria-label={String(y)}
                  aria-pressed={y === year}
                  className={`${cell(y === year ? "selected" : y === todayYear ? "today" : "normal")} h-12 text-sm sm:h-11`}
                >
                  {y}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-border pt-3">
          <button type="button" onClick={() => openDay(today)} disabled={selected === today} className={footerButton}>
            Today
          </button>
          <button type="button" onClick={openMonth} disabled={activeMonth === shownMonth} className={footerButton}>
            View {monthTitle(shown)}
          </button>
        </div>
      </div>
    </Modal>
  );
}
