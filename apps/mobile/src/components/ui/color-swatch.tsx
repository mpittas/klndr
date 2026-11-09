import { COLOR_LABELS, type ColorKey } from "@klndr/core";
import { PALETTE } from "@klndr/tokens";
import { Pressable, View, type PressableProps } from "react-native";

import { useThemeScheme } from "@/theme/tokens";
import { MIN_TOUCH_TARGET } from "./targets";

export type ColorSwatchProps = Omit<PressableProps, "children" | "style"> & {
  color: ColorKey;
  selected?: boolean;
  /** `small` for a dense grid, `regular` for a primary choice. */
  size?: "small" | "regular";
  className?: string;
};

/**
 * A category colour, drawn from the resolved palette (`@klndr/tokens`) so the phone paints exactly
 * what the web app paints. The accessible name is the colour's own name from `@klndr/core`, which is
 * what a screen reader should say — "indigo", not a hex value.
 */
export function ColorSwatch({
  color,
  selected = false,
  size = "regular",
  disabled,
  className,
  ...rest
}: ColorSwatchProps) {
  const fill = PALETTE[color][useThemeScheme()].swatch.background;
  const side = size === "small" ? 28 : 36;

  return (
    <Pressable
      accessibilityLabel={COLOR_LABELS[color]}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled === true, selected }}
      className={["items-center justify-center", className].filter(Boolean).join(" ")}
      disabled={disabled}
      // The hit area stays 44 even when the dot is small.
      style={({ pressed }) => ({ height: MIN_TOUCH_TARGET, opacity: disabled ? 0.4 : pressed ? 0.7 : 1, width: MIN_TOUCH_TARGET })}
      {...rest}
    >
      <View
        style={{
          borderColor: selected ? fill : "transparent",
          borderRadius: 9999,
          borderWidth: 2,
          height: side,
          padding: 2,
          width: side,
        }}
      >
        <View style={{ backgroundColor: fill, borderRadius: 9999, flex: 1 }} />
      </View>
    </Pressable>
  );
}
