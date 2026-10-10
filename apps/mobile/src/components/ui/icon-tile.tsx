import { canonicalColor } from "@klndr/core";
import { PALETTE } from "@klndr/tokens";
import type { ReactNode } from "react";
import { View } from "react-native";

import { useThemeColors, useThemeScheme } from "@/theme/tokens";
import { Text } from "./text";

export type IconTileProps = {
  /** An icon, or an emoji (a string is drawn as one). */
  children: ReactNode;
  /** A category colour key: the tile takes that category's soft tint. Without one it is a neutral grey. */
  color?: string;
  size?: number;
};

/**
 * The rounded square at the start of a row: an activity's emoji on its category's tint, or a setting's icon on
 * grey. Colour stays with the categories (DESIGN.md), so a setting's tile is never coloured.
 */
export function IconTile({ children, color, size = 32 }: IconTileProps) {
  const scheme = useThemeScheme();
  const theme = useThemeColors();
  const background = color ? (PALETTE[canonicalColor(color)][scheme].icon.background ?? theme.muted) : theme.muted;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        backgroundColor: background,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {typeof children === "string" ? (
        <Text style={{ fontSize: Math.round(size * 0.55), lineHeight: Math.round(size * 0.72) }}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}
