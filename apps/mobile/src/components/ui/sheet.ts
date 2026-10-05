import { RADII } from "@klndr/tokens";
import type { Stack } from "expo-router";
import type { ComponentProps } from "react";

type ScreenOptions = NonNullable<ComponentProps<typeof Stack.Screen>["options"]>;

/**
 * A sheet, which is how this app presents anything that is not a whole screen (DESIGN.md: dialogs and
 * pickers are bottom sheets). Expo Router's form-sheet presentation gives the real system sheet, so
 * the swipe-down-to-dismiss gesture, the grabber and the detents are the platform's, not ours.
 *
 * Default detents are half height and full height, which is what a sheet with a primary action in its
 * footer wants: enough to read the form, then enough to see the keyboard.
 */
export function formSheet(detents: number[] = [0.5, 1]): ScreenOptions {
  return {
    presentation: "formSheet",
    sheetAllowedDetents: detents,
    sheetCornerRadius: RADII.lg,
    sheetExpandsWhenScrolledToEdge: false,
    sheetGrabberVisible: true,
  };
}
