import { Check } from "lucide-react";

import { TimeBlock } from "@/components/day-planner/TimeBlock";
import { paletteOf } from "@/lib/colors";

type MockBlockProps = {
  emoji: string;
  title: string;
  color: string;
  done?: boolean;
  /** Single-line layout for short blocks. */
  compact?: boolean;
  /** Shown under the title, e.g. "9:00 – 11:00 AM". */
  meta?: string;
};

/**
 * A static timeline block for the landing page mockups, drawn by the same `TimeBlock` as the real one.
 * The completion ring is its `children`.
 */
export function MockBlock({ emoji, title, color, done, compact, meta }: MockBlockProps) {
  const tone = paletteOf(color);

  return (
    <TimeBlock
      emoji={emoji}
      title={title}
      time={meta}
      color={color}
      done={done}
      short={compact}
      className="relative h-full"
    >
      <span
        className={[
          "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-[1.5px]",
          compact ? "" : "mt-px",
          done
            ? `${tone.accent} border-transparent text-white`
            : `${tone.check} text-transparent`,
        ].join(" ")}
      >
        <Check className="h-2.5 w-2.5" aria-hidden="true" strokeWidth={3} />
      </span>
    </TimeBlock>
  );
}
