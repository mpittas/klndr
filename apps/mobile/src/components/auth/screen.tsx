import * as WebBrowser from "expo-web-browser";
import type { PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui";
import { MIN_TOUCH_TARGET } from "@/components/ui/targets";
import { webBaseUrl } from "@/env";

/**
 * The frame every signed-out screen shares: the wordmark, a title, the form, and the privacy link.
 * It moves out of the keyboard's way and lets a tap on the background through, so a field's keyboard
 * never hides the button under it.
 */
export function AuthScreen({ title, subtitle, children }: PropsWithChildren<{ title: string; subtitle?: string }>) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-background">
      <ScrollView
        contentContainerClassName="gap-lg px-md"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: insets.top + 32 }}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-xs">
          <Text accessibilityRole="header" variant="display">
            klndr.
          </Text>
          <Text accessibilityRole="header" variant="title">
            {title}
          </Text>
          {subtitle ? <Text tone="muted">{subtitle}</Text> : null}
        </View>

        {children}

        <PrivacyLink />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** The policy lives on the website; with no website configured there is nothing to open, so no link. */
function PrivacyLink() {
  if (!webBaseUrl) return null;
  return (
    <Pressable
      accessibilityRole="link"
      className="items-center justify-center"
      onPress={() => void WebBrowser.openBrowserAsync(`${webBaseUrl}/privacy`)}
      style={{ minHeight: MIN_TOUCH_TARGET }}
    >
      <Text tone="muted" variant="caption">
        Privacy policy
      </Text>
    </Pressable>
  );
}

/** A message under a form, announced when it appears. */
export function FormMessage({ kind, children }: PropsWithChildren<{ kind: "error" | "info" }>) {
  return (
    <Text accessibilityLiveRegion="polite" tone={kind === "error" ? "destructive" : "foreground"}>
      {children}
    </Text>
  );
}
