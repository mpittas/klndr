import { Switch as NativeSwitch, View, type SwitchProps as NativeSwitchProps } from "react-native";

import { Text } from "./text";

export type SwitchProps = Omit<NativeSwitchProps, "trackColor" | "thumbColor" | "ios_backgroundColor"> & {
  /** The setting's name; it is also the switch's accessible label. */
  label: string;
  helper?: string;
  /** Only the control, for the end of a card row whose own text is the label; `label` is then only spoken. */
  bare?: boolean;
};

/**
 * A labelled switch. The colours come from the theme through Uniwind's class-name props, so the
 * control matches the app in both themes instead of keeping the platform's default tint.
 */
export function Switch({ label, helper, bare = false, ...rest }: SwitchProps) {
  const control = (
    <NativeSwitch
      accessibilityHint={helper}
      accessibilityLabel={label}
      accessibilityRole="switch"
      thumbColorClassName="bg-background"
      trackColorOffClassName="bg-input"
      trackColorOnClassName="bg-primary"
      {...rest}
    />
  );

  if (bare) return control;

  return (
    <View className="flex-row items-center justify-between gap-md">
      <View className="flex-1" style={{ gap: 2 }}>
        <Text variant="callout">{label}</Text>
        {helper ? (
          <Text tone="muted" variant="caption">
            {helper}
          </Text>
        ) : null}
      </View>
      {control}
    </View>
  );
}
