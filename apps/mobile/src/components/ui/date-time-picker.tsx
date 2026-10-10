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
  /** Only the control, for the end of a card row whose own text is the label; `label` is then only spoken. */
  bare?: boolean;
  /**
   * The picker takes the whole width it is given, which the calendar and the wheel need. Without it the native
   * view is as wide as its content, which a compact pill is and a calendar is not.
   */
  fill?: boolean;
  className?: string;
};

/**
 * A date or time, using the platform's picker — the iOS compact pill, wheel and calendar, the Material dialog
 * — with the app's accent colour and the current scheme handed to it, so it does not arrive in the system's
 * default blue on a dark screen. On Android, where the picker is a dialog, the value is shown as the same
 * grey pill iOS draws, and a tap opens it.
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
  bare = false,
  fill = false,
  className,
}: DateTimePickerProps) {
  const colors = useThemeColors();
  const scheme = useThemeScheme();
  const [open, setOpen] = useState(false);
  const android = Platform.OS === "android";
  const shownValue =
    mode === "time"
      ? value.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      : value.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });

  const control = (
    <>
      {android ? (
        <Pressable
          accessibilityLabel={`${label}, ${shownValue}`}
          accessibilityRole="button"
          className="justify-center rounded-sm bg-muted px-sm"
          onPress={() => setOpen(true)}
          style={({ pressed }) => ({ minHeight: 34, opacity: pressed ? 0.7 : 1 })}
        >
          <Text numeric variant="callout">
            {shownValue}
          </Text>
        </Pressable>
      ) : null}

      {!android || open ? (
        <NativeDateTimePicker
          accentColor={colors.ring}
          display={display}
          maximumDate={maximumDate}
          minimumDate={minimumDate}
          mode={mode}
          style={fill ? { width: "100%" } : undefined}
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
    </>
  );

  if (bare) return <View className={[fill ? "" : "items-end", className].filter(Boolean).join(" ")}>{control}</View>;

  return (
    <View className={["gap-xs", className].filter(Boolean).join(" ")}>
      <Text className="px-xs" tone="muted" variant="caption" weight={500}>
        {label}
      </Text>
      {control}
    </View>
  );
}
