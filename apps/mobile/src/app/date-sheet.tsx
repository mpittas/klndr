import { isValidISODate, longDate, parseISODate, toISODate, todayISO } from "@klndr/core";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Card, DateTimePicker, SheetScreen } from "@/components/ui";

/** Choose a day to open: the Day tab shows whatever is picked. */
export default function DateSheet() {
  const router = useRouter();
  const params = useLocalSearchParams<{ day?: string }>();
  const current = isValidISODate(params.day) ? params.day : todayISO();

  const open = (day: string) => router.dismissTo({ pathname: "/", params: { day } });

  return (
    <SheetScreen gap={16} onClose={() => router.back()} subtitle={longDate(current)} title="Go to a day">
      <Card className="px-sm py-xs">
        <DateTimePicker
          bare
          display="inline"
          fill
          label="Date"
          mode="date"
          onChange={(date) => open(toISODate(date))}
          value={parseISODate(current)}
        />
      </Card>
      <Button label="Today" onPress={() => open(todayISO())} size="large" variant="surface" />
    </SheetScreen>
  );
}
