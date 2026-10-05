import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FONT_SANS, THEMES, THEME_COLOR_GROUPS } from "../src/index";
import { PALETTE_ROLES } from "../src/palette-types.ts";
import {
  paletteModule,
  parsePaletteClasses,
  parseTailwindColors,
  resolvePalette,
  resolveRole,
  themeCss,
  type ResolveContext,
} from "../tools/resolve.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(root, "..", "..");

const paletteSource = () => readFileSync(join(repo, "apps", "web-react", "src", "lib", "colors.ts"), "utf8");
const context = (): ResolveContext => ({
  tailwind: parseTailwindColors(readFileSync(join(repo, "node_modules", "tailwindcss", "theme.css"), "utf8")),
  themes: THEMES,
});

describe("parseTailwindColors", () => {
  const colors = context().tailwind;

  it("reads Tailwind's oklch values and its two plain colours", () => {
    expect(colors["indigo-500"]).toBe("oklch(58.5% 0.233 277.117)");
    expect(colors.white).toBe("#fff");
    expect(colors.black).toBe("#000");
  });

  it("ignores the theme's non-colour variables", () => {
    expect(colors.spacing).toBeUndefined();
    expect(colors["radius-lg"]).toBeUndefined();
  });
});

describe("parsePaletteClasses", () => {
  it("reads every colour and role out of the web app's own file", () => {
    const classes = parsePaletteClasses(paletteSource());
    expect(Object.keys(classes)).toHaveLength(16);
    for (const [color, roles] of Object.entries(classes)) {
      expect(Object.keys(roles).sort(), color).toEqual([...PALETTE_ROLES].sort());
      for (const role of PALETTE_ROLES) expect(roles[role], `${color}.${role}`).toBeTruthy();
    }
    expect(classes.indigo.swatch).toBe("bg-indigo-500");
    expect(classes.indigo.block).toContain("dark:bg-[color-mix(in_oklab,var(--color-indigo-500)_16%,var(--background))]");
  });

  it("complains when the source it is given is not the palette", () => {
    expect(() => parsePaletteClasses("export const other = 1;")).toThrow(/Could not find the PALETTE/);
  });
});

describe("resolveRole", () => {
  const resolved = () => context();

  it("turns a utility into an sRGB value", () => {
    expect(resolveRole("bg-slate-50", "light", resolved())).toEqual({ background: "#f8fafc" });
    expect(resolveRole("bg-slate-50/90", "light", resolved())).toEqual({ background: "#f8fafce6" });
    expect(resolveRole("text-white", "light", resolved())).toEqual({ text: "#ffffff" });
    expect(resolveRole("", "light", resolved())).toEqual({});
  });

  it("reads every property and the hover variants", () => {
    expect(resolveRole("bg-indigo-50 border-indigo-200/80 text-indigo-950 hover:bg-indigo-100", "light", resolved())).toEqual({
      background: "#eef2ff",
      border: "#c6d2ffcc",
      text: "#1e1a4d",
      hoverBackground: "#e0e7ff",
    });
  });

  it("applies a plain utility in both themes and a dark: one in the dark theme alone", () => {
    const classes = "bg-red-500 dark:bg-blue-500";
    const light = resolveRole(classes, "light", resolved());
    const dark = resolveRole(classes, "dark", resolved());
    expect(light).toEqual(resolveRole("bg-red-500", "light", resolved()));
    expect(dark).toEqual(resolveRole("bg-blue-500", "dark", resolved()));
    expect(light).not.toEqual(dark);
  });

  it("computes color-mix in oklab, with the weight the class asks for", () => {
    const mix = (weight: number, over: string) =>
      resolveRole(`bg-[color-mix(in_oklab,var(--color-indigo-500)_${weight}%,var(--${over}))]`, "dark", resolved());
    // 0% of the tint is the colour it is mixed over, 100% is the colour itself.
    expect(mix(0, "background")).toEqual({ background: THEMES.dark.values.background });
    expect(mix(100, "background")).toEqual(resolveRole("bg-indigo-500", "dark", resolved()));
    expect(mix(16, "background")).toEqual({ background: "#373c56" });
  });

  it("refuses anything it cannot account for", () => {
    expect(() => resolveRole("bg-notacolour-500", "light", resolved())).toThrow(/Tailwind has no --color-notacolour-500/);
    expect(() => resolveRole("p-4", "light", resolved())).toThrow(/Cannot read a colour/);
    expect(() => resolveRole("bg-[color-mix(in_srgb,var(--color-indigo-500)_16%,var(--background))]", "light", resolved())).toThrow(
      /Cannot read a color-mix/,
    );
    expect(() => resolveRole("bg-[url(/x.png)]", "light", resolved())).toThrow(/Cannot read a color-mix/);
  });
});

describe("resolvePalette", () => {
  it("complains when a role is missing", () => {
    expect(() => resolvePalette({ indigo: { block: "bg-indigo-50" } }, context())).toThrow(/no "swatch" classes/);
  });

  it("is exactly what is committed, so the palette cannot drift", () => {
    const palette = resolvePalette(parsePaletteClasses(paletteSource()), context());
    expect(paletteModule(palette)).toBe(readFileSync(join(root, "generated", "palette.ts"), "utf8"));
  });
});

describe("the emitters", () => {
  it("heads the CSS with a do-not-edit note and ends with a newline", () => {
    const css = themeCss(THEMES, THEME_COLOR_GROUPS, FONT_SANS);
    expect(css.startsWith("/*")).toBe(true);
    expect(css).toContain("Do not edit");
    expect(css.endsWith("}\n")).toBe(true);
  });

  it("heads the module with a do-not-edit note and a typed export", () => {
    const module = paletteModule(resolvePalette(parsePaletteClasses(paletteSource()), context()));
    expect(module).toContain("Do not edit");
    expect(module).toContain('import type { Palette } from "../src/palette-types";');
    expect(module).toContain("export const PALETTE: Palette = {");
  });
});
