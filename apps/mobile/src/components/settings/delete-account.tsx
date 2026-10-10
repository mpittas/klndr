import { useState } from "react";
import { Alert, View } from "react-native";

import { Button, ListRow, Text, TextField } from "@/components/ui";

/** The phrase to type. Long enough that it cannot happen by accident. */
const CONFIRMATION = "delete my account";

/** What went wrong, in words fit to show; a wrong password and a stale sign-in are the usual two. */
export function describeDeleteError(thrown: unknown): string {
  const code = String((thrown as { code?: unknown } | null)?.code ?? "");
  if (code.includes("wrong-password") || code.includes("invalid-credential")) return "That password doesn't match this account.";
  if (code.includes("requires-recent-login")) return "For safety, sign out and sign in again, then delete your account.";
  if (code.includes("popup-closed-by-user") || code.includes("cancelled")) return "The sign-in was cancelled, so nothing was deleted.";
  return (thrown as Error | null)?.message || "Could not delete your account.";
}

/**
 * The same guard the web has: type a phrase, give the password if the account has one, and the button wakes up.
 * The phone keeps it folded behind a row until it is asked for, and adds a last question, since a thumb is quicker
 * than a mouse.
 */
export function DeleteAccount({
  needsPassword,
  onDelete,
}: {
  /** Password accounts must type their password: Firebase asks for a recent sign-in before deleting. */
  needsPassword: boolean;
  onDelete: (payload: { password?: string }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmed = typed.trim().toLowerCase() === CONFIRMATION;
  const ready = confirmed && (!needsPassword || password.length > 0) && !busy;

  const run = async () => {
    setError(null);
    setBusy(true);
    try {
      await onDelete(needsPassword ? { password } : {});
    } catch (failure) {
      setError(describeDeleteError(failure));
      setBusy(false);
    }
    // On success the account is gone and the app returns to sign-in; there is nothing left to update here.
  };

  const ask = () =>
    Alert.alert("Delete your account?", "Everything is erased for good. This cannot be undone.", [
      { text: "Keep my account", style: "cancel" },
      { text: "Delete everything", style: "destructive", onPress: () => void run() },
    ]);

  return (
    <View>
      <ListRow
        accessibilityState={{ expanded: open }}
        chevron={false}
        destructive
        divider={open}
        label="Delete account"
        onPress={() => setOpen((value) => !value)}
        trailing={
          <Text tone="muted" variant="caption" weight={600}>
            {open ? "Hide" : "Show"}
          </Text>
        }
      />

      {open ? (
        <View className="gap-md p-md">
          <Text tone="muted" variant="caption">
            This erases your activities, categories, timeline blocks, checklist, notes and profile for good. There is no
            way to undo it.
          </Text>

          <TextField
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
            label={`Type “${CONFIRMATION}” to confirm`}
            onChangeText={setTyped}
            placeholder={CONFIRMATION}
            value={typed}
          />

          {needsPassword ? (
            <TextField
              autoCapitalize="none"
              autoComplete="current-password"
              editable={!busy}
              label="Your password"
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
              value={password}
            />
          ) : null}

          {error ? (
            <Text accessibilityLiveRegion="polite" tone="destructive" variant="caption">
              {error}
            </Text>
          ) : null}

          <Button disabled={!ready} label="Delete my account" loading={busy} onPress={ask} size="large" variant="destructive" />
        </View>
      ) : null}
    </View>
  );
}
