import { ListChecks, TextAlignStart } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { EmojiPop } from "@/components/EmojiPop";
import { paletteOf } from "@/lib/colors";
import type { NoteSummary } from "@/lib/notes";

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
  /** What the block's note holds, if it has one: a tiny mark says so (with its to-dos ticked off, if any). */
  note?: NoteSummary | null;
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
  note,
  leading,
  children,
}: TimeBlockProps) {
  const tone = paletteOf(color);

  // Like a card's badges on a board: lines of text for a note, a tick and a count for one with to-dos. Hidden on
  // a block too narrow to spare the room (several side by side in the week).
  const noteMark = note ? (
    <span
      title={note.total ? `${note.done} of ${note.total} to-dos done` : "Has notes"}
      className={[
        "inline-flex shrink-0 items-center gap-0.5 text-[10.5px] font-medium leading-4 tabular-nums @max-[3.5rem]:hidden",
        short ? "self-center" : "",
        done ? "opacity-60" : `${tone.meta} opacity-80`,
      ].join(" ")}
    >
      {note.total ? (
        <>
          <ListChecks className="h-3 w-3" strokeWidth={2.25} aria-hidden="true" />
          {note.done}/{note.total}
        </>
      ) : (
        <TextAlignStart className="h-3 w-3" strokeWidth={2.25} aria-hidden="true" />
      )}
      <span className="sr-only">{note.total ? `, ${note.done} of ${note.total} to-dos done` : ", has notes"}</span>
    </span>
  ) : null;

  const timeClass = done ? "opacity-75" : tone.meta;

  return (
    <div
      className={[
        "@container flex gap-2 overflow-hidden rounded-md border pl-2.5 pr-2 transition-colors duration-150",
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
            "text-[13px] leading-4 tracking-[-0.005em]",
            // Done reads at a glance without the color: lighter type and the title struck through.
            done ? "font-medium" : "font-semibold",
            !short && lines === 2 ? "line-clamp-2 break-words" : "truncate",
          ].join(" ")}
        >
          {emoji ? <EmojiPop emoji={emoji} className={done ? "opacity-45 grayscale" : undefined} /> : null}
          {emoji ? "\u00a0" : null}
          <span className={done ? "line-through decoration-current/60 decoration-[1.5px]" : undefined}>{title}</span>
        </p>
        {short ? (
          <>
            {time ? (
              <p className={["hidden shrink-0 text-xs leading-4 tabular-nums @[15rem]:block", timeClass].join(" ")}>{time}</p>
            ) : null}
            {noteMark}
          </>
        ) : time || noteMark ? (
          // The time, then the note's mark after it. The time gives way first on a narrow block; the mark stays.
          <div className="mt-px flex min-w-0 items-center gap-1.5">
            {time ? (
              <p className={["min-w-0 truncate text-xs leading-4 tabular-nums @max-[8rem]:hidden", timeClass].join(" ")}>{time}</p>
            ) : null}
            {noteMark}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}
