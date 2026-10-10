import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * How much of a tab screen's bottom edge the tab bar covers, to keep the last row and the add button clear of it.
 *
 * - iOS: the tabs layout turns the automatic insets off, and each tab has its own safe-area provider whose
 *   bottom inset is measured to include the tab bar (and the home indicator under it).
 * - Android: each tab screen is wrapped in a view that already stops above the navigation bar, so nothing more
 *   needs keeping clear.
 */
export function useTabBarInset(): number {
  const insets = useSafeAreaInsets();
  return Platform.OS === "ios" ? insets.bottom : 0;
}
