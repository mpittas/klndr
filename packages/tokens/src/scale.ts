/**
 * Radii, spacing and the type scale, taken from `DESIGN.md` (the design system's own numbers).
 * Sizes are in points, because the mobile app is what reads them; the web app's rem-based Tailwind
 * classes are the same scale at a 16px root.
 */

/** `rounded` in DESIGN.md: chips and controls, cards and buttons, structural panels, and pills. */
export const RADII = {
  sm: 6,
  md: 10,
  lg: 14,
  full: 9999,
} as const;

/** The spacing steps DESIGN.md names, in points. */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
} as const;

export type TypeStyle = {
  /** Font size in points. */
  size: number;
  /** Font weight; the type scale is Inter, whose weights are named numerically here. */
  weight: 400 | 500 | 600 | 700;
  /** Letter spacing in em, where DESIGN.md tightens it. */
  tracking?: number;
  /** Line height as a multiple of the size, where DESIGN.md states one. */
  lineHeight?: number;
};

/** The type scale in DESIGN.md's "Typography" (rem values converted at 16px). */
export const TYPE_SCALE = {
  display: { size: 30, weight: 700, tracking: -0.025 },
  title: { size: 18, weight: 600, tracking: -0.015 },
  body: { size: 14, weight: 400, lineHeight: 1.5 },
  caption: { size: 12, weight: 500 },
  micro: { size: 11, weight: 500 },
  nano: { size: 10, weight: 600 },
} as const satisfies Record<string, TypeStyle>;

export type TypeScaleName = keyof typeof TYPE_SCALE;
