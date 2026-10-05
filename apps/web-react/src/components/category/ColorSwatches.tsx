import { canonicalColor, COLOR_KEYS } from "@klndr/core";
import { Check } from "lucide-react";

import { PALETTE } from "@/lib/colors";

/** The row of color choices used by the activity and category forms. */
export function ColorSwatches({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const selected = canonicalColor(value);
  return (
    <div role="radiogroup" aria-label="Color" className="flex flex-wrap gap-1.5 touch:gap-2.5">
      {COLOR_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={selected === key}
          aria-label={PALETTE[key].label}
          title={PALETTE[key].label}
          onClick={() => onChange(key)}
          className={[
            "flex h-6 w-6 cursor-pointer items-center justify-center rounded-full ring-offset-2 ring-offset-background transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring touch:h-10 touch:w-10",
            PALETTE[key].swatch,
            selected === key ? "ring-2 ring-foreground" : "",
          ].join(" ")}
        >
          {selected === key && (
            <Check className="h-3 w-3 text-white touch:h-4 touch:w-4" aria-hidden="true" strokeWidth={3} />
          )}
        </button>
      ))}
    </div>
  );
}
