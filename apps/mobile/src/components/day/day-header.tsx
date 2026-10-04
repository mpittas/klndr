import { formatDuration, longDate, mediumDate } from "@klndr/core";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chip, IconButton, Text } from "@/components/ui";
import { ChevronLeft, ChevronRight, Redo2, Undo2 } from "@/icons";
import { useThemeColors } from "@/theme/tokens";

export type DayHeaderProps = {
  day: string;
  isToday: boolean;
  /** Minutes scheduled, blocks, blocks done. */
  stats: { scheduled: number; count: number; done: number };
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  /** The title was tapped: choose another date. */
  onPickDate: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
};

/**
 * The top of the Day tab: the date (tap it to choose another), the day before and after, a way back to
 * today, and undo and redo for what was done to this day's timeline.
 */
export function DayHeader(props: DayHeaderProps) {
  const { day, isToday, stats, onPrevious, onNext, onToday, onPickDate, canUndo, canRedo, onUndo, onRedo } = props;
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  return (
    <View
      className="flex-row items-center gap-xs border-b border-border bg-background px-sm pb-xs"
      style={{ paddingTop: insets.top + 4 }}
    >
      <IconButton label="Previous day" onPress={onPrevious} size="small">
        <ChevronLeft color={colors["muted-foreground"]} size={22} />
      </IconButton>

      <Pressable
        accessibilityHint="Opens a calendar to choose another day"
        accessibilityLabel={`${longDate(day)}, ${formatDuration(stats.scheduled)} planned, ${stats.done} of ${stats.count} done`}
        accessibilityRole="button"
        className="min-w-0 flex-1 justify-center"
        onPress={onPickDate}
        style={({ pressed }) => ({ minHeight: 44, opacity: pressed ? 0.7 : 1 })}
      >
        <Text accessibilityRole="header" numberOfLines={1} tone="foreground" variant="title">
          {mediumDate(day)}
        </Text>
        <Text numberOfLines={1} numeric tone="muted" variant="micro">
          {formatDuration(stats.scheduled)} planned · {stats.done}/{stats.count} done
        </Text>
      </Pressable>

      {isToday ? null : <Chip label="Today" onPress={onToday} />}

      <IconButton label="Next day" onPress={onNext} size="small">
        <ChevronRight color={colors["muted-foreground"]} size={22} />
      </IconButton>
      <IconButton disabled={!canUndo} label="Undo" onPress={onUndo} size="small">
        <Undo2 color={colors["muted-foreground"]} size={20} />
      </IconButton>
      <IconButton disabled={!canRedo} label="Redo" onPress={onRedo} size="small">
        <Redo2 color={colors["muted-foreground"]} size={20} />
      </IconButton>
    </View>
  );
}
