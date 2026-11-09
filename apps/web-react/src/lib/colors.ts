import { COLOR_LABELS, canonicalColor, type ColorKey } from "@dayro/core";

/**
 * The classes behind every role a category color plays; the keys and their labels live in @dayro/core.
 *
 * Each value pairs the hue (`tone-<key>`) with a role (`tone-block`, `tone-chip`, …). Both are defined in
 * `styles.css`, where every role is mixed from the same two colors (the hue and its ink) against the paper, so
 * a block, a chip, a dot and an icon of one category always agree, in light and in dark.
 */
export type PaletteEntry = {
  label: string;
  /** A filled disc of the color, e.g. in the color picker. */
  swatch: string;
  /** A timeline block. */
  block: string;
  /** A block that is done: the same hue, faded. */
  blockDone: string;
  /** A small label of a block (a month cell, a mock). Bring your own `border`. */
  chip: string;
  dot: string;
  /** The color itself, as a fill (bars, a ticked block's ring). */
  accent: string;
  selected: string;
  /** Where a dragged activity will land. Bring your own `border`. */
  ghost: string;
  /** The emoji tile of an activity or a category. */
  icon: string;
  /** Secondary text on a block (its time), tinted toward the block's hue. */
  meta: string;
  /** The completion ring on a block that isn't done yet. */
  check: string;
};

/** Literal class names, so Tailwind's scanner and a reader both see them. */
const TONE: Record<ColorKey, string> = {
  indigo: "tone-indigo",
  emerald: "tone-emerald",
  amber: "tone-amber",
  rose: "tone-rose",
  sky: "tone-sky",
  violet: "tone-violet",
  teal: "tone-teal",
  orange: "tone-orange",
  pink: "tone-pink",
  lime: "tone-lime",
  cyan: "tone-cyan",
  red: "tone-red",
  yellow: "tone-yellow",
  purple: "tone-purple",
  fuchsia: "tone-fuchsia",
  slate: "tone-slate",
};

const entry = (key: ColorKey): PaletteEntry => {
  const tone = TONE[key];
  return {
    label: COLOR_LABELS[key],
    swatch: `${tone} tone-solid`,
    block: `${tone} tone-block`,
    blockDone: `${tone} tone-block-done`,
    chip: `${tone} tone-chip`,
    dot: `${tone} tone-solid`,
    accent: `${tone} tone-solid`,
    selected: `${tone} tone-selected`,
    ghost: `${tone} tone-ghost`,
    icon: `${tone} tone-icon`,
    meta: "tone-meta",
    check: `${tone} tone-check`,
  };
};

export const PALETTE = Object.fromEntries(
  (Object.keys(TONE) as ColorKey[]).map((key) => [key, entry(key)]),
) as Record<ColorKey, PaletteEntry>;

export function paletteOf(color: string): PaletteEntry {
  return PALETTE[canonicalColor(color)];
}


