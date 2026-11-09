/**
 * The token builders. They turn Tailwind's oklch theme values and the web app's palette classes into
 * concrete sRGB, and turn the theme into the CSS blocks the web app imports.
 *
 * Node-safe on purpose: these files are run straight by `node scripts/generate.mts` (Node strips the
 * types), so a relative import that survives type stripping carries an explicit `.ts` extension.
 */
import { converter, formatHex, formatHex8, parse, toGamut } from "culori";
import type { ColorKey } from "@klndr/core";
import type { Theme, ThemeName, ThemeValues, ThemeVariable } from "../src/theme.ts";
import { PALETTE_ROLES, type Palette, type PaletteRole, type ResolvedColor, type ResolvedRole } from "../src/palette-types.ts";

/** The palette as `apps/web-react/src/lib/colors.ts` writes it: colour → role → Tailwind classes. */
export type PaletteClasses = Record<string, Partial<Record<PaletteRole, string>>>;

/** What resolving a class list needs: Tailwind's colours and the two themes. */
export type ResolveContext = {
  tailwind: Record<string, string>;
  themes: Record<ThemeName, { values: ThemeValues }>;
};

const THEME_NAMES: ThemeName[] = ["light", "dark"];

/** `--color-indigo-500: oklch(58.5% 0.233 277.117);` → `{ "indigo-500": "oklch(…)" }`. */
export function parseTailwindColors(css: string): Record<string, string> {
  const colors: Record<string, string> = {};
  for (const match of css.matchAll(/--color-([a-z0-9-]+):\s*([^;]+);/g)) {
    colors[match[1]] = match[2].trim();
  }
  return colors;
}

/**
 * Read the palette out of the web app's own `lib/colors.ts`, so the classes stay in one place.
 * The file is a plain object literal, which is what makes this possible without importing the app's code.
 */
export function parsePaletteClasses(source: string): PaletteClasses {
  const start = source.indexOf("export const PALETTE");
  const end = source.indexOf("export function paletteOf");
  if (start < 0 || end < 0) throw new Error("Could not find the PALETTE object in the source");

  const palette: PaletteClasses = {};
  for (const entry of source.slice(start, end).matchAll(/^ {2}([a-z]+): \{([\s\S]*?)^ {2}\},$/gm)) {
    const roles: Partial<Record<PaletteRole, string>> = {};
    for (const field of entry[2].matchAll(/^ {4}([a-zA-Z]+): "([^"]*)",$/gm)) {
      if ((PALETTE_ROLES as readonly string[]).includes(field[1])) roles[field[1] as PaletteRole] = field[2];
    }
    palette[entry[1]] = roles;
  }
  return palette;
}

/** A colour a class names: a Tailwind colour (with its alpha), or a `color-mix` of one over a theme colour. */
type ColorValue =
  | { kind: "color"; name: string; alpha: number }
  | { kind: "mix"; name: string; weight: number; over: ThemeVariable };

type Property = "background" | "border" | "text";
type Target = { dark: boolean; hover: boolean; property: Property };

/** `dark:hover:border-indigo-400/40` → a dark, hover, border target and the colour it names. */
function classify(token: string): { target: Target; value: ColorValue } {
  const parts = token.split(":");
  const utility = parts.pop() ?? "";
  const variants = parts;
  const match = /^(bg|border|text)-(.+)$/.exec(utility);
  if (!match) throw new Error(`Cannot read a colour out of "${token}"`);
  return {
    target: {
      dark: variants.includes("dark"),
      hover: variants.includes("hover"),
      property: match[1] === "bg" ? "background" : (match[1] as Property),
    },
    value: parseColorValue(match[2]),
  };
}

function parseColorValue(value: string): ColorValue {
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).replace(/_/g, " ");
    const match = /^color-mix\(in oklab,\s*var\(--color-([a-z0-9-]+)\)\s*([\d.]+)%\s*,\s*var\(--([a-z-]+)\)\)$/.exec(inner);
    if (!match) throw new Error(`Cannot read a color-mix out of "${inner}"`);
    return { kind: "mix", name: match[1], weight: Number(match[2]) / 100, over: match[3] as ThemeVariable };
  }
  const match = /^([a-z]+(?:-\d+)?)(?:\/(\d+))?$/.exec(value);
  if (!match) throw new Error(`Cannot read a colour out of "${value}"`);
  return { kind: "color", name: match[1], alpha: match[2] ? Number(match[2]) / 100 : 1 };
}

/**
 * sRGB gamut mapping as CSS Color 4 defines it (the same algorithm a browser applies when it paints
 * an out-of-gamut oklch colour), plus the two conversions the rest of this file needs.
 */
const toSrgb = toGamut("rgb", "oklch");
const toOklab = converter("oklab");

const lerp = (from: number, to: number, weight: number) => from * weight + to * (1 - weight);

/** `color-mix(in oklab, A weight%, B)`, computed in oklab exactly as a browser does. */
function mixInOklab(from: string, over: string, weight: number) {
  const a = toOklab(parse(from)!);
  const b = toOklab(parse(over)!);
  return { mode: "oklab" as const, l: lerp(a.l, b.l, weight), a: lerp(a.a, b.a, weight), b: lerp(a.b, b.b, weight) };
}

/** A colour as a phone can paint it: `#rrggbb`, or `#rrggbbaa` when it carries an alpha. */
function toHex(source: string | ReturnType<typeof mixInOklab>, alpha: number): string {
  const mapped = toSrgb(typeof source === "string" ? parse(source)! : source);
  return alpha >= 1 ? formatHex(mapped) : formatHex8({ ...mapped, alpha });
}

/** Where a resolved value goes: `bg-` → `background`, and `hoverBorder` for a `hover:` variant. */
function fieldOf(target: Target): keyof ResolvedRole {
  const property = target.property;
  if (!target.hover) return property;
  return property === "background" ? "hoverBackground" : property === "border" ? "hoverBorder" : "hoverText";
}

/** One role's class list, resolved for one theme. */
export function resolveRole(classes: string, theme: ThemeName, context: ResolveContext): ResolvedRole {
  const resolved: ResolvedRole = {};
  for (const token of classes.split(/\s+/).filter(Boolean)) {
    const { target, value } = classify(token);
    // A `dark:` utility applies only in the dark theme; a plain one applies in both. The class lists
    // keep their `dark:` utilities last, so applying them in order lands where the cascade would.
    if (target.dark && theme !== "dark") continue;

    const tailwind = context.tailwind[value.name];
    if (!tailwind) throw new Error(`Tailwind has no --color-${value.name}`);
    const source =
      value.kind === "color"
        ? tailwind
        : mixInOklab(tailwind, context.themes[theme].values[value.over], value.weight);

    resolved[fieldOf(target)] = toHex(source, value.kind === "color" ? value.alpha : 1);
  }
  return resolved;
}

/** The whole palette: every colour, both themes, every role. */
export function resolvePalette(classes: PaletteClasses, context: ResolveContext): Palette {
  const palette = {} as Palette;
  for (const [color, roles] of Object.entries(classes)) {
    const byTheme = {} as ResolvedColor;
    for (const theme of THEME_NAMES) {
      const byRole = {} as Record<PaletteRole, ResolvedRole>;
      for (const role of PALETTE_ROLES) {
        const list = roles[role];
        if (!list) throw new Error(`The "${color}" palette entry has no "${role}" classes`);
        byRole[role] = resolveRole(list, theme, context);
      }
      byTheme[theme] = byRole;
    }
    palette[color as ColorKey] = byTheme;
  }
  return palette;
}

const CSS_HEADER = `/*
 * Generated by \`npm run generate -w packages/tokens\` from packages/tokens/src/theme.ts.
 * Do not edit: change the theme data and regenerate. The web app imports this file.
 */`;

const MODULE_HEADER = `/*
 * Generated by \`npm run generate -w packages/tokens\` from apps/web-react/src/lib/colors.ts (the
 * Tailwind classes) and Tailwind's own oklch theme values. Do not edit: change those and regenerate.
 */`;

const UNIWIND_HEADER = `/*
 * Generated by \`npm run generate -w packages/tokens\` from packages/tokens/src/theme.ts and
 * packages/tokens/src/scale.ts. Do not edit: change the tokens and regenerate. The mobile app
 * imports this file.
 */`;

/**
 * The `:root`, `.dark` and `@theme inline` blocks the web app used to spell out in `main.css`.
 * The formatting is deliberately the same, so the move changes nothing.
 */
export function themeCss(
  themes: Record<ThemeName, Theme>,
  groups: readonly (readonly string[])[],
  fontSans: string,
): string {
  const blocks: string[] = [];

  for (const name of THEME_NAMES) {
    const theme = themes[name];
    blocks.push(
      [
        name === "light" ? ":root {" : ".dark {",
        `  color-scheme: ${theme.scheme};`,
        "",
        ...Object.entries(theme.values).map(([variable, value]) => `  --${variable}: ${value};`),
        "}",
      ].join("\n"),
    );
  }

  const mapping = groups.flatMap((group, index) => [
    ...group.map((variable) => `  --color-${variable}: var(--${variable});`),
    ...(index === groups.length - 1 ? [] : [""]),
  ]);
  blocks.push(["@theme inline {", `  --font-sans: ${fontSans};`, "", ...mapping, "}"].join("\n"));

  return `${CSS_HEADER}\n\n${blocks.join("\n\n")}\n`;
}

/** The palette as a TypeScript module, so the phone needs no colour maths at runtime. */
export function paletteModule(palette: Palette): string {
  return `${MODULE_HEADER}\nimport type { Palette } from "../src/palette-types";\n\nexport const PALETTE: Palette = ${JSON.stringify(palette, null, 2)};\n`;
}

/** Points, rounded to two decimals: React Native has no `em` and no unitless line height. */
function points(value: number): string {
  return `${Math.round(value * 100) / 100}px`;
}

/**
 * The same theme and scale, shaped for Uniwind — the mobile app's Tailwind.
 *
 * Uniwind chooses a theme by *variant*, not by a `.dark` class, so the colours sit in the `light`
 * and `dark` blocks of `:root` inside `@layer theme`, and `@theme inline` maps them to utilities
 * exactly as the web's file does. The scale comes along too, so `rounded-md`, `p-md` and `text-body`
 * mean DESIGN.md's numbers on the phone: radii and spacing in points, and the type scale with its
 * line height and tracking already resolved, because React Native wants `21px` where the web writes
 * a multiple of the size and `-0.75px` where the web writes `-0.025em`.
 *
 * `--font-sans` is deliberately absent: a font *stack* is a browser idea, and React Native needs one
 * exact family per weight, which the app's Text primitive supplies.
 */
export function uniwindThemeCss(
  themes: Record<ThemeName, Theme>,
  groups: readonly (readonly string[])[],
  scale: {
    radii: Record<string, number>;
    spacing: Record<string, number>;
    typeScale: Record<string, { size: number; weight: number; tracking?: number; lineHeight?: number }>;
  },
): string {
  const variants = THEME_NAMES.map((name) =>
    [
      `    @variant ${name} {`,
      ...Object.entries(themes[name].values).map(([variable, value]) => `      --${variable}: ${value};`),
      "    }",
    ].join("\n"),
  );

  const mapping = groups.flatMap((group, index) => [
    ...group.map((variable) => `  --color-${variable}: var(--${variable});`),
    ...(index === groups.length - 1 ? [] : [""]),
  ]);

  const radii = Object.entries(scale.radii).map(([name, value]) => `  --radius-${name}: ${points(value)};`);
  const spacing = Object.entries(scale.spacing).map(([name, value]) => `  --spacing-${name}: ${points(value)};`);
  const type = Object.entries(scale.typeScale).flatMap(([name, style]) => [
    `  --text-${name}: ${points(style.size)};`,
    `  --text-${name}--font-weight: ${style.weight};`,
    ...(style.lineHeight === undefined ? [] : [`  --text-${name}--line-height: ${points(style.size * style.lineHeight)};`]),
    ...(style.tracking === undefined ? [] : [`  --text-${name}--letter-spacing: ${points(style.size * style.tracking)};`]),
  ]);

  return [
    UNIWIND_HEADER,
    "",
    "@layer theme {",
    "  :root {",
    variants.join("\n\n"),
    "  }",
    "}",
    "",
    "@theme inline {",
    ...mapping,
    "}",
    "",
    "@theme {",
    ...radii,
    "",
    ...spacing,
    "",
    ...type,
    "}",
    "",
  ].join("\n");
}


