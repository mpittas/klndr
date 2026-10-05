import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FONT_SANS, THEME_COLOR_GROUPS, THEMES, THEME_VARIABLES } from "../src/index";
import { themeCss } from "../tools/resolve.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(root, "..", "..");

/** The blocks, without whichever comment header the file that carries them happens to have. */
const blocksOf = (css: string) => css.slice(css.indexOf(":root {"));

describe("the theme data", () => {
  it("has a value for every variable, in both themes", () => {
    for (const theme of ["light", "dark"] as const) {
      expect(Object.keys(THEMES[theme].values).sort()).toEqual([...THEME_VARIABLES].sort());
      for (const variable of THEME_VARIABLES) {
        expect(THEMES[theme].values[variable]).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it("pins the values the web app renders", () => {
    expect(THEMES.light.scheme).toBe("light");
    expect(THEMES.dark.scheme).toBe("dark");
    expect(THEMES.light.values).toMatchObject({
      background: "#ffffff",
      foreground: "#09090b",
      card: "#ffffff",
      muted: "#f4f4f5",
      "muted-foreground": "#71717a",
      destructive: "#ef4444",
      border: "#e4e4e7",
      ring: "#18181b",
      canvas: "#f1f5f9",
    });
    expect(THEMES.dark.values).toMatchObject({
      background: "#313338",
      foreground: "#f2f3f5",
      popover: "#2b2d31",
      secondary: "#3a3c43",
      "muted-foreground": "#b5bac1",
      destructive: "#da373c",
      border: "#44474e",
      input: "#4e5058",
      ring: "#dbdee1",
      canvas: "#2b2d31",
    });
  });

  it("lists the colour mappings as groups of the same variables, in the same order", () => {
    expect(THEME_COLOR_GROUPS.flat()).toEqual([...THEME_VARIABLES]);
  });

  it("keeps the font stack the app renders with", () => {
    expect(FONT_SANS.startsWith('"Inter Variable", "Inter"')).toBe(true);
    expect(FONT_SANS).toContain("-apple-system");
  });
});

describe("themeCss", () => {
  it("produces exactly the blocks that used to sit in main.css", () => {
    const fixture = readFileSync(join(root, "test", "fixtures", "theme-css.css"), "utf8");
    expect(blocksOf(themeCss(THEMES, THEME_COLOR_GROUPS, FONT_SANS))).toBe(blocksOf(fixture));
  });

  it("is what is committed, so the file on disk cannot drift", () => {
    const committed = readFileSync(join(root, "generated", "theme.css"), "utf8");
    expect(committed).toBe(themeCss(THEMES, THEME_COLOR_GROUPS, FONT_SANS));
  });

  it("maps every variable to a Tailwind colour utility", () => {
    const css = themeCss(THEMES, THEME_COLOR_GROUPS, FONT_SANS);
    for (const variable of THEME_VARIABLES) expect(css).toContain(`--color-${variable}: var(--${variable});`);
  });

  it("declares each variable once per theme", () => {
    const css = themeCss(THEMES, THEME_COLOR_GROUPS, FONT_SANS);
    for (const variable of THEME_VARIABLES) {
      expect(css.split(`\n  --${variable}: `)).toHaveLength(3); // the light block and the dark block
    }
  });
});

describe("the web app's stylesheet", () => {
  const mainCss = readFileSync(join(repo, "apps", "web-react", "src", "styles.css"), "utf8");

  it("imports the generated theme", () => {
    expect(mainCss).toContain('@import "@klndr/tokens/theme.css";');
  });

  it("no longer defines the theme variables itself", () => {
    expect(mainCss).not.toContain("--background:");
    expect(mainCss).not.toContain("@theme inline");
  });
});
