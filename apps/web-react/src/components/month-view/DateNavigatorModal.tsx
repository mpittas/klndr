import { MONTH_LABELS, setYearMonth } from "@klndr/core";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Modal } from "@/components/Modal";

export function DateNavigatorModal({
  open,
  month,
  activeYear,
  activeMonthIndex,
  today,
  onClose,
  onSelectMonth,
  onOpenDay,
}: {
  open: boolean;
  month: string;
  activeYear: number;
  activeMonthIndex: number;
  today: string;
  onClose: () => void;
  onSelectMonth: (monthIso: string) => void;
  onOpenDay: (dateIso: string) => void;
}) {
  const stepMonth = (offset: number) => setYearMonth(month, activeYear + offset, activeMonthIndex).slice(0, 7);

  return (
    <Modal open={open} title="Date Navigator" subtitle="Jump directly to any month, year, or specific day" onClose={onClose}>
      <div className="space-y-5">
        {/* Year Navigator Stepper */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Year</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectMonth(stepMonth(-1))}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-md border border-border bg-card text-foreground transition hover:bg-muted sm:h-8 sm:w-8"
              title="Previous year"
              aria-label="Previous year"
            >
              <ChevronLeft className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden="true" />
            </button>
            <span
              className="min-w-[4rem] text-center font-mono text-base font-bold tabular-nums text-foreground"
              aria-live="polite"
            >
              {activeYear}
            </span>
            <button
              type="button"
              onClick={() => onSelectMonth(stepMonth(1))}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-md border border-border bg-card text-foreground transition hover:bg-muted sm:h-8 sm:w-8"
              title="Next year"
              aria-label="Next year"
            >
              <ChevronRight className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Month Grid (12 Months) */}
        <div>
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Month</span>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {MONTH_LABELS.map((name, index) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  onSelectMonth(setYearMonth(month, activeYear, index).slice(0, 7));
                  onClose();
                }}
                className={[
                  "flex h-12 cursor-pointer items-center justify-center rounded-lg border text-sm font-semibold transition sm:h-10 sm:text-xs",
                  activeMonthIndex === index
                    ? "border-primary bg-primary font-bold text-primary-foreground shadow-2xs"
                    : "border-border bg-card text-foreground hover:bg-muted",
                ].join(" ")}
              >
                {name.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>

        {/* Specific Day Picker */}
        <div className="border-t border-border pt-3">
          <label htmlFor="jump-to-day" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Jump to Specific Day
          </label>
          <input
            id="jump-to-day"
            type="date"
            value={month.length === 10 ? month : `${month.slice(0, 7)}-01`}
            onChange={(event) => {
              const value = event.target.value;
              if (value) {
                onOpenDay(value);
                onClose();
              }
            }}
            className="flex h-12 w-full cursor-pointer rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring sm:h-9 sm:text-xs"
          />
        </div>

        {/* Quick Actions */}
        <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
          <button
            type="button"
            onClick={() => {
              onSelectMonth(today.slice(0, 7));
              onClose();
            }}
            className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition hover:bg-muted sm:h-8 sm:flex-none sm:text-xs"
          >
            Current Month
          </button>
          <button
            type="button"
            onClick={() => {
              onOpenDay(today);
              onClose();
            }}
            className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90 sm:h-8 sm:flex-none sm:text-xs"
          >
            Open Today
          </button>
        </div>
      </div>
    </Modal>
  );
}
