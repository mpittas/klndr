import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/auth";
import { Button, Text, useToast } from "@/components/ui";
import { demoMode } from "@/env";

/**
 * Settings, as far as task 1.3 needs it: who is signed in, and the way out. Task 2.6 builds the rest
 * (profile fields, theme, reminders, the privacy link and account deletion) around this.
 */
export default function SettingsTab() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { state, signOut, retryProfile } = useAuth();

  if (state.status !== "signed-in") return null;
  const { user, profile, profileError } = state;

  return (
    <ScrollView
      className="bg-background"
      contentContainerClassName="gap-lg px-md"
      contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: insets.top + 16 }}
    >
      <Text accessibilityRole="header" variant="display">
        Settings
      </Text>

      <View className="gap-xs">
        <Text variant="title">{profile?.displayName || user.displayName || "Signed in"}</Text>
        <Text tone="muted">{demoMode ? "Demo mode: nothing here is synced." : (user.email ?? "No email on this account")}</Text>
      </View>

      {profileError ? (
        <View className="gap-sm">
          <Text accessibilityLiveRegion="polite" tone="destructive">
            {profileError}
          </Text>
          <Button label="Try again" onPress={retryProfile} variant="secondary" />
        </View>
      ) : null}

      {demoMode ? null : (
        <Button
          label="Sign out"
          onPress={() => void signOut().catch(() => toast.show({ message: "Could not sign out. Try again." }))}
          variant="secondary"
        />
      )}
    </ScrollView>
  );
}
