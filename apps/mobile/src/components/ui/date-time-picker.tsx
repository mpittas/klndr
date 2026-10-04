import { DateTimePicker as NativeDateTimePicker } from "@expo/ui/community/datetime-picker";
import { useState } from "react";
import { Platform, Pressable, View } from "react-native";

import { useThemeColors, useThemeScheme } from "@/theme/tokens";
import { Text } from "./text";

export type DateTimePickerProps = {
  /** The picker's label, and its accessible name. */
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  mode?: "date" | "time" | "datetime";
  minimumDate?: Date;
  maximumDate?: Date;
  /** Called when the Android dialog is dismissed. */
  onDismiss?: () => void;
  /** `inline` (iOS) keeps the calendar in the view; `spinner` is the wheel. */
  display?: "default" | "spinner" | "compact" | "inline";
  className?: string;
};

/**
 * A date or time, using the platform's picker — the iOS wheel and calendar, the Material dialog — with
 * the app's accent colour and the current scheme handed to it, so it does not arrive in the system's
 * default blue on a dark screen.
 */
export function DateTimePicker({
  label,
  value,
  onChange,
  mode = "time",
  minimumDate,
  maximumDate,
  onDismiss,
  display = "inline",
  className,
}: DateTimePickerProps) {
  const colors = useThemeColors();
  const scheme = useThemeScheme();
  const [open, setOpen] = useState(false);
  const android = Platform.OS === "android";
  const shownValue = mode === "time"
    ? value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : value.toLocaleDateString();

  return (
    <View className={["gap-xs", className].filter(Boolean).join(" ")}>
      <Text tone="muted" variant="caption">
        {label}
      </Text>

      {android ? (
        <Pressable
          accessibilityLabel={`${label}, ${shownValue}`}
          accessibilityRole="button"
          className="justify-center rounded-md border border-input bg-card px-sm"
          style={{ minHeight: 44 }}
          onPress={() => setOpen(true)}
        >
          <Text numeric>{shownValue}</Text>
        </Pressable>
      ) : null}

      {!android || open ? (
        <NativeDateTimePicker
          accentColor={colors.ring}
          display={display}
          maximumDate={maximumDate}
          minimumDate={minimumDate}
          mode={mode}
          onDismiss={() => {
            setOpen(false);
            onDismiss?.();
          }}
          onValueChange={(_event, date) => {
            setOpen(false);
            onChange(date);
          }}
          themeVariant={scheme}
          value={value}
        />
      ) : null}
    </View>
  );
}
