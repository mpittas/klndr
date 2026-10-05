import type { ReactNode } from "react";
import { Pressable, View, type PressableProps } from "react-native";

import { ChevronRight } from "@/icons";
import { useThemeColors } from "@/theme/tokens";
import { MIN_TOUCH_TARGET } from "./targets";
import { Text } from "./text";

export type ListRowProps = Omit<PressableProps, "children" | "style"> & {
  label: string;
  /** A second, quieter line under the label. */
  description?: string;
  /** An icon or colour dot at the start of the row. */
  leading?: ReactNode;
  /** Content at the end of the row, e.g. a Switch. */
  trailing?: ReactNode;
  /** Right-aligned value text, as Settings uses for the current choice. */
  value?: string;
  /** The disclosure chevron; on by default when the row is pressable. */
  chevron?: boolean;
  /** The hairline under the row; turn it off for the last row of a group. */
  divider?: boolean;
  className?: string;
};

/**
 * One line in a grouped list, the shape Settings and the Library use: label, optional description,
 * optional value, optional controls, and a chevron when it leads somewhere.
 */
export function ListRow({
  label,
  description,
  leading,
  trailing,
  value,
  chevron,
  divider = true,
  disabled,
  className,
  onPress,
  ...rest
}: ListRowProps) {
  const colors = useThemeColors();
  const showsChevron = chevron ?? onPress !== undefined;

  const body = (
    <>
      {leading}
      <View className="flex-1 gap-xs">
        <Text tone={disabled ? "muted" : "foreground"}>{label}</Text>
        {description ? (
          <Text tone="muted" variant="caption">
            {description}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text numeric tone="muted" variant="caption">
          {value}
        </Text>
      ) : null}
      {trailing}
      {showsChevron ? <ChevronRight color={colors["muted-foreground"]} size={18} /> : null}
    </>
  );

  const classes = [
    "flex-row items-center gap-md bg-card px-md",
    divider ? "border-b border-border" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (!onPress) {
    return (
      <View className={classes} style={{ minHeight: MIN_TOUCH_TARGET }}>
        {body}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled === true }}
      className={classes}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({ minHeight: MIN_TOUCH_TARGET, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 })}
      {...rest}
    >
      {body}
    </Pressable>
  );
}
