import { canonicalColor } from "@klndr/core";
import { PALETTE } from "@klndr/tokens";
import { View } from "react-native";

import { useThemeScheme } from "@/theme/tokens";

/** A category's colour as a small dot, drawn from the resolved palette so the phone paints what the web paints. */
export function CategoryDot({ color, size = 12 }: { color: string; size?: number }) {
  const fill = PALETTE[canonicalColor(color)][useThemeScheme()].swatch.background;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ backgroundColor: fill, borderRadius: 9999, height: size, width: size }}
    />
  );
}
