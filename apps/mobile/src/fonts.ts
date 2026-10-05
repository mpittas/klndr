import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import type { TypeStyle } from "@klndr/tokens";

/**
 * Inter, through expo-font.
 *
 * The type scale in `@klndr/tokens` names four weights, so four files are loaded. React Native wants
 * one exact family name per weight: `fontWeight` alone does not select the right face on Android, so
 * the weight from the scale is what picks the file (see `FONT_FOR_WEIGHT`), and no `font-*` utility
 * is used anywhere in the app.
 */
export const INTER_FONTS = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
};

/** Which loaded family belongs to each weight the type scale uses. */
export const FONT_FOR_WEIGHT: Record<TypeStyle["weight"], keyof typeof INTER_FONTS> = {
  400: "Inter_400Regular",
  500: "Inter_500Medium",
  600: "Inter_600SemiBold",
  700: "Inter_700Bold",
};

export { useFonts };
