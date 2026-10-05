import * as AppleAuthentication from "expo-apple-authentication";
import { Platform, View } from "react-native";

import { Button } from "@/components/ui";
import { MIN_TOUCH_TARGET } from "@/components/ui/targets";
import { useThemePreference } from "@/theme/preference";

type ProviderButtonProps = { onPress: () => void; disabled?: boolean };

/**
 * Sign in with Apple. On iOS this is Apple's own button — the App Store's guideline is to use theirs, in
 * their wording, black on a light screen and white on a dark one — and elsewhere it is ours, because
 * Android has no system button.
 */
export function AppleButton({ onPress, disabled }: ProviderButtonProps) {
  const { resolved } = useThemePreference();

  if (Platform.OS !== "ios") {
    return <Button disabled={disabled} label="Continue with Apple" onPress={onPress} variant="secondary" />;
  }

  return (
    <View pointerEvents={disabled ? "none" : "auto"} style={{ opacity: disabled ? 0.5 : 1 }}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonStyle={
          resolved === "dark"
            ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
            : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
        }
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        cornerRadius={10}
        onPress={onPress}
        style={{ height: MIN_TOUCH_TARGET + 4, width: "100%" }}
      />
    </View>
  );
}

export function GoogleButton({ onPress, disabled }: ProviderButtonProps) {
  return <Button disabled={disabled} label="Continue with Google" onPress={onPress} variant="secondary" />;
}
