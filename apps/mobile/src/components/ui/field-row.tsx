import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { useThemeColors } from "@/theme/tokens";
import { Text } from "./text";

const SIDE = 16;
const GAP = 12;

export type FieldRowProps = {
  label: string;
  /** The control: a bare text field, picker, date picker or switch. */
  children: ReactNode;
  /** An icon tile before the label. */
  leading?: ReactNode;
  leadingWidth?: number;
  /** The label column's width, so a card's fields line up. */
  labelWidth?: number;
  divider?: boolean;
};

/**
 * A setting or a field as one line of a grouped card: its label on the left, its control on the right, the way the
 * phone's own Settings and its event editor lay out a form. The control carries the accessible name itself.
 */
export function FieldRow({ label, children, leading, leadingWidth = 28, labelWidth, divider = true }: FieldRowProps) {
  const colors = useThemeColors();
  return (
    <View className="flex-row items-center bg-card" style={{ minHeight: 50, paddingHorizontal: SIDE, gap: GAP }}>
      {leading}
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no"
        numberOfLines={1}
        style={labelWidth ? { width: labelWidth } : undefined}
        variant="callout"
      >
        {label}
      </Text>
      <View className="min-w-0 flex-1 items-end justify-center">{children}</View>
      {divider ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            left: leading ? SIDE + leadingWidth + GAP : SIDE,
            height: StyleSheet.hairlineWidth,
            backgroundColor: colors.border,
          }}
        />
      ) : null}
    </View>
  );
}
