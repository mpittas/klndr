import type { CSSProperties, ReactNode } from "react";

import { paletteOf } from "@/lib/colors";

type TimeBlockProps = {
  emoji: string;
  title: string;
  /** e.g. "9:00 – 11:00 AM" */
  time?: string;
  color: string;
  done?: boolean;
  /** One line, title and time side by side: for blocks shorter than half an hour. */
  short?: boolean;
  /** Lines the title may wrap to on a two-line block. */
  lines?: 1 | 2;
  className?: string;
  /** Where the timeline puts the block. */
  style?: CSSProperties;
  /** A control before the text. */
  leading?: ReactNode;
  /** A control after the text (the completion ring on the mocks). */
  children?: ReactNode;
};

/**
 * The face of a timeline block: emoji and title
 * with the time under it, or beside it when the block is too short for two lines. The time is dropped
 * when the block is too narrow for it (under 8rem, e.g. several blocks side by side). The planner, its
 * drop preview and the landing page mockups all draw blocks with this, so they look alike.
 */
export function TimeBlock({
  emoji,
  title,
  time,
  color,
  done,
  short,
  lines,
  className,
  style,
  leading,
  children,
}: TimeBlockProps) {
  const tone = paletteOf(color);

  return (
    <div
      className={[
        "@container flex gap-2 overflow-hidden rounded-md border pl-2.5 pr-2",
        short ? "items-center" : "items-start pt-1",
        done ? tone.blockDone : tone.block,
        className ?? "",
      ].join(" ")}
      style={style}
    >
      {leading}
      <div className={["min-w-0 flex-1", short ? "flex items-baseline gap-2" : ""].join(" ")}>
        <p
          className={[
            "text-[13px] font-medium leading-4",
            !short && lines === 2 ? "line-clamp-2 break-words" : "truncate",
          ].join(" ")}
        >
          {emoji ? <span className={done ? "opacity-50" : undefined}>{emoji}</span> : null}
          {emoji ? "\u00a0" : null}
          {title}
        </p>
        {time ? (
          <p
            className={[
              "text-xs leading-4 tabular-nums",
              short ? "hidden shrink-0 @[15rem]:block" : "mt-px truncate @max-[8rem]:hidden",
              done ? "opacity-80" : tone.meta,
            ].join(" ")}
          >
            {time}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}
