import { useCategoryColor } from "@klndr/data";
import { X } from "lucide-react";

import { hoursLabel, type CategoryShare } from "@/components/month-view/stats";
import { paletteOf } from "@/lib/colors";

/**
 * Where the month's time goes, by category: a stacked bar and one line per category with its hours. The
 * lines are filters: pick one or more and the grid and the agenda show only those categories.
 */
export function CategoryCard({
  shares,
  selected,
  onToggle,
  onClear,
}: {
  shares: CategoryShare[];
  /** The categories being shown; empty means all of them. */
  selected: string[];
  onToggle: (category: string) => void;
  onClear: () => void;
}) {
  const colorOf = useCategoryColor();
  const total = shares.reduce((sum, share) => sum + share.minutes, 0);
  const isOn = (category: string) => selected.length === 0 || selected.includes(category);

  return (
    <section className="rounded-xl border border-border bg-card p-3 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
          Categories{" "}
          <span className="ml-1 font-medium normal-case tracking-normal text-muted-foreground">
            {selected.length ? `${selected.length} of ${shares.length} shown` : "tap to filter"}
          </span>
        </h2>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-full px-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
          >
            <X className="h-3 w-3" aria-hidden="true" />
            Clear
          </button>
        )}
      </div>

      {shares.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">Nothing planned this month yet.</p>
      ) : (
        <>
          <div className="mt-2 flex h-1.5 gap-px overflow-hidden rounded-full" aria-hidden="true">
            {shares.map((share) => (
              <span
                key={share.category}
                className={["h-full transition-opacity", paletteOf(colorOf(share.sample)).accent, isOn(share.category) ? "" : "opacity-25"].join(" ")}
                style={{ width: `${(share.minutes / total) * 100}%` }}
              />
            ))}
          </div>

          <ul className="mt-1.5">
            {shares.map((share) => {
              const tone = paletteOf(colorOf(share.sample));
              const on = selected.includes(share.category);
              return (
                <li key={share.category}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => onToggle(share.category)}
                    title={`${share.done} of ${share.count} done`}
                    className={[
                      "flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      on ? "bg-muted" : "hover:bg-muted/60",
                      isOn(share.category) ? "" : "opacity-50",
                    ].join(" ")}
                  >
                    <span className={["h-2 w-2 shrink-0 rounded-full", tone.dot].join(" ")} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{share.category}</span>
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                      {share.done}/{share.count}
                    </span>
                    <span className="w-9 shrink-0 text-right font-mono text-xs font-semibold tabular-nums text-foreground">
                      {hoursLabel(share.minutes)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
