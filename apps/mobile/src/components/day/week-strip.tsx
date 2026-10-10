import { WEEKDAY_LABELS, addDaysISO, canonicalColor, longDate, parseISODate, type ScheduledTask } from "@klndr/core";
import { PALETTE } from "@klndr/tokens";
import { memo, useMemo } from "react";
import { Pressable, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";

import { Text } from "@/components/ui";
import { useThemeColors, useThemeScheme } from "@/theme/tokens";

import { nowColor } from "./block-colors";

/** The seven days of the week `day` is in, starting on Sunday or Monday (the profile's choice). */
export function weekOf(day: string, mondayFirst: boolean): string[] {
  const weekday = parseISODate(day).getDay();
  const start = addDaysISO(day, -(mondayFirst ? (weekday + 6) % 7 : weekday));
  return Array.from({ length: 7 }, (_, index) => addDaysISO(start, index));
}

/** How many category dots a day shows under its number, at most. */
const MAX_DOTS = 3;
const DISC = 36;

export type WeekStripProps = {
  /** The day on screen. */
  day: string;
  today: string;
  mondayFirst: boolean;
  /** The week's blocks, for the dots under each day. */
  tasks: ScheduledTask[];
  colorOf: (task: ScheduledTask) => string;
  onSelect: (day: string) => void;
};

/**
 * The week the day on screen belongs to, as a strip of seven days (the shape Structured, Amie and the phone's own
 * Calendar share): tap a day to open it, swipe the strip for the week before or after. The day on screen is a
 * filled disc, today is in the now-line's red, and the dots under a day are the colours of what is planned on it.
 */
export const WeekStrip = memo(function WeekStrip({ day, today, mondayFirst, tasks, colorOf, onSelect }: WeekStripProps) {
  const colors = useThemeColors();
  const scheme = useThemeScheme();
  const red = nowColor(scheme);
  const days = useMemo(() => weekOf(day, mondayFirst), [day, mondayFirst]);

  const dotsByDay = useMemo(() => {
    const map = new Map<string, { colors: string[]; count: number }>();
    for (const task of [...tasks].sort((a, b) => a.startMinutes - b.startMinutes)) {
      const entry = map.get(task.day) ?? { colors: [], count: 0 };
      entry.count += 1;
      const fill = PALETTE[canonicalColor(colorOf(task))][scheme].swatch.background ?? colors.foreground;
      if (!entry.colors.includes(fill) && entry.colors.length < MAX_DOTS) entry.colors.push(fill);
      map.set(task.day, entry);
    }
    return map;
  }, [tasks, colorOf, scheme, colors.foreground]);

  const swipe = Gesture.Pan()
    .activeOffsetX([-16, 16])
    .failOffsetY([-12, 12])
    .onEnd((event) => {
      if (Math.abs(event.translationX) < 40 && Math.abs(event.velocityX) < 400) return;
      scheduleOnRN(onSelect, addDaysISO(day, event.translationX < 0 ? 7 : -7));
    });

  return (
    <GestureDetector gesture={swipe}>
      <View className="flex-row px-sm">
        {days.map((iso) => {
          const date = parseISODate(iso);
          const selected = iso === day;
          const isToday = iso === today;
          const dots = dotsByDay.get(iso);
          const disc = selected ? (isToday ? red : colors.primary) : "transparent";
          const ink = selected ? (isToday ? "#ffffff" : colors["primary-foreground"]) : isToday ? red : iso < today ? colors["muted-foreground"] : colors.foreground;

          return (
            <Pressable
              accessibilityActions={[
                { name: "previousWeek", label: "Previous week" },
                { name: "nextWeek", label: "Next week" },
              ]}
              accessibilityLabel={`${longDate(iso)}${isToday ? ", today" : ""}${dots ? `, ${dots.count} ${dots.count === 1 ? "block" : "blocks"}` : ""}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={iso}
              onAccessibilityAction={(event) => {
                if (event.nativeEvent.actionName === "previousWeek") onSelect(addDaysISO(day, -7));
                if (event.nativeEvent.actionName === "nextWeek") onSelect(addDaysISO(day, 7));
              }}
              onPress={() => onSelect(iso)}
              style={({ pressed }) => ({ flex: 1, alignItems: "center", gap: 3, paddingVertical: 4, opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={{ color: selected || isToday ? (isToday ? red : colors.foreground) : colors["muted-foreground"] }} variant="micro" weight={selected ? 700 : 500}>
                {WEEKDAY_LABELS[date.getDay()]}
              </Text>
              <View style={{ width: DISC, height: DISC, borderRadius: DISC / 2, backgroundColor: disc, alignItems: "center", justifyContent: "center" }}>
                <Text numeric style={{ color: ink }} variant="callout" weight={selected || isToday ? 700 : 500}>
                  {date.getDate()}
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 3, height: 5 }}>
                {dots?.colors.map((fill) => (
                  <View key={fill} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: fill }} />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>
    </GestureDetector>
  );
});
