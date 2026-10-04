/**
 * The app's theme. This file is the single source of truth: `scripts/generate.mts` turns it into the
 * CSS blocks the web app imports, and the mobile app reads the same values straight from here.
 */

export type ThemeName = "light" | "dark";

/** Every theme colour variable, in the order the CSS blocks list them. */
export const THEME_VARIABLES = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "border",
  "input",
  "ring",
  "canvas",
] as const;

export type ThemeVariable = (typeof THEME_VARIABLES)[number];
export type ThemeValues = Record<ThemeVariable, string>;

export type Theme = {
  /** What the browser (or the phone) should use for form controls and scrollbars. */
  scheme: "light" | "dark";
  values: ThemeValues;
};

export const THEMES: Record<ThemeName, Theme> = {
  light: {
    scheme: "light",
    values: {
      background: "#ffffff",
      foreground: "#09090b",
      card: "#ffffff",
      "card-foreground": "#09090b",
      popover: "#ffffff",
      "popover-foreground": "#09090b",
      primary: "#18181b",
      "primary-foreground": "#fafafa",
      secondary: "#f4f4f5",
      "secondary-foreground": "#18181b",
      muted: "#f4f4f5",
      "muted-foreground": "#71717a",
      accent: "#f4f4f5",
      "accent-foreground": "#18181b",
      destructive: "#ef4444",
      "destructive-foreground": "#fafafa",
      border: "#e4e4e7",
      input: "#e4e4e7",
      ring: "#18181b",
      canvas: "#f1f5f9",
    },
  },
  dark: {
    scheme: "dark",
    values: {
      background: "#313338",
      foreground: "#f2f3f5",
      card: "#313338",
      "card-foreground": "#f2f3f5",
      popover: "#2b2d31",
      "popover-foreground": "#f2f3f5",
      primary: "#f2f3f5",
      "primary-foreground": "#1e1f22",
      secondary: "#3a3c43",
      "secondary-foreground": "#f2f3f5",
      muted: "#3a3c43",
      "muted-foreground": "#b5bac1",
      accent: "#3f4147",
      "accent-foreground": "#f2f3f5",
      destructive: "#da373c",
      "destructive-foreground": "#f2f3f5",
      border: "#44474e",
      input: "#4e5058",
      ring: "#dbdee1",
      canvas: "#2b2d31",
    },
  },
};

/**
 * Which variables `@theme inline` maps to Tailwind colour utilities, and how they are grouped
 * (the CSS blocks below keep a blank line between groups).
 */
export const THEME_COLOR_GROUPS: readonly (readonly ThemeVariable[])[] = [
  ["background", "foreground"],
  ["card", "card-foreground"],
  ["popover", "popover-foreground"],
  ["primary", "primary-foreground"],
  ["secondary", "secondary-foreground"],
  ["muted", "muted-foreground"],
  ["accent", "accent-foreground"],
  ["destructive", "destructive-foreground"],
  ["border", "input", "ring"],
  ["canvas"],
];

/**
 * `--font-sans`: Inter first, then the platform's own stack. `html` and the `font-sans` utility both
 * use it, so the web app and the mobile app share one stack.
 */
export const FONT_SANS =
  '"Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"';
