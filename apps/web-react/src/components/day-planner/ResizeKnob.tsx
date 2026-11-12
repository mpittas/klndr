import type { PointerEvent } from "react";

import { paletteOf } from "@/lib/colors";

/**
 * The knob a picked block is made longer or shorter with, as on a phone's calendar: a dot of the block's color on
 * the middle of its bottom edge. The grip around it is finger sized and hangs mostly below the block, so even a
 * short block keeps some of its body free to move it by. It answers at the first touch (the browser never scrolls
 * from it), and the click that follows a resize stays with it rather than opening the block.
 */
export function ResizeKnob({
  color,
  onPointerDown,
}: {
  color: string;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      aria-hidden="true"
      data-resize-handle
      onPointerDown={onPointerDown}
      onClick={(event) => event.stopPropagation()}
      className="absolute left-1/2 top-[calc(100%-10px)] z-[3] flex h-11 w-12 -translate-x-1/2 cursor-ns-resize touch-none items-start justify-center pt-[5px]"
    >
      <span className={["h-2.5 w-2.5 rounded-full shadow-sm ring-2 ring-card", paletteOf(color).accent].join(" ")} />
    </div>
  );
}
