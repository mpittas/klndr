import { MIN_PASSWORD_LENGTH, signUpProblem } from "@klndr/core";
import { Link } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { useAuth } from "@/auth";
import { AppleButton, GoogleButton } from "@/components/auth/provider-buttons";
import { AuthScreen, FormMessage } from "@/components/auth/screen";
import { useSubmit } from "@/components/auth/use-submit";
import { Button, Text, TextField } from "@/components/ui";

export default function SignUpScreen() {
  const { service } = useAuth();
  const { busy, error, setError, submit } = useSubmit("sign-up");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  if (!service) return null;

  const signUp = () => {
    const problem = signUpProblem({ name, email, password, confirmPassword });
    if (problem) return setError(problem);
    void submit(() => service.signUpWithEmail(email.trim(), password, name.trim()));
  };

  return (
    <AuthScreen subtitle="Free, and your plan follows you to the web." title="Create your account">
      <View className="gap-md">
        <TextField
          autoCapitalize="words"
          autoComplete="name"
          editable={!busy}
          label="Name"
          onChangeText={setName}
          returnKeyType="next"
          textContentType="name"
          value={name}
        />
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
          autoComplete="new-password"
          editable={!busy}
          helper={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          label="Password"
          onChangeText={setPassword}
          returnKeyType="next"
          secureTextEntry
          textContentType="newPassword"
          value={password}
        />
        <TextField
          autoCapitalize="none"
          autoComplete="new-password"
          editable={!busy}
          label="Confirm password"
          onChangeText={setConfirmPassword}
          onSubmitEditing={signUp}
          returnKeyType="go"
          secureTextEntry
          textContentType="newPassword"
          value={confirmPassword}
        />

        {error ? <FormMessage kind="error">{error}</FormMessage> : null}

        <Button label="Create account" loading={busy} onPress={signUp} />
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
        <Text tone="muted">Already have an account?</Text>
        <Link asChild href="/sign-in">
          <Button disabled={busy} label="Sign in" variant="ghost" />
        </Link>
      </View>
    </AuthScreen>
  );
}
