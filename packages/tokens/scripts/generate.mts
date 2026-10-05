/**
 * Writes the two generated artefacts: the CSS blocks the web app imports, and the palette as data.
 * Run with `npm run generate -w packages/tokens` (paths are resolved from the repo root, so it works
 * from any directory).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FONT_SANS, THEME_COLOR_GROUPS, THEMES, THEME_VARIABLES } from "../src/theme.ts";
import { RADII, SPACING, TYPE_SCALE } from "../src/scale.ts";
import { PALETTE_ROLES } from "../src/palette-types.ts";
import {
  paletteModule,
  parsePaletteClasses,
  parseTailwindColors,
  resolvePalette,
  themeCss,
  uniwindThemeCss,
} from "../tools/resolve.ts";

// …/packages/tokens/scripts/generate.mts → the repo root is three levels up.
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..", "..");

/** The React web app's palette classes are the source of truth for what each role looks like. */
const paletteSource = readFileSync(join(root, "apps/web-react/src/lib/colors.ts"), "utf8");
/** Tailwind's own theme is the source of truth for the colours those classes name. */
const tailwindSource = readFileSync(join(root, "node_modules/tailwindcss/theme.css"), "utf8");

const classes = parsePaletteClasses(paletteSource);
const palette = resolvePalette(classes, { tailwind: parseTailwindColors(tailwindSource), themes: THEMES });

const generated = join(here, "..", "generated");
mkdirSync(generated, { recursive: true });
writeFileSync(join(generated, "theme.css"), themeCss(THEMES, THEME_COLOR_GROUPS, FONT_SANS), "utf8");
writeFileSync(join(generated, "palette.ts"), paletteModule(palette), "utf8");
writeFileSync(
  join(generated, "uniwind.css"),
  uniwindThemeCss(THEMES, THEME_COLOR_GROUPS, { radii: RADII, spacing: SPACING, typeScale: TYPE_SCALE }),
  "utf8",
);

const colours = Object.keys(palette);
const sample = palette.indigo.light.block;
console.log(
  [
    `colours: ${colours.join(", ")}`,
    `roles per colour: ${PALETTE_ROLES.length}, theme variables: ${THEME_VARIABLES.length}`,
    `sample — indigo.light.block: ${JSON.stringify(sample)}`,
    "wrote generated/theme.css, generated/palette.ts and generated/uniwind.css",
  ].join("\n"),
);
