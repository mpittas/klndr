export type ColorKey =
  | "indigo"
  | "emerald"
  | "amber"
  | "rose"
  | "sky"
  | "violet"
  | "teal"
  | "orange"
  | "pink"
  | "lime"
  | "cyan"
  | "red"
  | "yellow"
  | "purple"
  | "fuchsia"
  | "slate";

/** Display name of each color, used as the accessible label wherever one is picked. */
export const COLOR_LABELS: Record<ColorKey, string> = {
  indigo: "Indigo",
  emerald: "Emerald",
  amber: "Amber",
  rose: "Rose",
  sky: "Sky",
  violet: "Violet",
  teal: "Teal",
  orange: "Orange",
  pink: "Pink",
  lime: "Lime",
  cyan: "Cyan",
  red: "Red",
  yellow: "Yellow",
  purple: "Purple",
  fuchsia: "Fuchsia",
  slate: "Slate",
};

/** Every key a stored color may hold. Older data can still use the ones left out of the picker. */
export const ACCEPTED_COLOR_KEYS = Object.keys(COLOR_LABELS) as ColorKey[];

/**
 * The colors offered when choosing one. Each is a different hue, far enough from the others
 * (in oklab) that no two read as the same color; the order spreads them out, so the first few
 * categories a person creates look nothing alike.
 */
export const COLOR_KEYS: ColorKey[] = [
  "indigo",
  "orange",
  "emerald",
  "pink",
  "cyan",
  "yellow",
  "purple",
  "red",
  "lime",
  "fuchsia",
  "slate",
];

/** Colors dropped from the picker, shown as the nearest option that is still offered. */
const REPLACED_COLORS: Partial<Record<ColorKey, ColorKey>> = {
  amber: "yellow",
  rose: "red",
  violet: "purple",
  sky: "cyan",
  teal: "emerald",
};

export function canonicalColor(color: string): ColorKey {
  const key = color as ColorKey;
  if (!(key in COLOR_LABELS)) return "indigo";
  return REPLACED_COLORS[key] ?? key;
}
