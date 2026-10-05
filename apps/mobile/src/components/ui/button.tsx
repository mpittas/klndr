import type { ThemeVariable } from "@klndr/tokens";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, type PressableProps } from "react-native";

import { useThemeColors } from "@/theme/tokens";
import { MIN_TOUCH_TARGET } from "./targets";
import { Text, type TextTone } from "./text";

/**
 * DESIGN.md's buttons: primary (the one action), secondary (a peer of it), ghost (a quiet action in a
 * header or a list) and destructive (delete). Every variant is at least 44 points tall.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "bg-primary border-transparent",
  secondary: "bg-secondary border-border",
  ghost: "bg-transparent border-transparent",
  destructive: "bg-destructive border-transparent",
};

const VARIANT_TONE: Record<ButtonVariant, TextTone> = {
  primary: "primary-foreground",
  secondary: "foreground",
  ghost: "foreground",
  destructive: "destructive-foreground",
};

/** The spinner is a colour prop, not a style, so it reads the theme as data. */
const VARIANT_SPINNER: Record<ButtonVariant, ThemeVariable> = {
  primary: "primary-foreground",
  secondary: "muted-foreground",
  ghost: "muted-foreground",
  destructive: "destructive-foreground",
};

export type ButtonProps = Omit<PressableProps, "children" | "style"> & {
  /** The button's text; it is also its accessible name. */
  label: string;
  variant?: ButtonVariant;
  icon?: ReactNode;
  /** Shows a spinner, refuses presses and tells assistive tech the button is busy. */
  loading?: boolean;
  className?: string;
  labelClassName?: string;
};

export function Button({
  label,
  variant = "primary",
  icon,
  loading = false,
  disabled,
  className,
  labelClassName,
  ...rest
}: ButtonProps) {
  const colors = useThemeColors();
  const isDisabled = disabled === true || loading;

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      className={[
        "flex-row items-center justify-center gap-sm rounded-md border px-md",
        VARIANT_CLASS[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={isDisabled}
      // Opacity is the whole press state: it is not motion, so it needs no reduced-motion variant.
      style={({ pressed }) => ({ minHeight: MIN_TOUCH_TARGET, opacity: isDisabled ? 0.5 : pressed ? 0.7 : 1 })}
      {...rest}
    >
      {loading ? <ActivityIndicator color={colors[VARIANT_SPINNER[variant]]} /> : icon}
      <Text className={labelClassName} tone={VARIANT_TONE[variant]}>
        {label}
      </Text>
    </Pressable>
  );
}
