import type { ReactNode } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import { useThemeColors } from "@/theme/tokens";
import { DateTimePicker } from "./date-time-picker";
import { FieldRow } from "./field-row";
import { Text } from "./text";

export type DateTimeRowProps = {
  label: string;
  /** The icon tile before the label. */
  leading?: ReactNode;
  mode: "date" | "time";
  value: Date;
  onChange: (date: Date) => void;
  /** Whether the picker is unfolded under the row (iOS); the form keeps one open at a time. */
  open: boolean;
  onToggle: () => void;
  /** The hairline under the row, for every row of a card but the last. */
  divider?: boolean;
};

const shown = (mode: DateTimeRowProps["mode"], value: Date) =>
  mode === "time"
    ? value.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : value.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short", year: "numeric" });

/**
 * A date or a time as one row of a form card, the way the phone's own Calendar edits an event: the value sits
 * in a grey pill, and touching it unfolds the picker (a calendar, or a wheel) under the row. The pill is plain
 * React Native, so it is as wide as its text on every phone, where the native compact pill left it to a native
 * view to size itself and was cut off at the card's edge. Android opens its own dialog from the same pill.
 */
export function DateTimeRow({ label, leading, mode, value, onChange, open, onToggle, divider = true }: DateTimeRowProps) {
  const colors = useThemeColors();

  if (Platform.OS === "android") {
    return (
      <FieldRow divider={divider} label={label} leading={leading}>
        <DateTimePicker bare label={label} mode={mode} onChange={onChange} value={value} />
      </FieldRow>
    );
  }

  return (
    <>
      <FieldRow divider={divider && !open} label={label} leading={leading}>
        <Pressable
          accessibilityHint={open ? "Closes the picker" : "Opens the picker"}
          accessibilityLabel={`${label}, ${shown(mode, value)}`}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          className="justify-center rounded-sm bg-muted px-sm"
          onPress={onToggle}
          style={({ pressed }) => ({ minHeight: 34, opacity: pressed ? 0.7 : 1 })}
        >
          <Text numeric style={open ? { color: colors.ring } : undefined} variant="callout" weight={open ? 600 : 400}>
            {shown(mode, value)}
          </Text>
        </Pressable>
      </FieldRow>
      {open ? (
        <View
          className="bg-card px-sm pb-sm"
          style={divider ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border } : undefined}
        >
          <DateTimePicker
            bare
            display={mode === "date" ? "inline" : "spinner"}
            fill
            label={label}
            mode={mode}
            onChange={(next) => {
              onChange(next);
              // A day is one touch on the calendar, so the picker folds away; a wheel is turned until it is right.
              if (mode === "date") onToggle();
            }}
            value={value}
          />
        </View>
      ) : null}
    </>
  );
}
