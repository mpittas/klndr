import { Link } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { useAuth } from "@/auth";
import { AuthScreen, FormMessage } from "@/components/auth/screen";
import { useSubmit } from "@/components/auth/use-submit";
import { Button, TextField } from "@/components/ui";

export default function ForgotPasswordScreen() {
  const { service } = useAuth();
  const { busy, error, setError, submit } = useSubmit("reset");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  if (!service) return null;

  const send = () => {
    setSent(false);
    if (!email.trim()) return setError("Please enter your email address to receive password reset instructions.");
    void submit(async () => {
      await service.sendPasswordReset(email.trim());
      setSent(true);
    });
  };

  return (
    <AuthScreen subtitle="We will email you a link to choose a new one." title="Reset your password">
      <View className="gap-md">
        <TextField
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          editable={!busy}
          keyboardType="email-address"
          label="Email"
          onChangeText={setEmail}
          onSubmitEditing={send}
          returnKeyType="send"
          textContentType="emailAddress"
          value={email}
        />

        {error ? <FormMessage kind="error">{error}</FormMessage> : null}
        {sent ? <FormMessage kind="info">Password reset email sent. Check your inbox.</FormMessage> : null}

        <Button label="Send reset link" loading={busy} onPress={send} size="large" />
        <Link asChild dismissTo href="/sign-in">
          <Button disabled={busy} label="Back to sign in" variant="ghost" />
        </Link>
      </View>
    </AuthScreen>
  );
}
