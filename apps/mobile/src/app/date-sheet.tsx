import { isValidISODate, parseISODate, toISODate, todayISO } from "@klndr/core";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";

import { Button, DateTimePicker, Text } from "@/components/ui";

/** Choose a day to open: the Day tab shows whatever is picked. */
export default function DateSheet() {
  const router = useRouter();
  const params = useLocalSearchParams<{ day?: string }>();
  const current = isValidISODate(params.day) ? params.day : todayISO();

  const open = (day: string) => router.dismissTo({ pathname: "/", params: { day } });

  return (
    <View className="flex-1 gap-md bg-background px-md pt-lg">
      <Text accessibilityRole="header" variant="title">
        Go to a day
      </Text>
      <DateTimePicker
        display="inline"
        label="Date"
        mode="date"
        onChange={(date) => open(toISODate(date))}
        value={parseISODate(current)}
      />
      <Button label="Today" onPress={() => open(todayISO())} variant="secondary" />
    </View>
  );
}
