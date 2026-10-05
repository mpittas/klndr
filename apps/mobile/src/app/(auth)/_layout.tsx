import { Stack } from "expo-router";

/** The signed-out half of the app: no header, the screens draw their own. */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
