import { canonicalColor, COLOR_KEYS, type ColorKey } from "@dayro/core";
import { Check } from "lucide-react";

import { PALETTE } from "@/lib/colors";

/**
 * The row of color choices used by the activity and category forms. A color another category already has is
 * shown but can't be picked (`taken`, from `takenColors`), so no two categories look alike.
 */
export function ColorSwatches({
  value,
  onChange,
  taken,
}: {
  value: string;
  onChange: (next: string) => void;
  /** Colors other categories have, each with that category's name. */
  taken?: ReadonlyMap<ColorKey, string>;
}) {
  const selected = canonicalColor(value);
  return (
    <div role="radiogroup" aria-label="Color" className="flex flex-wrap gap-1.5 touch:gap-2.5">
      {COLOR_KEYS.map((key) => {
        const owner = selected === key ? undefined : taken?.get(key);
        const label = owner ? `${PALETTE[key].label}, used by ${owner}` : PALETTE[key].label;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected === key}
            aria-label={label}
            title={label}
            disabled={owner !== undefined}
            onClick={() => onChange(key)}
            className={[
              "relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)] ring-offset-2 ring-offset-card transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:scale-100 touch:h-10 touch:w-10",
              PALETTE[key].swatch,
              selected === key ? "ring-2 ring-foreground" : "",
            ].join(" ")}
          >
            {selected === key ? <Check className="h-3 w-3 touch:h-4 touch:w-4" aria-hidden="true" strokeWidth={3} /> : null}
            {/* A taken color is struck through, so "can't pick" reads without relying on the fading alone. */}
            {owner ? (
              <span className="absolute h-[1.5px] w-[130%] rotate-45 rounded-full bg-foreground" aria-hidden="true" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
