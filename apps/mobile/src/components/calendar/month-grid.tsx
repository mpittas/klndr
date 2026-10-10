import { canonicalColor } from "@klndr/core";
import { PALETTE } from "@klndr/tokens";
import { memo } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";

import { nowColor } from "@/components/day/block-colors";
import { Card, Text } from "@/components/ui";
import { useThemeColors, useThemeScheme } from "@/theme/tokens";
import type { DayCell } from "./types";

/** The screen's side margin and the card's own padding: what the seven columns share the width with. */
const SCREEN_SIDE = 16;
const CARD_SIDE = 8;
const ROW_HEIGHT = 50;
const DISC = 34;
const MAX_DOTS = 3;

export type MonthGridProps = {
  days: DayCell[];
  /** The seven weekday names, in the order the rows run. */
  weekdays: string[];
  /** The day whose blocks are listed under the grid. */
  selected: string;
  /** A block's category colour (see `useCategoryColor`). */
  colorOf: (item: { category: string; color?: string }) => string;
  /** A tap on a day: choose it (a tap on the chosen day opens it). */
  onSelectDay: (day: string) => void;
  /** Long-press on a day: make a block on it. */
  onAddBlock: (day: string) => void;
};

/**
 * The month as a grid of days, the shape the phone's own Calendar and Todoist use: a number in a disc, and under it
 * a dot for each category planned that day. A tap chooses the day (its blocks are listed below), a tap on the chosen
 * day opens it, and holding one starts a block there. Today is in the now-line's red; days of the months either side
 * are faded.
 */
export const MonthGrid = memo(function MonthGrid({ days, weekdays, selected, colorOf, onSelectDay, onAddBlock }: MonthGridProps) {
  const colors = useThemeColors();
  const scheme = useThemeScheme();
  const red = nowColor(scheme);
  const { width } = useWindowDimensions();
  const cellWidth = (width - SCREEN_SIDE * 2 - CARD_SIDE * 2) / 7;

  const weeks: DayCell[][] = [];
  for (let at = 0; at < days.length; at += 7) weeks.push(days.slice(at, at + 7));

  return (
    <Card style={{ paddingHorizontal: CARD_SIDE, paddingBottom: 6 }}>
      <View className="flex-row" style={{ paddingTop: 10, paddingBottom: 4 }}>
        {weekdays.map((label) => (
          <View key={label} style={{ width: cellWidth, alignItems: "center" }}>
            <Text tone="muted" variant="micro" weight={600}>
              {label.slice(0, 3)}
            </Text>
          </View>
        ))}
      </View>

      {weeks.map((week) => (
        <View className="flex-row" key={week[0].iso}>
          {week.map((day) => {
            const isSelected = day.iso === selected;
            const disc = isSelected ? (day.isToday ? red : colors.primary) : "transparent";
            const ink = isSelected
              ? day.isToday
                ? "#ffffff"
                : colors["primary-foreground"]
              : day.isToday
                ? red
                : day.isPast || !day.inMonth
                  ? colors["muted-foreground"]
                  : colors.foreground;
            const dots: string[] = [];
            for (const task of day.tasks) {
              const fill = PALETTE[canonicalColor(colorOf(task))][scheme].swatch.background ?? colors.foreground;
              if (!dots.includes(fill)) dots.push(fill);
              if (dots.length === MAX_DOTS) break;
            }
            const allDone = day.count > 0 && day.done === day.count;

            return (
              <Pressable
                accessibilityActions={[{ name: "addBlock", label: "Add a block" }]}
                accessibilityHint={isSelected ? "Opens this day" : "Shows this day's blocks. Press and hold to add a block."}
                accessibilityLabel={`${day.label}${day.isToday ? ", today" : ""}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                delayLongPress={350}
                key={day.iso}
                onAccessibilityAction={(event) => {
                  if (event.nativeEvent.actionName === "addBlock") onAddBlock(day.iso);
                }}
                onLongPress={() => onAddBlock(day.iso)}
                onPress={() => onSelectDay(day.iso)}
                style={({ pressed }) => ({
                  width: cellWidth,
                  height: ROW_HEIGHT,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                  opacity: pressed ? 0.6 : day.inMonth ? 1 : 0.45,
                })}
              >
                <View
                  style={{
                    width: DISC,
                    height: DISC,
                    borderRadius: DISC / 2,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: disc,
                  }}
                >
                  <Text numeric style={{ color: ink }} variant="callout" weight={isSelected || day.isToday ? 700 : 500}>
                    {day.dayNumber}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 3, height: 5, opacity: allDone ? 0.45 : 1 }}>
                  {dots.map((fill) => (
                    <View key={fill} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: fill }} />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </Card>
  );
});
