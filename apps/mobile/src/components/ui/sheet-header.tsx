import type { ReactNode } from "react";
import { View } from "react-native";

import { X } from "@/icons";
import { useThemeColors } from "@/theme/tokens";
import { CircleButton } from "./circle-button";
import { Text } from "./text";

export type SheetHeaderProps = {
  title: string;
  /** A quieter line under the title: the day, the time, what the sheet is about. */
  subtitle?: string;
  /** Closes the sheet; the system's swipe-down does the same. */
  onClose?: () => void;
  /** Anything else for the header's end, before the close button. */
  trailing?: ReactNode;
};

/** The top of every sheet: its title (and what it is about), and a close button within thumb's reach of it. */
export function SheetHeader({ title, subtitle, onClose, trailing }: SheetHeaderProps) {
  const colors = useThemeColors();
  return (
    // Room above for the system's grabber.
    <View className="flex-row items-center gap-sm px-md pb-sm" style={{ paddingTop: 22 }}>
      <View className="min-w-0 flex-1">
        <Text accessibilityRole="header" numberOfLines={1} variant="headline">
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} numeric tone="muted" variant="caption">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {onClose ? (
        <CircleButton label="Close" onPress={onClose} size={32} variant="muted">
          <X color={colors["muted-foreground"]} size={18} strokeWidth={2.4} />
        </CircleButton>
      ) : null}
    </View>
  );
}
