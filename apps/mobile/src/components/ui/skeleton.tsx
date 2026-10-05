import { useEffect } from "react";
import type { DimensionValue } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

export type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  className?: string;
};

/**
 * A loading placeholder. It pulses — unless the system asks for less motion, in which case it holds
 * still, because a pulsing rectangle is exactly the kind of movement the setting is about. It is
 * hidden from assistive tech: it says "something is coming", not anything about the content.
 */
export function Skeleton({ width = "100%", height = 16, className }: SkeletonProps) {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = reducedMotion
      ? 1
      : withRepeat(withTiming(0.5, { duration: 800 }), -1, true);
  }, [opacity, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      className={["rounded-sm bg-muted", className].filter(Boolean).join(" ")}
      importantForAccessibility="no-hide-descendants"
      style={[{ height, width }, animatedStyle]}
    />
  );
}
