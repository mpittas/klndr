import { paletteOf } from "@/lib/colors";

/**
 * A category's mark: its emoji on a tint of its color, or just a dot of the color for a category that has no
 * emoji yet (one made before categories had them). Decorative: the category's name always sits beside it.
 */
export function CategoryMark({ emoji, color, size = "md" }: { emoji?: string; color: string; size?: "sm" | "md" }) {
  if (!emoji) {
    return <span className={["h-2.5 w-2.5 shrink-0 rounded-full", paletteOf(color).dot].join(" ")} aria-hidden="true" />;
  }
  return (
    <span
      className={[
        "flex shrink-0 items-center justify-center rounded-md leading-none",
        size === "sm" ? "h-5 w-5 text-xs" : "h-6 w-6 text-sm",
        paletteOf(color).icon,
      ].join(" ")}
      aria-hidden="true"
    >
      {emoji}
    </span>
  );
}
