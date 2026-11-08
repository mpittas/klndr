import { categoryBreakdown, hoursLabel, sortCategoriesByName, type ScheduledTask } from "@klndr/core";
import { useCategories, useCategoryColor } from "@klndr/data";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { paletteOf } from "@/lib/colors";

/**
 * The toolbar's Categories control, the same on every view: which categories the calendar shows, like the
 * "My calendars" check boxes of the calendars on Mobbin (Proton, Front, Motion) folded into one button. The
 * button shows the colours that are on; its list has a check box per category with the time it takes in the
 * period on screen, "Only" to show just that one, and "Show all". What is hidden is remembered across views
 * (`useHiddenCategories`).
 */
export function CategoryFilter({
  tasks,
  period,
  hidden,
  onToggle,
  onOnly,
  onShowAll,
}: {
  /** The period on screen's blocks, before the filter, for the hours beside each category. */
  tasks: ScheduledTask[];
  period: "month" | "week" | "day";
  hidden: string[];
  onToggle: (category: string) => void;
  onOnly: (category: string, all: string[]) => void;
  onShowAll: () => void;
}) {
  const colorOf = useCategoryColor();
  const saved = useCategories().data;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();

  // Every category of the library, plus any a block still uses, each with its time this period.
  const rows = useMemo(() => {
    const minutes = new Map(categoryBreakdown(tasks).map((share) => [share.category, share.minutes]));
    const names = sortCategoriesByName(saved ?? []).map((category) => category.name);
    for (const name of minutes.keys()) if (!names.includes(name)) names.push(name);
    return names.map((name) => ({ name, minutes: minutes.get(name) ?? 0, tone: paletteOf(colorOf({ category: name })) }));
  }, [tasks, saved, colorOf]);

  const all = rows.map((row) => row.name);
  const shown = rows.filter((row) => !hidden.includes(row.name));
  const filtered = shown.length < rows.length;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      rootRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (rows.length === 0) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={listId}
        title="Choose which categories to show"
        className={[
          "btn btn-sm h-9 gap-2 rounded-xl border px-2.5 shadow-xs",
          filtered ? "border-foreground/25 bg-foreground/[0.06] text-foreground" : "border-border bg-card text-foreground hover:bg-accent/50",
        ].join(" ")}
      >
        <span className="flex -space-x-1" aria-hidden="true">
          {(shown.length ? shown : rows).slice(0, 4).map((row) => (
            <span
              key={row.name}
              className={["h-2.5 w-2.5 rounded-full ring-2 ring-card", shown.length ? row.tone.dot : "bg-muted-foreground/30"].join(" ")}
            />
          ))}
        </span>
        <span className="tabular-nums">{filtered ? `${shown.length} of ${rows.length}` : "Categories"}</span>
        <ChevronDown
          className={["size-3.5 text-muted-foreground transition-transform", open ? "rotate-180" : ""].join(" ")}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          id={listId}
          role="group"
          aria-label="Categories shown"
          className="menu absolute right-0 top-full z-40 mt-2 w-72 origin-top-right animate-in fade-in-0 zoom-in-95 duration-100"
        >
          <div className="flex items-center justify-between px-2.5 pb-1.5 pt-2">
            <span className="text-xs font-medium text-muted-foreground">Shown on the calendar</span>
            <span className="text-xs text-muted-foreground">This {period}</span>
          </div>
          <ul className="max-h-[min(22rem,60dvh)] overflow-y-auto">
            {rows.map((row) => {
              const on = !hidden.includes(row.name);
              return (
                <li key={row.name} className="group/row relative">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => onToggle(row.name)}
                    className="flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-left transition-colors hover:bg-foreground/[0.05]"
                  >
                    <span
                      aria-hidden="true"
                      className={[
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-colors",
                        on ? `${row.tone.swatch} border-transparent` : "border-foreground/25",
                      ].join(" ")}
                    >
                      {on ? <Check className="h-3 w-3" strokeWidth={3.5} /> : null}
                    </span>
                    <span
                      className={["min-w-0 flex-1 truncate text-[13px] font-medium", on ? "text-foreground" : "text-muted-foreground"].join(" ")}
                    >
                      {row.name}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground group-hover/row:invisible group-focus-within/row:invisible">
                      {row.minutes ? hoursLabel(row.minutes) : "–"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOnly(row.name, all)}
                    aria-label={`Show only ${row.name}`}
                    className="btn btn-ghost btn-xs invisible absolute right-1.5 top-1/2 h-6 -translate-y-1/2 px-2 group-hover/row:visible group-focus-within/row:visible touch:hidden"
                  >
                    Only
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-1 border-t border-border pt-1">
            <button
              type="button"
              onClick={onShowAll}
              disabled={!filtered}
              className="menu-item w-full justify-center text-[13px] font-medium disabled:cursor-default disabled:opacity-50"
            >
              Show all categories
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
