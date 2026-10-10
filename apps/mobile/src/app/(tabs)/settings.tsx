import { authErrorMessage, type UserProfile } from "@klndr/core";
import { useProfile } from "@klndr/data";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { useState, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/api";
import { useAuth } from "@/auth";
import { DeleteAccount } from "@/components/settings/delete-account";
import { ProfileForm } from "@/components/settings/profile-form";
import { SignInMethods } from "@/components/settings/sign-in-methods";
import { Button, Card, IconTile, ListRow, Section, SegmentedControl, Skeleton, Text, useToast } from "@/components/ui";
import { demoMode, webBaseUrl } from "@/env";
import { ExternalLink, KeyRound, LogOut, ShieldCheck, Trash } from "@/icons";
import { useTabBarInset } from "@/lib/insets";
import { useThemePreference, type ThemePreference } from "@/theme/preference";
import { useThemeColors } from "@/theme/tokens";

const THEMES: { label: string; value: ThemePreference }[] = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
];

const initialsOf = (name: string, email: string | null) => {
  const text = (name || email || "U").trim();
  const parts = text.split(/\s+/);
  return (parts.length >= 2 ? parts[0][0] + parts[1][0] : text.slice(0, 2)).toUpperCase();
};

/**
 * Settings, as the web's profile page: who you are and how the planner behaves for you, how it looks, how you sign
 * in, the way out, and the way to delete the account — as the phone's own grouped list. The theme is the phone's
 * own, kept on the device.
 */
export default function SettingsTab() {
  const insets = useSafeAreaInsets();
  const tabBarInset = useTabBarInset();
  const colors = useThemeColors();
  const toast = useToast();
  const { state, service, signOut, retryProfile } = useAuth();
  const { preference, setPreference } = useThemePreference();
  const profileQuery = useProfile();
  const [resetting, setResetting] = useState(false);

  if (state.status !== "signed-in") return null;
  const { user, profileError } = state;

  // The profile the gate read first stands in until the query has its own copy.
  const profile: UserProfile | null = profileQuery.data ?? state.profile;
  const name = profile?.displayName || user.displayName || "Signed in";
  const email = demoMode ? null : (user.email ?? null);
  const hasPassword = (service?.providerIds() ?? user.providerIds).includes("password");

  const sendReset = async () => {
    if (!service || !user.email) return;
    setResetting(true);
    try {
      await service.sendPasswordReset(user.email);
      toast.show({ message: `Reset link sent to ${user.email}` });
    } catch (failure) {
      toast.show({ message: authErrorMessage(failure, "reset") });
    } finally {
      setResetting(false);
    }
  };

  const openWebPage = (path: string) => void WebBrowser.openBrowserAsync(`${webBaseUrl}${path}`);
  const linkIcon = <ExternalLink color={colors["muted-foreground"]} size={16} />;
  const tile = (icon: ReactNode) => <IconTile size={30}>{icon}</IconTile>;
  const canReset = hasPassword && Boolean(user.email);

  return (
    <ScrollView
      automaticallyAdjustKeyboardInsets
      className="bg-canvas"
      contentContainerClassName="gap-lg px-md"
      contentContainerStyle={{ paddingBottom: tabBarInset + 24, paddingTop: insets.top + 4 }}
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      scrollIndicatorInsets={{ bottom: tabBarInset }}
    >
      <Text accessibilityRole="header" className="py-xs" variant="largeTitle">
        Settings
      </Text>

      <Card
        accessible
        accessibilityLabel={`${name}${email ? `, ${email}` : ""}`}
        className="flex-row items-center gap-md p-md"
      >
        <View className="h-14 w-14 items-center justify-center rounded-full bg-primary">
          <Text tone="primary-foreground" variant="headline">
            {initialsOf(name, email)}
          </Text>
        </View>
        <View className="min-w-0 flex-1" style={{ gap: 2 }}>
          <Text numberOfLines={1} variant="headline">
            {name}
          </Text>
          <Text numberOfLines={1} tone="muted" variant="callout">
            {demoMode ? "Demo mode · nothing here is synced" : (email ?? "No email on this account")}
          </Text>
        </View>
      </Card>

      {profileError ? (
        <Card className="gap-sm p-md">
          <Text accessibilityLiveRegion="polite" tone="destructive" variant="callout">
            {profileError}
          </Text>
          <Button label="Try again" onPress={retryProfile} variant="secondary" />
        </Card>
      ) : null}

      {profile ? (
        <ProfileForm email={email} profile={profile} />
      ) : (
        <Section title="Profile">
          <View className="gap-sm p-md">
            <Skeleton height={36} />
            <Skeleton height={36} />
            <Skeleton height={36} />
          </View>
        </Section>
      )}

      <Section footer="Light, dark, or whatever the phone is set to." padded title="Appearance">
        <SegmentedControl label="Theme" onChange={setPreference} options={THEMES} value={preference} />
      </Section>

      {demoMode || !service ? null : (
        <Section
          footer="Connect more than one, and each opens this same account. If you use Apple with “Hide My Email”, connect it here — otherwise it starts a separate, empty account."
          title="Sign-in methods"
        >
          <SignInMethods service={service} />
        </Section>
      )}

      {canReset || webBaseUrl || !demoMode ? (
      <Section title="Account">
        {canReset ? (
          <ListRow
            description="We email you a link to choose a new one."
            disabled={resetting}
            label="Reset password"
            leading={tile(<KeyRound color={colors.foreground} size={16} strokeWidth={2.2} />)}
            leadingWidth={30}
            onPress={() => void sendReset()}
          />
        ) : null}
        {webBaseUrl ? (
          <>
            <ListRow
              chevron={false}
              label="Privacy policy"
              leading={tile(<ShieldCheck color={colors.foreground} size={16} strokeWidth={2.2} />)}
              leadingWidth={30}
              onPress={() => openWebPage("/privacy")}
              trailing={linkIcon}
            />
            <ListRow
              chevron={false}
              divider={!demoMode}
              label="Delete your data"
              description="How to delete your account, in the app or by email."
              leading={tile(<Trash color={colors.foreground} size={16} strokeWidth={2.2} />)}
              leadingWidth={30}
              onPress={() => openWebPage("/account-deletion")}
              trailing={linkIcon}
            />
          </>
        ) : null}
        {demoMode ? null : (
          <ListRow
            chevron={false}
            destructive
            divider={false}
            label="Sign out"
            leading={tile(<LogOut color={colors.destructive} size={16} strokeWidth={2.2} />)}
            leadingWidth={30}
            onPress={() => void signOut().catch(() => toast.show({ message: "Could not sign out. Try again." }))}
          />
        )}
      </Section>
      ) : null}

      {demoMode || !service ? null : (
        <Section destructive title="Danger zone">
          <DeleteAccount
            needsPassword={hasPassword}
            onDelete={(payload) => service.deleteAccount({ ...payload, deleteData: () => api.deleteAccount() })}
          />
        </Section>
      )}

      <Text className="text-center" tone="muted" variant="caption">
        klndr {Constants.expoConfig?.version ?? ""}
      </Text>
    </ScrollView>
  );
}
