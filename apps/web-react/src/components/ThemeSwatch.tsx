import type { ThemeName } from "@/theme";

type Size = "dot" | "sm" | "tile" | "lg";

/**
 * A small picture of a theme, drawn in that theme's real colors: the inner element carries `data-theme`, so the
 * variables it uses are the theme's, not the page's (see the blocks in `styles.css`). The outline is outside it,
 * in the page's colors, so a dark swatch still has an edge on a dark page.
 *
 * Keep `dark:` classes out of the inside: they follow the page, not the swatch.
 *
 * - `dot`: a round chip with the theme's card and accent colors.
 * - `sm`: a tiny planner in a small box, for a row.
 * - `tile`: a planner that fills its parent's width, for the theme menu's grid.
 * - `lg`: a larger planner that fills its parent's width, for the profile's theme cards.
 *
 * `"system"` (all but `dot`) is Light with Dark cut in along the diagonal. `selected` draws the outline in the
 * page's ink instead of its hairline.
 */
export function ThemeSwatch({
  name,
  size = "sm",
  selected = false,
  className = "",
}: {
  name: ThemeName | "system";
  size?: Size;
  selected?: boolean;
  className?: string;
}) {
  const outer = {
    dot: "h-5 w-5 shrink-0 rounded-full",
    sm: "h-7 w-10 shrink-0 rounded-md",
    tile: "block h-14 w-full rounded-md",
    lg: "block h-20 w-full rounded-lg",
  }[size];
  const edge = selected ? "border-primary shadow-[0_0_0_1px_var(--primary)]" : size === "dot" ? "border-foreground/30" : "border-foreground/15";

  return (
    <span aria-hidden="true" className={["relative inline-block overflow-hidden border", edge, outer, className].join(" ")}>
      {size === "dot" ? (
        name === "system" ? null : (
          <span data-theme={name} className="relative block h-full w-full bg-background">
            <span className="absolute inset-y-0 left-0 w-1/2 bg-card" />
            <span className="absolute inset-y-0 right-0 w-1/2 bg-brand" />
          </span>
        )
      ) : name === "system" ? (
        <>
          <Planner name="light" size={size} />
          <span className="absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]">
            <Planner name="dark" size={size} />
          </span>
        </>
      ) : (
        <Planner name={name} size={size} />
      )}
    </span>
  );
}

/** A planner in miniature: a header, a block in the accent color, a card and a line of text. */
function Planner({ name, size }: { name: ThemeName; size: Exclude<Size, "dot"> }) {
  const header = { sm: "h-3 gap-[3px] px-1.5", tile: "h-3 gap-[3px] px-1.5", lg: "h-4 gap-1 px-2" }[size];
  const dot = size === "lg" ? "h-1.5 w-1.5" : "h-1 w-1";
  const rule = size === "lg" ? "h-1 w-6" : "h-[3px] w-4";
  const body = { sm: "inset-x-1.5 top-[17px] gap-[3px]", tile: "inset-x-1.5 top-[17px] gap-[3px]", lg: "inset-x-2 top-6 gap-1.5" }[size];
  const block = size === "lg" ? "h-3" : "h-2";
  const card = size === "lg" ? "h-4" : "h-3";

  return (
    <span data-theme={name} className="absolute inset-0 block bg-background text-foreground">
      <span className={["absolute inset-x-0 top-0 flex items-center border-b border-border bg-card", header].join(" ")}>
        <span className={["rounded-full bg-brand", dot].join(" ")} />
        <span className={["rounded-full bg-foreground/30", rule].join(" ")} />
      </span>
      <span className={["absolute flex flex-col", body].join(" ")}>
        <span className={["block w-3/4 rounded-[3px] bg-brand", block].join(" ")} />
        {size === "sm" ? null : (
          <>
            <span className={["block w-full rounded-[3px] border border-border bg-card", card].join(" ")} />
            <span className={["block w-1/2 rounded-full bg-foreground/30", size === "lg" ? "h-1" : "h-[3px]"].join(" ")} />
          </>
        )}
      </span>
    </span>
  );
}
