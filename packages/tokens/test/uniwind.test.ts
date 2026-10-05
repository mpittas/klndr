import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { RADII, SPACING, THEMES, THEME_COLOR_GROUPS, THEME_VARIABLES, TYPE_SCALE } from "../src/index";
import { uniwindThemeCss } from "../tools/resolve.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const css = uniwindThemeCss(THEMES, THEME_COLOR_GROUPS, {
  radii: RADII,
  spacing: SPACING,
  typeScale: TYPE_SCALE,
});

describe("uniwindThemeCss", () => {
  it("is what is committed, so the file on disk cannot drift", () => {
    expect(readFileSync(join(root, "generated", "uniwind.css"), "utf8")).toBe(css);
  });

  it("scopes both themes by variant, which is how Uniwind picks one", () => {
    expect(css).toContain("@layer theme {");
    for (const theme of ["light", "dark"]) expect(css).toContain(`    @variant ${theme} {`);
    // A `.dark` class means nothing in React Native, so the web's selector must not appear.
    expect(css).not.toContain(".dark {");
  });

  it("gives every variable a value in each theme", () => {
    for (const variable of THEME_VARIABLES) {
      expect(css.split(`      --${variable}: `).length).toBe(3);
      expect(css).toContain(`--color-${variable}: var(--${variable});`);
    }
  });

  it("registers the scale in points, with line height and tracking resolved", () => {
    expect(css).toContain("--radius-md: 10px;");
    expect(css).toContain("--radius-full: 9999px;");
    expect(css).toContain("--spacing-lg: 24px;");
    expect(css).toContain("--text-display: 30px;");
    expect(css).toContain("--text-display--font-weight: 700;");
    expect(css).toContain("--text-display--letter-spacing: -0.75px;"); // -0.025em of 30px
    expect(css).toContain("--text-body--line-height: 21px;"); // 1.5 × 14px
    expect(css).toContain("--text-body--font-weight: 400;");
    // The web's units would be wrong in React Native: `1.5` is not a line height in points.
    expect(css).not.toContain("--text-body--line-height: 1.5;");
    expect(css).not.toContain("em;");
  });

  it("leaves the font stack out, because a React Native family is one exact name", () => {
    expect(css).not.toContain("--font-sans");
  });
});
