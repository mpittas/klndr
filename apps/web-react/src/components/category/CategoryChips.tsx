import { withImplicitCategories, type ActivityTemplate } from "@klndr/core";
import { useCategories } from "@klndr/data";
import { Check, Folder, Sparkles } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { CATEGORY_CHIP } from "@/components/category/chip";
import { CategorySelect } from "@/components/category/CategorySelect";
import { paletteOf } from "@/lib/colors";

/** The most categories that get a chip of their own; fewer when the row is narrower. The rest are under "more". */
const MAX_CHIPS = 6;
/** The gap between chips (`gap-1.5`). */
const GAP = 6;
/** How much wider the chosen chip is than the others: its tick is bigger, its text bolder, and it may have a sparkle. */
const CHOSEN_EXTRA = 32;

/** How many chips fit on one line beside the "more" button, measured from the hidden row of every chip. */
function chipsThatFit(row: HTMLElement, measure: HTMLElement): number {
  const chips = [...measure.querySelectorAll<HTMLElement>("[data-chip]")].map((chip) => chip.offsetWidth);
  const more = measure.querySelector<HTMLElement>("[data-more]")?.offsetWidth ?? 0;
  let room = row.clientWidth - more - GAP - CHOSEN_EXTRA;
  let count = 0;
  for (const width of chips) {
    if (width > room) break;
    room -= width + GAP;
    count += 1;
  }
  return Math.max(1, count);
}

/**
 * A block's category as one tap: a chip for each of the most used categories and "more" for the rest (and for
 * a new one). The chips stay quiet (a soft fill and a dot of each color) until one is chosen: that one takes its
 * category's tint and a tick, so the choice reads without relying on the color alone. The app picks one from
 * the block's name as it is typed and says so beside the label, so a wrong guess is noticed and changed with a tap.
 */
export function CategoryChips({
  value,
  suggested,
  guessing,
  ranked,
  named,
  templates,
  onChange,
}: {
  /** The category in use, or `null` when there is none yet. */
  value: string | null;
  /** The app picked `value` from the name. */
  suggested: boolean;
  /** A pick for the name is on its way. */
  guessing: boolean;
  /** Every category, the most used first (see `useCategoryField`). */
  ranked: string[];
  /** The block has a name yet, so there is something to pick from. */
  named: boolean;
  templates: ActivityTemplate[];
  onChange: (name: string) => void;
}) {
  const categories = useCategories().data;
  const entries = useMemo(() => withImplicitCategories(categories ?? [], templates), [categories, templates]);
  const entryOf = (name: string) => entries.find((entry) => entry.name.toLowerCase() === name.toLowerCase());

  // The candidates, most used first.
  const candidates = useMemo(() => ranked.slice(0, MAX_CHIPS), [ranked]);

  // One line, always: as many chips as fit, with room kept for whichever of them is chosen to grow.
  const rowRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [fit, setFit] = useState(MAX_CHIPS);
  useLayoutEffect(() => {
    const row = rowRef.current;
    const measure = measureRef.current;
    if (!row || !measure) return;
    const update = () => setFit(chipsThatFit(row, measure));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(row);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [candidates]);

  const shown = useMemo(() => {
    const first = candidates.slice(0, fit);
    if (!value || first.some((name) => name.toLowerCase() === value.toLowerCase())) return first;
    // The one in use takes the last place, so the chips before it stay where they were.
    return [...first.slice(0, fit - 1), value];
  }, [candidates, fit, value]);
  const hidden = Math.max(0, entries.length - shown.length);

  const status = guessing
    ? "Picking from the name…"
    : suggested
      ? "Picked from the name"
      : value
        ? null
        : named
          ? "No match, pick one"
          : "Picked as you type the name";

  return (
    <div>
      <div className="flex min-h-5 items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Folder className="h-3.5 w-3.5" aria-hidden="true" />
          Category
        </span>
        {status ? (
          <span className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground" aria-live="polite">
            <Sparkles
              className={[
                "h-3 w-3 shrink-0 text-brand",
                guessing ? "animate-pulse" : "",
                guessing || suggested ? "" : "opacity-60",
              ].join(" ")}
              aria-hidden="true"
            />
            <span className="truncate">{status}</span>
          </span>
        ) : null}
      </div>

      {/* Every candidate chip, chosen-looking and out of sight, to measure what fits. */}
      <div className="relative h-0 overflow-hidden" aria-hidden="true">
        <div ref={measureRef} className="invisible absolute left-0 top-0 flex gap-1.5 whitespace-nowrap">
          {candidates.map((name) => (
            <span key={name} data-chip className={`${CATEGORY_CHIP} border-transparent font-medium`}>
              <span className="h-2 w-2 shrink-0" />
              {entryOf(name)?.name ?? name}
            </span>
          ))}
          <span data-more className={`${CATEGORY_CHIP} border-transparent font-medium`}>
            {entries.length > 10 ? "99 more" : "9 more"}
            <span className="h-3.5 w-3.5 shrink-0" />
          </span>
        </div>
      </div>

      <div ref={rowRef} role="radiogroup" aria-label="Category" className="mt-2 flex flex-nowrap gap-1.5">
        {shown.map((name) => {
          const entry = entryOf(name);
          const label = entry?.name ?? name;
          const palette = paletteOf(entry?.color ?? "slate");
          const current = value?.toLowerCase() === name.toLowerCase();
          return (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={current}
              aria-label={current && suggested ? `${label}, picked from the name` : label}
              className={[
                CATEGORY_CHIP,
                current
                  ? `${palette.chip} font-semibold`
                  : "border-transparent bg-foreground/[0.05] font-medium text-foreground/80 hover:bg-foreground/[0.09] hover:text-foreground dark:bg-foreground/[0.07] dark:hover:bg-foreground/[0.12]",
              ].join(" ")}
              onClick={() => onChange(label)}
            >
              {/* The category's dot; on the chosen chip it grows into a tick of the same color. */}
              <span
                className={[
                  "flex shrink-0 items-center justify-center rounded-full transition-[width,height] duration-150",
                  palette.dot,
                  current ? "h-4 w-4" : "h-2 w-2",
                ].join(" ")}
                aria-hidden="true"
              >
                {current ? <Check className="h-2.5 w-2.5" strokeWidth={3.5} /> : null}
              </span>
              <span className="min-w-0 truncate">{label}</span>
              {current && suggested ? <Sparkles className="-mr-0.5 h-3 w-3 shrink-0 opacity-60" aria-hidden="true" /> : null}
            </button>
          );
        })}
        <CategorySelect
          value={value ?? ""}
          templates={templates}
          variant="chip"
          chipLabel={hidden > 0 ? `${hidden} more` : "New"}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
