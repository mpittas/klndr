import { canonicalColor } from "@klndr/core";
import { PALETTE } from "@klndr/tokens";

import type { ThemeName } from "@klndr/tokens";

/** What a timeline block is painted with, as concrete colours (the palette is already resolved sRGB). */
export type BlockColors = {
  background: string;
  border: string;
  text: string;
  /** The time under the title. */
  meta: string;
  /** The filled completion ring. */
  accent: string;
  /** The empty completion ring's outline. */
  ring: string;
};

/** The palette roles a block uses, for a category colour in a theme; a finished block is washed out. */
export function blockColors(color: string, scheme: ThemeName, done: boolean): BlockColors {
  const palette = PALETTE[canonicalColor(color)][scheme];
  const role = done ? palette.blockDone : palette.block;
  return {
    background: role.background ?? "transparent",
    border: role.border ?? "transparent",
    text: role.text ?? "#000000",
    meta: (done ? role.text : palette.meta.text) ?? "#000000",
    accent: palette.accent.background ?? "#000000",
    ring: palette.check.border ?? "#000000",
  };
}

/** The live "now" marker's colour: rose-500, as on the web. */
export const nowColor = (scheme: ThemeName): string => PALETTE.rose[scheme].accent.background ?? "#ff2056";
