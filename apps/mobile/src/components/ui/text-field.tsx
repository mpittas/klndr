import type { Ref } from "react";
import { TextInput, View, type TextInputProps } from "react-native";

import { FONT_FOR_WEIGHT } from "@/fonts";
import { useThemeColors } from "@/theme/tokens";
import { MIN_TOUCH_TARGET } from "./targets";
import { Text } from "./text";

export type TextFieldProps = Omit<TextInputProps, "style"> & {
  /** The field's label; it is also its accessible name. */
  label: string;
  /** A hint under the field. Replaced by `error` when there is one. */
  helper?: string;
  error?: string;
  /**
   * `filled` is a labelled field on its own (a grey well under a label). `bare` is the field inside a card
   * row, with no box at all: the row is the box, and `label` is only spoken.
   */
  appearance?: "filled" | "bare";
  /** Larger type, for the one field a sheet is about (a block's or an activity's name). */
  prominent?: boolean;
  /** The underlying input, for a control elsewhere that moves focus to it. */
  inputRef?: Ref<TextInput>;
  className?: string;
};

/**
 * A text field. A filled field's label is always visible — a placeholder is not a label, and it vanishes as
 * soon as someone types. Errors are announced as they appear.
 */
export function TextField({
  label,
  helper,
  error,
  appearance = "filled",
  prominent = false,
  inputRef,
  className,
  editable = true,
  multiline = false,
  ...rest
}: TextFieldProps) {
  const colors = useThemeColors();
  const bare = appearance === "bare";

  const input = (
    <TextInput
      ref={inputRef}
      accessibilityHint={helper}
      accessibilityLabel={label}
      accessibilityState={{ disabled: !editable }}
      className={[
        "text-foreground",
        bare ? "" : "rounded-md bg-muted px-md",
        bare ? "" : error ? "border border-destructive" : "",
      ].join(" ")}
      editable={editable}
      multiline={multiline}
      placeholderTextColor={colors["muted-foreground"]}
      // 16 points at least: DESIGN.md keeps fields at 16 on touch, and a smaller field is genuinely harder to
      // read while typing. Multiline fields get room to breathe.
      style={{
        fontSize: prominent ? 20 : 16,
        fontFamily: FONT_FOR_WEIGHT[prominent ? 600 : 400],
        letterSpacing: prominent ? -0.3 : 0,
        minHeight: multiline ? 96 : MIN_TOUCH_TARGET,
        paddingVertical: multiline ? 12 : 0,
        textAlignVertical: multiline ? "top" : "center",
        opacity: editable ? 1 : 0.6,
      }}
      {...rest}
    />
  );

  if (bare) return <View className={className}>{input}</View>;

  return (
    <View className={["gap-xs", className].filter(Boolean).join(" ")}>
      <Text className="px-xs" tone="muted" variant="caption" weight={500}>
        {label}
      </Text>

      {input}

      {error ? (
        // Announced, because the message can appear without the user having moved focus.
        <Text accessibilityLiveRegion="polite" className="px-xs" tone="destructive" variant="caption">
          {error}
        </Text>
      ) : helper ? (
        <Text className="px-xs" tone="muted" variant="caption">
          {helper}
        </Text>
      ) : null}
    </View>
  );
}
