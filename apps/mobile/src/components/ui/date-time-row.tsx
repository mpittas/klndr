import type { ReactNode } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import { useThemeColors } from "@/theme/tokens";
import { DateTimePicker } from "./date-time-picker";
import { FieldRow } from "./field-row";
import { Text } from "./text";

/** One value on a row: a date or a time, shown as a pill and edited in the picker that unfolds under the row. */
export type DateTimeField = {
  /** Names the field among its row's, and says which one is unfolded. */
  id: string;
  /** Spoken with the value: "Start date". */
  label: string;
  mode: "date" | "time";
  value: Date;
  onChange: (date: Date) => void;
};

export type DateTimeRowProps = {
  /** The row's own label: "Starts", "Ends". */
  label: string;
  /** Its pills, in order: a date and a time on one row, as the phone's Calendar has them. */
  fields: DateTimeField[];
  /** The `id` of the field unfolded now, if it is one of this row's; a form keeps one open at a time. */
  open: string | null;
  onOpenChange: (id: string | null) => void;
  leading?: ReactNode;
  /** The hairline under the row, for every row of a card but the last. */
  divider?: boolean;
};

const shown = (mode: DateTimeField["mode"], value: Date) =>
  mode === "time"
    ? value.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : value.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });

/**
 * A date and a time as one row of a form card, the way the phone's own Calendar edits an event: the label on the
 * left and the values in grey pills on the right, and touching one unfolds its picker (a calendar, or a wheel) under
 * the row. The pills are plain React Native, so each is as wide as its text on every phone; the native compact
 * pill left sizing to a native view and was cut off at the card's edge. Android opens its own dialog from the pill.
 */
export function DateTimeRow({ label, fields, open, onOpenChange, leading, divider = true }: DateTimeRowProps) {
  const colors = useThemeColors();
  const unfolded = fields.find((field) => field.id === open);

  if (Platform.OS === "android") {
    return (
      <FieldRow divider={divider} label={label} leading={leading}>
        <View className="flex-row items-center gap-sm">
          {fields.map((field) => (
            <DateTimePicker bare key={field.id} label={field.label} mode={field.mode} onChange={field.onChange} value={field.value} />
          ))}
        </View>
      </FieldRow>
    );
  }

  return (
    <>
      <FieldRow divider={divider && !unfolded} label={label} leading={leading}>
        <View className="flex-row items-center gap-sm">
          {fields.map((field) => {
            const active = field.id === open;
            return (
              <Pressable
                accessibilityHint={active ? "Closes the picker" : "Opens the picker"}
                accessibilityLabel={`${field.label}, ${shown(field.mode, field.value)}`}
                accessibilityRole="button"
                accessibilityState={{ expanded: active }}
                className="justify-center rounded-md bg-muted px-sm"
                key={field.id}
                onPress={() => onOpenChange(active ? null : field.id)}
                style={({ pressed }) => ({ minHeight: 36, opacity: pressed ? 0.7 : 1 })}
              >
                <Text numeric style={active ? { color: colors.ring } : undefined} variant="row" weight={active ? 600 : 400}>
                  {shown(field.mode, field.value)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </FieldRow>
      {unfolded ? (
        <View
          className="bg-card px-sm pb-sm"
          style={divider ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border } : undefined}
        >
          <DateTimePicker
            bare
            display={unfolded.mode === "date" ? "inline" : "spinner"}
            fill
            label={unfolded.label}
            mode={unfolded.mode}
            onChange={(next) => {
              unfolded.onChange(next);
              // A day is one touch on the calendar, so the picker folds away; a wheel is turned until it is right.
              if (unfolded.mode === "date") onOpenChange(null);
            }}
            value={unfolded.value}
          />
        </View>
      ) : null}
    </>
  );
}
