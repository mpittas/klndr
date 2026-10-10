import { Host, Picker as NativePicker } from "@expo/ui";
import { View } from "react-native";

import { MIN_TOUCH_TARGET } from "./targets";
import { Text } from "./text";

export type PickerOption<T extends string | number> = { label: string; value: T };

export type PickerProps<T extends string | number> = {
  options: readonly PickerOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** The picker's label, and its accessible name. */
  label: string;
  /** Only the control, for the end of a card row whose own text is the label; `label` is then only spoken. */
  bare?: boolean;
  /** `menu` opens a popup (the default); `wheel` is the always-visible rotor. */
  appearance?: "menu" | "wheel";
  enabled?: boolean;
  className?: string;
};

/**
 * A single choice from a short list, using the platform's own control: a SwiftUI menu on iOS, a
 * Material dropdown on Android. Native menus get the right keyboard, VoiceOver and accessibility
 * behaviour for free, which a hand-rolled list of buttons does not.
 *
 * It has to live inside a `Host` — that is the bridge that hands the subtree to SwiftUI or Compose.
 */
export function Picker<T extends string | number>({
  options,
  value,
  onChange,
  label,
  bare = false,
  appearance = "menu",
  enabled = true,
  className,
}: PickerProps<T>) {
  const control = (
    <Host accessibilityLabel={label} matchContents style={{ minHeight: MIN_TOUCH_TARGET }}>
      <NativePicker appearance={appearance} enabled={enabled} onValueChange={onChange} selectedValue={value}>
        {options.map((option) => (
          <NativePicker.Item key={String(option.value)} label={option.label} value={option.value} />
        ))}
      </NativePicker>
    </Host>
  );

  if (bare) return <View className={className}>{control}</View>;

  return (
    <View className={["gap-xs", className].filter(Boolean).join(" ")}>
      <Text className="px-xs" tone="muted" variant="caption" weight={500}>
        {label}
      </Text>
      {control}
    </View>
  );
}
