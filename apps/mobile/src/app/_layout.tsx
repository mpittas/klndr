import "@/global.css";

import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@/auth";
import { formSheet, ToastProvider } from "@/components/ui";
import { UnavailableScreen } from "@/components/auth/unavailable";
import { AppDataProvider } from "@/data";
import { INTER_FONTS, useFonts } from "@/fonts";
import { applyStoredTheme, ThemePreferenceProvider, useThemePreference } from "@/theme/preference";

// Module scope, on purpose: the saved theme has to be applied before anything is painted, and the
// splash screen must stay up until Inter is loaded, so no frame ever shows a fallback font.
applyStoredTheme();
SplashScreen.preventAutoHideAsync().catch(() => {});

/** The status bar follows the *resolved* theme: "system" means the phone decides, including at dusk. */
function ThemedStatusBar() {
  const { resolved } = useThemePreference();
  return <StatusBar style={resolved === "dark" ? "light" : "dark"} />;
}

/**
 * The auth gate: the tabs (and everything reached from them) exist only while someone is signed in, and
 * the sign-in screens only while no one is. Expo Router's `Stack.Protected` is what makes that true of
 * deep links too — a link to `klndr://day/…` while signed out lands on sign-in, not on a screen with no
 * data behind it — and it redirects by itself when the sign-in state flips, so no screen has to
 * navigate after signing in or out.
 */
function RootNavigator() {
  const { state } = useAuth();
  const signedIn = state.status === "signed-in";

  if (state.status === "unavailable") return <UnavailableScreen message={state.message} />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
        {/* Sheets over the tabs: the system's own form sheet, with its grabber and detents. */}
        <Stack.Screen name="task-editor" options={formSheet([0.8, 1])} />
        <Stack.Screen name="emoji-sheet" options={formSheet([0.7, 1])} />
        <Stack.Screen name="date-sheet" options={formSheet([0.75])} />
        <Stack.Screen name="month-sheet" options={formSheet([0.7])} />
        <Stack.Screen name="day-sheet" options={formSheet([0.7, 1])} />
        <Stack.Screen name="activity-sheet" options={formSheet([0.8, 1])} />
        <Stack.Screen name="category-sheet" options={formSheet([0.8, 1])} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

/**
 * The root layout: the providers (theme, auth, toast, safe area, gestures) around the gate. The splash
 * screen stays up until the fonts are loaded *and* Firebase has said whether a session was restored, so a
 * signed-in person never sees a signed-out frame first.
 */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(INTER_FONTS);
  const fontsReady = fontsLoaded || Boolean(fontError);

  if (!fontsReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemePreferenceProvider>
          <ThemedStatusBar />
          <ToastProvider>
            <AuthProvider>
              <SplashUntilSettled />
              <AppDataProvider>
                <RootNavigator />
              </AppDataProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemePreferenceProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Lets the splash go once the auth state is known. Renders nothing. */
function SplashUntilSettled() {
  const { state } = useAuth();
  const settled = state.status !== "loading";

  useEffect(() => {
    if (settled) SplashScreen.hideAsync().catch(() => {});
  }, [settled]);

  return null;
}
