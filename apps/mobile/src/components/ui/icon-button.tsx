import type { ReactNode } from "react";
import { Pressable, type PressableProps } from "react-native";

import { MIN_TAP_TARGET, MIN_TOUCH_TARGET } from "./targets";

const VARIANT_CLASS = {
  plain: "bg-transparent",
  secondary: "bg-secondary border border-border",
  destructive: "bg-transparent",
} as const;

const TONE_BY_VARIANT = {
  plain: "text-foreground",
  secondary: "text-foreground",
  destructive: "text-destructive",
} as const;

/**
 * A square icon-only button. `label` is required and not optional: an icon has no text, so it is the
 * only accessible name the button will ever have.
 */
export type IconButtonProps = Omit<PressableProps, "children" | "style"> & {
  label: string;
  children: ReactNode;
  variant?: keyof typeof VARIANT_CLASS;
  /** `small` keeps the 40-point tap target of DESIGN.md; `regular` is a primary 44. */
  size?: "small" | "regular";
  /** Wraps the icon in the variant's text colour, for icons drawn with `currentColor` strokes. */
  tintIcon?: boolean;
  className?: string;
};

export function IconButton({
  label,
  children,
  variant = "plain",
  size = "regular",
  tintIcon = true,
  disabled,
  className,
  ...rest
}: IconButtonProps) {
  const side = size === "small" ? MIN_TAP_TARGET : MIN_TOUCH_TARGET;

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled === true }}
      className={[
        "items-center justify-center rounded-md",
        VARIANT_CLASS[variant],
        tintIcon ? TONE_BY_VARIANT[variant] : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled}
      style={({ pressed }) => ({
        height: side,
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        width: side,
      })}
      {...rest}
    >
      {children}
    </Pressable>
  );
}
