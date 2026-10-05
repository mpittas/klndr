import { useState } from "react";

/**
 * An emoji that pops in when it changes, such as the one picked for a block a moment after it was saved. The
 * emoji showing when it first appears just sits there, so a list that loads doesn't flash.
 */
export function EmojiPop({ emoji, className }: { emoji: string; className?: string }) {
  const [first] = useState(emoji);
  return (
    <span
      key={emoji}
      className={[className, emoji !== first ? "inline-block animate-in fade-in-0 zoom-in-50 duration-300" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      {emoji}
    </span>
  );
}
