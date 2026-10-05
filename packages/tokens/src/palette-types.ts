import type { ColorKey } from "@klndr/core";
import type { ThemeName } from "./theme";

/** Every role a colour plays in the UI, as `apps/web-react/src/lib/colors.ts` names them. */
export const PALETTE_ROLES = [
  "swatch",
  "block",
  "blockDone",
  "chip",
  "dot",
  "accent",
  "selected",
  "ghost",
  "icon",
  "meta",
  "check",
] as const;

export type PaletteRole = (typeof PALETTE_ROLES)[number];

/**
 * One role of one colour, resolved to concrete sRGB: the colours a phone can paint without
 * understanding Tailwind classes or `color-mix()`. Values are `#rrggbb`, or `#rrggbbaa` when the
 * class carried an alpha modifier (e.g. `border-indigo-200/80`).
 */
export type ResolvedRole = {
  background?: string;
  border?: string;
  text?: string;
  /** The `hover:` variants; a phone has no pointer, so they are only there for completeness. */
  hoverBackground?: string;
  hoverBorder?: string;
  hoverText?: string;
};

export type ResolvedColor = Record<ThemeName, Record<PaletteRole, ResolvedRole>>;

/** The whole palette: every colour, in both themes, in every role. */
export type Palette = Record<ColorKey, ResolvedColor>;
