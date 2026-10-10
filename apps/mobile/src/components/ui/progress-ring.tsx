import type { ReactNode } from "react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { useThemeColors } from "@/theme/tokens";

export type ProgressRingProps = {
  /** From 0 to 1. */
  value: number;
  size?: number;
  stroke?: number;
  /** The filled arc's colour; the theme's ink unless given (green when a day is all done, say). */
  color?: string;
  /** What the ring stands for, for assistive tech: "Routines done". */
  label: string;
  children?: ReactNode;
};

/** A small circular progress meter, with anything (a count, a tick) in its middle. */
export function ProgressRing({ value, size = 28, stroke = 3, color, label, children }: ProgressRingProps) {
  const colors = useThemeColors();
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, value));

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
    >
      <Svg height={size} style={{ position: "absolute" }} width={size}>
        <Circle cx={size / 2} cy={size / 2} fill="none" r={radius} stroke={colors.border} strokeWidth={stroke} />
        {clamped > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            fill="none"
            r={radius}
            stroke={color ?? colors.foreground}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - clamped)}
            strokeLinecap="round"
            strokeWidth={stroke}
            // From twelve o’clock, clockwise.
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}
