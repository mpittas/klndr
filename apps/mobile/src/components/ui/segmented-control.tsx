import { SegmentedControl as NativeSegmentedControl } from "@expo/ui/community/segmented-control";
import { View } from "react-native";

export type SegmentedControlOption<T extends string> = { label: string; value: T };

export type SegmentedControlProps<T extends string> = {
  options: readonly SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** The control's accessible name; the segments name themselves. */
  label: string;
  enabled?: boolean;
  className?: string;
};

/**
 * A short list of mutually exclusive choices, using the platform's own segmented control (iOS's
 * UISegmentedControl, the vendored Android/Material equivalent) rather than a row of buttons that
 * looks native but is not.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  enabled = true,
  className,
}: SegmentedControlProps<T>) {
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  return (
    <View accessibilityLabel={label} className={className}>
      <NativeSegmentedControl
        enabled={enabled}
        onValueChange={(next) => {
          // The native control reports the label; the value is ours to map back.
          const chosen = options.find((option) => option.label === next);
          if (chosen) onChange(chosen.value);
        }}
        selectedIndex={selectedIndex}
        values={options.map((option) => option.label)}
      />
    </View>
  );
}
