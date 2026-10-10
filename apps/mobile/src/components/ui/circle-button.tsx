import type { ReactNode } from "react";
import { Pressable, type PressableProps } from "react-native";

import { MIN_TOUCH_TARGET } from "./targets";

const VARIANT_CLASS = {
  /** On the canvas: a white disc, the way the phone draws its own header buttons. */
  card: "bg-card",
  /** On a white surface (the Day tab, a sheet's card). */
  muted: "bg-muted",
  /** The one action the screen is for. */
  primary: "bg-primary",
} as const;

export type CircleButtonProps = Omit<PressableProps, "children" | "style"> & {
  /** The accessible name: the button is only an icon. */
  label: string;
  children: ReactNode;
  variant?: keyof typeof VARIANT_CLASS;
  /** The drawn disc; the hit area is never under 44 points whatever this is. */
  size?: number;
  className?: string;
};

/** A round icon button, for a header's few actions and a sheet's close. */
export function CircleButton({ label, children, variant = "card", size = 36, disabled, className, ...rest }: CircleButtonProps) {
  const slop = Math.max(0, (MIN_TOUCH_TARGET - size) / 2);
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled === true }}
      className={["items-center justify-center rounded-full", VARIANT_CLASS[variant], className].filter(Boolean).join(" ")}
      disabled={disabled}
      hitSlop={slop}
      style={({ pressed }) => ({ width: size, height: size, opacity: disabled ? 0.35 : pressed ? 0.6 : 1 })}
      {...rest}
    >
      {children}
    </Pressable>
  );
}
