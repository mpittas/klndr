import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type PressableProps } from "react-native";

import { ChevronRight } from "@/icons";
import { useThemeColors } from "@/theme/tokens";
import { Text } from "./text";

/** A row's height: a little over the 44-point minimum, the phone's own list rhythm. */
const ROW_HEIGHT = 56;
const SIDE = 16;
/** The gap between a row's leading tile and its label. */
const GAP = 12;

export type ListRowProps = Omit<PressableProps, "children" | "style"> & {
  label: string;
  /** A second, quieter line under the label. */
  description?: string;
  /** An icon tile or colour dot at the start of the row. */
  leading?: ReactNode;
  /** How wide `leading` is, so the divider starts under the label as the phone's lists do. */
  leadingWidth?: number;
  /** Content at the end of the row, e.g. a Switch, a picker, a button. */
  trailing?: ReactNode;
  /** Right-aligned value text, as Settings uses for the current choice. */
  value?: string;
  /** The disclosure chevron; on by default when the row is pressable. */
  chevron?: boolean;
  /** The hairline under the row; turn it off for the last row of a group. */
  divider?: boolean;
  /** A row that destroys or leaves: its label in the destructive colour. */
  destructive?: boolean;
  className?: string;
};

/**
 * One line in a grouped card, the shape Settings, the Library and the sheets share: an optional tile, the
 * label (and a description), an optional value or control, and a chevron when it leads somewhere. The hairline
 * between rows starts where the text starts.
 */
export function ListRow({
  label,
  description,
  leading,
  leadingWidth = 32,
  trailing,
  value,
  chevron,
  divider = true,
  destructive = false,
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
      <View className="min-w-0 flex-1 py-sm" style={{ gap: 2 }}>
        <Text tone={destructive ? "destructive" : disabled ? "muted" : "foreground"} variant="row">
          {label}
        </Text>
        {description ? (
          <Text tone="muted" variant="caption">
            {description}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text numeric numberOfLines={1} style={{ maxWidth: "45%" }} tone="muted" variant="row">
          {value}
        </Text>
      ) : null}
      {trailing}
      {showsChevron ? <ChevronRight color={colors["muted-foreground"]} size={18} style={{ marginRight: -4, opacity: 0.6 }} /> : null}
      {divider ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            left: leading ? SIDE + leadingWidth + GAP : SIDE,
            height: StyleSheet.hairlineWidth,
            backgroundColor: colors.border,
          }}
        />
      ) : null}
    </>
  );

  const classes = ["flex-row items-center bg-card", className].filter(Boolean).join(" ");
  const layout = { minHeight: ROW_HEIGHT, paddingHorizontal: SIDE, gap: GAP };

  if (!onPress) {
    return (
      <View className={classes} style={layout}>
        {body}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={description ? `${label}, ${description}` : label}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled === true }}
      className={classes}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({ ...layout, opacity: disabled ? 0.5 : 1, backgroundColor: pressed ? colors.muted : undefined })}
      {...rest}
    >
      {body}
    </Pressable>
  );
}
