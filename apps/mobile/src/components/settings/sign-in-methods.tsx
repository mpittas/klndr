import { authErrorMessage } from "@klndr/core";
import { useState } from "react";
import { Platform, View } from "react-native";

import type { AuthService, LinkableProvider } from "@/auth/types";
import { Button, IconTile, ListRow, Text } from "@/components/ui";
import { Check, KeyRound } from "@/icons";
import { useThemeColors } from "@/theme/tokens";

type Row = { id: string; label: string; linkable: LinkableProvider | null; mark: string | null };

const ROWS: Row[] = [
  { id: "google.com", label: "Google", linkable: "google.com", mark: "G" },
  // The Apple logo is a private-use character only Apple's own fonts draw; elsewhere it is a letter.
  { id: "apple.com", label: "Apple", linkable: "apple.com", mark: Platform.OS === "ios" ? "" : "A" },
  { id: "password", label: "Email & password", linkable: null, mark: null },
];

/**
 * The ways this account can be signed in to, and a button to attach the missing ones — the web profile's card.
 * Apple's "Hide My Email" hands the app a relay address that never matches the Google email, so signing in
 * with Apple alone makes a second, empty account; connecting it from here, while signed in to the account that
 * already has the data, is how the two are joined.
 */
export function SignInMethods({ service }: { service: AuthService }) {
  const colors = useThemeColors();
  // Linking changes the account's providers without Firebase announcing a new sign-in, so they are read
  // again after each connect rather than taken from the auth state.
  const [providerIds, setProviderIds] = useState(() => service.providerIds());
  const [busy, setBusy] = useState<LinkableProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connect = async (provider: LinkableProvider) => {
    setError(null);
    setBusy(provider);
    try {
      await service.linkProvider(provider);
      setProviderIds(service.providerIds());
    } catch (failure) {
      setError(authErrorMessage(failure));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View>
      {error ? (
        <Text accessibilityLiveRegion="polite" className="px-md pt-sm" tone="destructive" variant="caption">
          {error}
        </Text>
      ) : null}

      {ROWS.map((row, index) => {
        const connected = providerIds.includes(row.id);
        return (
          <ListRow
            divider={index < ROWS.length - 1}
            key={row.id}
            label={row.label}
            leading={
              <IconTile size={30}>
                {row.mark === null ? (
                  <KeyRound color={colors.foreground} size={16} strokeWidth={2.2} />
                ) : (
                  <Text style={{ fontSize: 15, lineHeight: 18 }} weight={700}>
                    {row.mark}
                  </Text>
                )}
              </IconTile>
            }
            leadingWidth={30}
            trailing={
              connected ? (
                <View accessible accessibilityLabel="Connected" className="flex-row items-center gap-xs">
                  <Check color={colors["muted-foreground"]} size={15} strokeWidth={2.6} />
                  <Text tone="muted" variant="callout">
                    Connected
                  </Text>
                </View>
              ) : row.linkable ? (
                <Button
                  disabled={busy !== null}
                  label="Connect"
                  loading={busy === row.linkable}
                  onPress={() => void connect(row.linkable as LinkableProvider)}
                  variant="secondary"
                />
              ) : (
                <Text tone="muted" variant="callout">
                  Not set
                </Text>
              )
            }
          />
        );
      })}
    </View>
  );
}
