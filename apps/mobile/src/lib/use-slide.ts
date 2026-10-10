import { useCallback, useEffect, useRef } from "react";
import { useWindowDimensions } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

const SLIDE_MS = 180;
/** A swipe goes through if it travels a quarter of the screen, or is flicked. */
const SWIPE_DISTANCE = 0.25;
const SWIPE_VELOCITY = 600;

/**
 * Paging sideways through something (months, here): the page slides off in the direction of travel, `onStep`
 * swaps what it shows, and the new page slides in from the other side. Swiping does the same as the arrows,
 * following the finger and springing back when it is let go too soon. `key` is what identifies the page on
 * screen: when it changes, the arrival is animated. With "reduce motion" on, it just changes.
 *
 * This is the paging the Day tab does inline for days; it is here for the screens that come after it.
 */
export function useSlide(key: string, onStep: (direction: 1 | -1) => void) {
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const slide = useSharedValue(0);
  const arriving = useRef<1 | -1 | 0>(0);

  const commit = useCallback(
    (direction: 1 | -1) => {
      arriving.current = direction;
      onStep(direction);
    },
    [onStep],
  );

  useEffect(() => {
    if (arriving.current === 0) return;
    const from = arriving.current * width;
    arriving.current = 0;
    slide.set(from);
    slide.set(withTiming(0, { duration: reducedMotion ? 0 : SLIDE_MS }));
  }, [key, slide, width, reducedMotion]);

  /** Slides the page off in the direction of travel, then swaps it (see the effect above). */
  const step = useCallback(
    (direction: 1 | -1) => {
      if (reducedMotion) return commit(direction);
      slide.set(
        withTiming(-direction * width, { duration: SLIDE_MS }, (finished) => {
          if (finished) scheduleOnRN(commit, direction);
        }),
      );
    },
    [commit, reducedMotion, slide, width],
  );

  const swipe = Gesture.Pan()
    .maxPointers(1)
    .activeOffsetX([-24, 24])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      slide.set(event.translationX);
    })
    .onEnd((event) => {
      const far = Math.abs(event.translationX) > width * SWIPE_DISTANCE || Math.abs(event.velocityX) > SWIPE_VELOCITY;
      if (!far) {
        slide.set(withTiming(0, { duration: reducedMotion ? 0 : SLIDE_MS }));
        return;
      }
      const direction = event.translationX < 0 ? 1 : -1;
      slide.set(
        withTiming(-direction * width, { duration: reducedMotion ? 0 : SLIDE_MS }, (finished) => {
          if (finished) scheduleOnRN(commit, direction);
        }),
      );
    })
    .onFinalize((_event, success) => {
      if (!success) slide.set(withTiming(0, { duration: reducedMotion ? 0 : SLIDE_MS }));
    });

  const slideStyle = useAnimatedStyle(() => ({ transform: [{ translateX: slide.get() }] }));

  return { slideStyle, step, swipe };
}
