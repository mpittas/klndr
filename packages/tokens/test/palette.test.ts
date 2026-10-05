import { describe, expect, it } from "vitest";
import { ACCEPTED_COLOR_KEYS, COLOR_KEYS } from "@klndr/core";
import { PALETTE, PALETTE_ROLES, THEMES } from "../src/index";

const HEX = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/;
const THEME_NAMES = ["light", "dark"] as const;
/** `Object.keys` widens to `string`, which cannot index the typed palette. */
const COLORS = Object.keys(PALETTE) as (keyof typeof PALETTE)[];

describe("the palette", () => {
  it("covers every colour the app can store, and only those", () => {
    expect(Object.keys(PALETTE).sort()).toEqual([...ACCEPTED_COLOR_KEYS].sort());
    expect(Object.keys(PALETTE)).toHaveLength(16);
    for (const key of COLOR_KEYS) expect(PALETTE[key]).toBeDefined();
  });

  it("has both themes, every role, and never an empty role", () => {
    for (const color of COLORS) {
      expect(Object.keys(PALETTE[color]).sort()).toEqual(["dark", "light"]);
      for (const theme of THEME_NAMES) {
        expect(Object.keys(PALETTE[color][theme]).sort()).toEqual([...PALETTE_ROLES].sort());
        for (const role of PALETTE_ROLES) {
          expect(Object.keys(PALETTE[color][theme][role]).length, `${color}.${theme}.${role}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("resolves every value to sRGB hex", () => {
    for (const color of COLORS) {
      for (const theme of THEME_NAMES) {
        for (const role of PALETTE_ROLES) {
          for (const [field, value] of Object.entries(PALETTE[color][theme][role])) {
            expect(value, `${color}.${theme}.${role}.${field}`).toMatch(HEX);
          }
        }
      }
    }
  });

  it("gives every colour the same role shapes", () => {
    const shapes = new Set<string>();
    for (const color of COLORS) {
      for (const theme of THEME_NAMES) {
        for (const role of PALETTE_ROLES) {
          shapes.add(`${role}:${Object.keys(PALETTE[color][theme][role]).sort().join(",")}`);
        }
      }
    }
    expect([...shapes].sort()).toEqual([
      "accent:background",
      "block:background,border,hoverBackground,hoverBorder,text",
      "blockDone:background,border,hoverBorder,text",
      "check:border,hoverBorder,hoverText",
      "chip:background,border,text",
      "dot:background",
      "ghost:background,border",
      "icon:background,text",
      "meta:text",
      "selected:background,border,text",
      "swatch:background",
    ]);
  });

  it("pins a sample of resolved colours", () => {
    // Tailwind v4 defines its palette in oklch, so `indigo-500` resolves to #615fff here, not to the
    // #6366f1 of the v3 hexes: these are the colours the web app actually paints.
    expect(PALETTE.indigo.light.block).toEqual({
      background: "#eef2ff",
      border: "#c6d2ffcc",
      text: "#1e1a4d",
      hoverBackground: "#e0e7ff",
      hoverBorder: "#a3b3ffcc",
    });
    expect(PALETTE.indigo.dark.block).toEqual({
      background: "#373c56", // color-mix(in oklab, indigo-500 16%, #313338)
      border: "#7c86ff40",
      text: "#eef2ff",
      hoverBackground: "#3a4065", // … 24% …
      hoverBorder: "#7c86ff66",
    });
    expect(PALETTE.indigo.dark.blockDone).toEqual({
      background: "#333643", // … 6% …
      border: "#7c86ff26",
      text: "#eef2ff66",
      hoverBorder: "#7c86ff4d",
    });
    expect(PALETTE.indigo.light.meta).toEqual({ text: "#312c8599" });
    expect(PALETTE.indigo.dark.check).toEqual({ border: "#a3b3ff73", hoverBorder: "#c6d2ff", hoverText: "#c6d2ff" });
    expect(PALETTE.amber.light.chip).toEqual({ background: "#fffbeb", border: "#fee685", text: "#0f172b" });
    expect(PALETTE.rose.dark.icon).toEqual({ background: "#ff205640", text: "#ffe4e6" });
  });

  it("keeps a plain utility in both themes, and a dark: one in the dark theme only", () => {
    expect(PALETTE.indigo.light.dot).toEqual({ background: "#615fff" });
    expect(PALETTE.indigo.dark.dot).toEqual(PALETTE.indigo.light.dot);
    // slate's selected state is the one that overrides its background for dark mode.
    expect(PALETTE.slate.light.selected).toEqual({ background: "#1d293d", border: "#1d293d", text: "#ffffff" });
    expect(PALETTE.slate.dark.selected).toEqual({ background: "#45556c", border: "#45556c", text: "#ffffff" });
    expect(PALETTE.indigo.dark.selected).toEqual(PALETTE.indigo.light.selected);
  });

  it("fades a done block's text by the alpha its class asked for", () => {
    for (const color of COLORS) {
      const { light, dark } = PALETTE[color];
      expect(light.blockDone.text, color).toBe(`${light.block.text}73`); // /45
      expect(dark.blockDone.text, color).toBe(`${dark.block.text}66`); // /40
    }
  });

  it("tints a done block less than an open one", () => {
    const distance = (hex: string, reference: string) =>
      [1, 3, 5].reduce((sum, i) => sum + Math.abs(parseInt(hex.slice(i, i + 2), 16) - parseInt(reference.slice(i, i + 2), 16)), 0);
    for (const color of COLORS) {
      const { dark } = PALETTE[color];
      const open = distance(dark.block.background!, THEMES.dark.values.background);
      const done = distance(dark.blockDone.background!, THEMES.dark.values.background);
      expect(done, color).toBeLessThan(open);
    }
  });

  it("resolves the colours the picker no longer offers", () => {
    const legacy = ["sky", "teal", "lime", "cyan"] as const;
    const dots = legacy.map((key) => PALETTE[key].light.dot.background);
    expect(new Set(dots).size).toBe(legacy.length);
    for (const dot of dots) expect(dot).toMatch(HEX);
  });
});
