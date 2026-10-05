import type { ReactNode } from "react";
import { Pressable, type PressableProps } from "react-native";

import { MIN_TAP_TARGET } from "./targets";
import { Text } from "./text";

/**
 * A small pill: 6-point corners and a 40-point tap target (DESIGN.md). Used for filters, emoji
 * recents and the category picker's "new" affordance.
 */
export type ChipProps = Omit<PressableProps, "children" | "style"> & {
  label: string;
  selected?: boolean;
  /** A colour dot or a small icon in front of the label. */
  leading?: ReactNode;
  className?: string;
};

export function Chip({ label, selected = false, leading, disabled, className, ...rest }: ChipProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled === true, selected }}
      className={[
        "flex-row items-center gap-xs rounded-sm border px-sm",
        // Selection is a fill and a border, never colour alone: it has to survive dark mode.
        selected ? "bg-accent border-ring" : "bg-card border-border",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled}
      style={({ pressed }) => ({ minHeight: MIN_TAP_TARGET, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 })}
      {...rest}
    >
      {leading}
      <Text tone={selected ? "foreground" : "muted"} variant="caption">
        {label}
      </Text>
    </Pressable>
  );
}
