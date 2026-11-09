import { MONTH_LABELS, getMonthIndex, getYear } from "@klndr/core";
import { Pressable, View } from "react-native";

import { Chip, CircleButton, Text } from "@/components/ui";
import { ChevronDown, ChevronLeft, ChevronRight } from "@/icons";
import { useThemeColors } from "@/theme/tokens";

export type MonthHeaderProps = {
  /** Any day in the month on screen. */
  month: string;
  isCurrentMonth: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  /** The title was tapped: choose another month, a year or an exact date. */
  onPickMonth: () => void;
};

/**
 * The top of the Calendar tab: the month and year as a large title (tap it to choose another), a way back to this
 * month, and the month before and after.
 */
export function MonthHeader({ month, isCurrentMonth, onPrevious, onNext, onToday, onPickMonth }: MonthHeaderProps) {
  const colors = useThemeColors();
  const name = MONTH_LABELS[getMonthIndex(month)];

  return (
    <View className="flex-row items-center gap-sm">
      <Pressable
        accessibilityHint="Opens a picker to choose a month, a year or an exact date"
        accessibilityLabel={`${name} ${getYear(month)}`}
        accessibilityRole="button"
        className="min-w-0 flex-1 flex-row items-center gap-xs"
        onPress={onPickMonth}
        style={({ pressed }) => ({ minHeight: 44, opacity: pressed ? 0.6 : 1 })}
      >
        <Text accessibilityRole="header" numberOfLines={1} variant="largeTitle">
          {name}
          <Text tone="muted" variant="largeTitle">
            {` ${getYear(month)}`}
          </Text>
        </Text>
        <ChevronDown color={colors["muted-foreground"]} size={22} strokeWidth={2.4} />
      </Pressable>

      {isCurrentMonth ? null : <Chip compact label="Today" onPress={onToday} />}
      <CircleButton label="Previous month" onPress={onPrevious} size={34}>
        <ChevronLeft color={colors.foreground} size={19} strokeWidth={2.4} />
      </CircleButton>
      <CircleButton label="Next month" onPress={onNext} size={34}>
        <ChevronRight color={colors.foreground} size={19} strokeWidth={2.4} />
      </CircleButton>
    </View>
  );
}
