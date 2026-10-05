import { signInProblem } from "@klndr/core";
import { Link } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { useAuth } from "@/auth";
import { AppleButton, GoogleButton } from "@/components/auth/provider-buttons";
import { AuthScreen, FormMessage } from "@/components/auth/screen";
import { useSubmit } from "@/components/auth/use-submit";
import { Button, Text, TextField } from "@/components/ui";

export default function SignInScreen() {
  const { service } = useAuth();
  const { busy, error, setError, submit } = useSubmit("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (!service) return null; // demo mode never shows this screen

  const signIn = () => {
    const problem = signInProblem({ email, password });
    if (problem) return setError(problem);
    void submit(() => service.signInWithEmail(email.trim(), password));
  };

  return (
    <AuthScreen subtitle="Sign in to plan your day." title="Welcome back">
      <View className="gap-md">
        <TextField
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          editable={!busy}
          keyboardType="email-address"
          label="Email"
          onChangeText={setEmail}
          returnKeyType="next"
          textContentType="emailAddress"
          value={email}
        />
        <TextField
          autoCapitalize="none"
          autoComplete="current-password"
          editable={!busy}
          label="Password"
          onChangeText={setPassword}
          onSubmitEditing={signIn}
          returnKeyType="go"
          secureTextEntry
          textContentType="password"
          value={password}
        />

        {error ? <FormMessage kind="error">{error}</FormMessage> : null}

        <Button label="Sign in" loading={busy} onPress={signIn} />
        <Link asChild href="/forgot-password">
          <Button disabled={busy} label="Forgot password?" variant="ghost" />
        </Link>
      </View>

      <View className="gap-sm">
        <Text className="text-center" tone="muted" variant="caption">
          or
        </Text>
        <AppleButton
          disabled={busy}
          onPress={() => void submit(async () => void (await service.signInWithApple()))}
        />
        <GoogleButton disabled={busy} onPress={() => void submit(async () => void (await service.signInWithGoogle()))} />
      </View>

      <View className="flex-row items-center justify-center gap-xs">
        <Text tone="muted">New here?</Text>
        <Link asChild href="/sign-up">
          <Button disabled={busy} label="Create an account" variant="ghost" />
        </Link>
      </View>
    </AuthScreen>
  );
}
