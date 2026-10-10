import type { ThemeVariable } from "@klndr/tokens";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, type PressableProps } from "react-native";

import { useThemeColors } from "@/theme/tokens";
import { MIN_TOUCH_TARGET } from "./targets";
import { Text, type TextTone } from "./text";

/**
 * DESIGN.md's buttons: primary (the one action), secondary (a peer of it), ghost (a quiet action in a
 * header or a list) and destructive (delete). `surface` is secondary on the grey canvas, where a grey button would
 * not show: a white one. Every variant is at least 44 points tall.
 */
export type ButtonVariant = "primary" | "secondary" | "surface" | "ghost" | "destructive";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "bg-primary",
  secondary: "bg-muted",
  surface: "bg-card",
  ghost: "bg-transparent",
  destructive: "bg-destructive",
};

const VARIANT_TONE: Record<ButtonVariant, TextTone> = {
  primary: "primary-foreground",
  secondary: "foreground",
  surface: "foreground",
  ghost: "foreground",
  destructive: "destructive-foreground",
};

/** The spinner is a colour prop, not a style, so it reads the theme as data. */
const VARIANT_SPINNER: Record<ButtonVariant, ThemeVariable> = {
  primary: "primary-foreground",
  secondary: "muted-foreground",
  surface: "muted-foreground",
  ghost: "muted-foreground",
  destructive: "destructive-foreground",
};

export type ButtonProps = Omit<PressableProps, "children" | "style"> & {
  /** The button's text; it is also its accessible name. */
  label: string;
  variant?: ButtonVariant;
  /** `large` is a sheet's or a form's main action: taller, and set in a larger face. */
  size?: "regular" | "large";
  icon?: ReactNode;
  /** Shows a spinner, refuses presses and tells assistive tech the button is busy. */
  loading?: boolean;
  className?: string;
  labelClassName?: string;
};

export function Button({
  label,
  variant = "primary",
  size = "regular",
  icon,
  loading = false,
  disabled,
  className,
  labelClassName,
  ...rest
}: ButtonProps) {
  const colors = useThemeColors();
  const isDisabled = disabled === true || loading;
  const large = size === "large";

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      className={[
        "flex-row items-center justify-center gap-sm px-md",
        large ? "rounded-lg" : "rounded-md",
        VARIANT_CLASS[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={isDisabled}
      // Opacity is the whole press state: it is not motion, so it needs no reduced-motion variant.
      style={({ pressed }) => ({
        minHeight: large ? 50 : MIN_TOUCH_TARGET,
        opacity: isDisabled ? 0.45 : pressed ? 0.7 : 1,
      })}
      {...rest}
    >
      {loading ? <ActivityIndicator color={colors[VARIANT_SPINNER[variant]]} /> : icon}
      <Text
        className={labelClassName}
        style={large ? { fontSize: 16, lineHeight: 21 } : undefined}
        tone={VARIANT_TONE[variant]}
        variant="callout"
        weight={600}
      >
        {label}
      </Text>
    </Pressable>
  );
}
