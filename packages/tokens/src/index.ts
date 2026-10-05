/**
 * @klndr/tokens — the design tokens the web and mobile apps share: the light and dark theme, the
 * radii, spacing and type scale, and every palette role resolved to concrete sRGB.
 *
 * The theme and the palette are generated (`npm run generate -w packages/tokens`) so nothing has to
 * compute colours at runtime; `src/theme.ts` stays the source of truth for the theme values.
 */
export { FONT_SANS, THEME_COLOR_GROUPS, THEMES, THEME_VARIABLES } from "./theme";
export type { Theme, ThemeName, ThemeValues, ThemeVariable } from "./theme";

export { RADII, SPACING, TYPE_SCALE } from "./scale";
export type { TypeScaleName, TypeStyle } from "./scale";

export { PALETTE_ROLES } from "./palette-types";
export type { Palette, PaletteRole, ResolvedColor, ResolvedRole } from "./palette-types";

export { PALETTE } from "../generated/palette";
