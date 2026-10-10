import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Platform } from "react-native";

import { useThemeColors } from "@/theme/tokens";

/**
 * iOS: every screen places itself with the safe-area insets (each tab has its own provider there, measured to include
 * the tab bar). Left on, the automatic insets would also push a screen's first scroll view down by the status bar and
 * up by the tab bar, on top of that, and the content would sit twice as far from both edges. Android keeps them: there
 * the tab bar overlays the screen, and the automatic inset is the view that stops each screen above it (see
 * `lib/insets.ts`).
 */
const OWN_INSETS = Platform.OS === "ios";

/**
 * The four tabs, drawn by the platform (UITabBar on iOS, Material navigation bar on Android): Day,
 * Calendar, Library and Settings. The tint is the theme's ink rather than the system blue: colour in this app
 * belongs to the categories.
 */
export default function TabsLayout() {
  const colors = useThemeColors();
  return (
    <NativeTabs indicatorColor={colors.accent} tintColor={colors.foreground}>
      <NativeTabs.Trigger disableAutomaticContentInsets={OWN_INSETS} name="index">
        <NativeTabs.Trigger.Label>Day</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="today" sf={{ default: "sun.max", selected: "sun.max.fill" }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger disableAutomaticContentInsets={OWN_INSETS} name="calendar">
        <NativeTabs.Trigger.Label>Calendar</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="calendar_month" sf="calendar" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger disableAutomaticContentInsets={OWN_INSETS} name="library">
        <NativeTabs.Trigger.Label>Library</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="library_books" sf={{ default: "square.stack", selected: "square.stack.fill" }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger disableAutomaticContentInsets={OWN_INSETS} name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="settings" sf={{ default: "gearshape", selected: "gearshape.fill" }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
