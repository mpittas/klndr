import { TextInput, View, type TextInputProps } from "react-native";

import { useThemeColors } from "@/theme/tokens";
import { MIN_TOUCH_TARGET } from "./targets";
import { Text } from "./text";

export type TextFieldProps = Omit<TextInputProps, "style"> & {
  /** The field's label; it is also its accessible name. */
  label: string;
  /** A hint under the field. Replaced by `error` when there is one. */
  helper?: string;
  error?: string;
  className?: string;
};

/**
 * A labelled text field. The label is always visible — a placeholder is not a label, and it vanishes
 * as soon as someone types. Errors are announced as they appear.
 */
export function TextField({
  label,
  helper,
  error,
  className,
  editable = true,
  multiline = false,
  ...rest
}: TextFieldProps) {
  const colors = useThemeColors();

  return (
    <View className={["gap-xs", className].filter(Boolean).join(" ")}>
      <Text tone="muted" variant="caption">
        {label}
      </Text>

      <TextInput
        accessibilityHint={helper}
        accessibilityLabel={label}
        accessibilityState={{ disabled: !editable }}
        className={[
          "rounded-md border bg-card px-md py-sm text-foreground",
          error ? "border-destructive" : "border-input",
        ].join(" ")}
        editable={editable}
        multiline={multiline}
        placeholderTextColor={colors["muted-foreground"]}
        // 16 points, not the 14 of body text: DESIGN.md keeps fields at 16 on touch, and a smaller
        // field is genuinely harder to read while typing. Multiline fields get room to breathe.
        style={{ fontSize: 16, minHeight: multiline ? 96 : MIN_TOUCH_TARGET }}
        {...rest}
      />

      {error ? (
        // Announced, because the message can appear without the user having moved focus.
        <Text accessibilityLiveRegion="polite" tone="destructive" variant="caption">
          {error}
        </Text>
      ) : helper ? (
        <Text tone="muted" variant="caption">
          {helper}
        </Text>
      ) : null}
    </View>
  );
}
