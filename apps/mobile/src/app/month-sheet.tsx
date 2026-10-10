import { MONTH_LABELS, getMonthIndex, getYear, isValidISODate, todayISO } from "@klndr/core";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { Button, Card, CircleButton, SheetScreen, Text } from "@/components/ui";
import { ChevronLeft, ChevronRight } from "@/icons";
import { useThemeColors } from "@/theme/tokens";

const pad = (value: number) => String(value + 1).padStart(2, "0");

/**
 * Choose a month and year to show on the Calendar (`?month=YYYY-MM-DD`), or an exact day to open in the Day tab,
 * as the web's date picker lets you. Picking a month goes straight back to the calendar on it.
 */
export default function MonthSheet() {
  const router = useRouter();
  const colors = useThemeColors();
  const params = useLocalSearchParams<{ month?: string }>();
  const today = todayISO();
  const shown = isValidISODate(params.month) ? params.month : today;
  const [year, setYear] = useState(getYear(shown));

  const go = (m: string) => router.dismissTo({ pathname: "/calendar", params: { m } });

  return (
    <SheetScreen gap={16} onClose={() => router.back()} title="Go to a month">
      <Card className="gap-sm p-sm">
        <View className="flex-row items-center justify-between px-xs" style={{ minHeight: 44 }}>
          <CircleButton label="Previous year" onPress={() => setYear((value) => value - 1)} size={34} variant="muted">
            <ChevronLeft color={colors.foreground} size={19} strokeWidth={2.4} />
          </CircleButton>
          <Text accessibilityLiveRegion="polite" numeric variant="headline">
            {year}
          </Text>
          <CircleButton label="Next year" onPress={() => setYear((value) => value + 1)} size={34} variant="muted">
            <ChevronRight color={colors.foreground} size={19} strokeWidth={2.4} />
          </CircleButton>
        </View>

        <View accessibilityRole="radiogroup" className="flex-row flex-wrap" style={{ rowGap: 6 }}>
          {MONTH_LABELS.map((label, index) => {
            const selected = year === getYear(shown) && index === getMonthIndex(shown);
            const current = year === getYear(today) && index === getMonthIndex(today);
            return (
              <View key={label} style={{ width: "33.333%", padding: 3 }}>
                <Pressable
                  accessibilityLabel={`${label} ${year}${current ? ", this month" : ""}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  className={["items-center justify-center rounded-md", selected ? "bg-primary" : current ? "bg-muted" : ""].join(" ")}
                  onPress={() => go(`${year}-${pad(index)}`)}
                  style={({ pressed }) => ({ minHeight: 48, opacity: pressed ? 0.6 : 1 })}
                >
                  <Text tone={selected ? "primary-foreground" : "foreground"} variant="callout" weight={selected || current ? 700 : 500}>
                    {label.slice(0, 3)}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </Card>

      <View className="flex-row gap-sm">
        <Button className="flex-1" label="This month" onPress={() => go(today.slice(0, 7))} size="large" variant="surface" />
        <Button
          className="flex-1"
          label="Exact date…"
          onPress={() => router.replace({ pathname: "/date-sheet", params: { day: shown } })}
          size="large"
          variant="surface"
        />
      </View>
    </SheetScreen>
  );
}
