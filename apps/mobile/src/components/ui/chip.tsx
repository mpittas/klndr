import type { ReactNode } from "react";
import { Pressable, type PressableProps } from "react-native";

import { MIN_TAP_TARGET } from "./targets";
import { Text } from "./text";

/**
 * A small pill with a 40-point tap target (DESIGN.md): filters, a quick choice, "Today". Selection is a fill
 * and a change of text colour together, never colour alone, so it survives dark mode.
 */
export type ChipProps = Omit<PressableProps, "children" | "style"> & {
  label: string;
  selected?: boolean;
  /** A colour dot or a small icon in front of the label. */
  leading?: ReactNode;
  /** `compact` is drawn 32 points tall (its tap area is still 40), for a header. */
  compact?: boolean;
  className?: string;
};

export function Chip({ label, selected = false, leading, compact = false, disabled, className, ...rest }: ChipProps) {
  const height = compact ? 32 : 36;
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled === true, selected }}
      className={[
        "flex-row items-center gap-xs rounded-full px-md",
        selected ? "bg-primary" : "bg-muted",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled}
      hitSlop={(MIN_TAP_TARGET - height) / 2}
      style={({ pressed }) => ({ minHeight: height, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 })}
      {...rest}
    >
      {leading}
      <Text tone={selected ? "primary-foreground" : "foreground"} variant="caption" weight={600}>
        {label}
      </Text>
    </Pressable>
  );
}
