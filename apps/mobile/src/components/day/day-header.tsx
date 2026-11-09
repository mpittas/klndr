import { MONTH_LABELS, formatDuration, getMonthIndex, getYear, longDate, parseISODate, type ScheduledTask } from "@klndr/core";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chip, CircleButton, Text } from "@/components/ui";
import { ChevronDown, Redo2, Undo2 } from "@/icons";
import { useThemeColors } from "@/theme/tokens";

import { WeekStrip } from "./week-strip";

export type DayHeaderProps = {
  day: string;
  today: string;
  /** Minutes scheduled, blocks, blocks done. */
  stats: { scheduled: number; count: number; done: number };
  mondayFirst: boolean;
  /** The blocks of the week on screen, for the strip's dots. */
  weekTasks: ScheduledTask[];
  colorOf: (task: ScheduledTask) => string;
  /** A day was chosen in the strip. */
  onSelectDay: (day: string) => void;
  onToday: () => void;
  /** The month was tapped: choose any date. */
  onPickDate: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * The top of the Day tab: the month (tap it to choose any date), a way back to today, undo and redo for what was
 * done to this day's timeline, the week as a strip of days, and a line of how the day is planned.
 */
export function DayHeader(props: DayHeaderProps) {
  const { day, today, stats, mondayFirst, weekTasks, colorOf, onSelectDay, onToday, onPickDate, canUndo, canRedo, onUndo, onRedo } = props;
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const isToday = day === today;
  const sameYear = getYear(day) === getYear(today);

  return (
    <View className="bg-background" style={{ paddingTop: insets.top + 2 }}>
      <View className="flex-row items-center gap-sm pl-md pr-sm" style={{ minHeight: 48 }}>
        <Pressable
          accessibilityHint="Opens a calendar to choose another day"
          accessibilityLabel={`${MONTH_LABELS[getMonthIndex(day)]} ${getYear(day)}`}
          accessibilityRole="button"
          className="min-w-0 flex-1 flex-row items-center gap-xs"
          onPress={onPickDate}
          style={({ pressed }) => ({ minHeight: 44, opacity: pressed ? 0.6 : 1 })}
        >
          <Text accessibilityRole="header" numberOfLines={1} style={{ fontSize: 26, lineHeight: 32, letterSpacing: -0.6 }} weight={700}>
            {MONTH_LABELS[getMonthIndex(day)]}
            {sameYear ? null : <Text style={{ fontSize: 26, lineHeight: 32 }} tone="muted" weight={700}>{` ${getYear(day)}`}</Text>}
          </Text>
          <ChevronDown color={colors["muted-foreground"]} size={20} strokeWidth={2.4} />
        </Pressable>

        {isToday ? null : <Chip compact label="Today" onPress={onToday} />}
        <CircleButton disabled={!canUndo} label="Undo" onPress={onUndo} size={34} variant="muted">
          <Undo2 color={colors.foreground} size={17} strokeWidth={2.2} />
        </CircleButton>
        <CircleButton disabled={!canRedo} label="Redo" onPress={onRedo} size={34} variant="muted">
          <Redo2 color={colors.foreground} size={17} strokeWidth={2.2} />
        </CircleButton>
      </View>

      <WeekStrip colorOf={colorOf} day={day} mondayFirst={mondayFirst} onSelect={onSelectDay} tasks={weekTasks} today={today} />

      <View
        accessible
        accessibilityLabel={`${longDate(day)}, ${formatDuration(stats.scheduled)} planned, ${stats.done} of ${stats.count} blocks done`}
        className="flex-row items-baseline justify-between gap-sm px-md pb-sm pt-xs"
      >
        <Text numberOfLines={1} variant="callout" weight={600}>
          {WEEKDAYS[parseISODate(day).getDay()]}
          <Text tone="muted" variant="callout">
            {isToday ? "  Today" : ""}
          </Text>
        </Text>
        <Text numberOfLines={1} numeric tone="muted" variant="caption">
          {stats.count === 0
            ? "Nothing planned"
            : `${formatDuration(stats.scheduled)} planned · ${stats.done}/${stats.count} done`}
        </Text>
      </View>
    </View>
  );
}
