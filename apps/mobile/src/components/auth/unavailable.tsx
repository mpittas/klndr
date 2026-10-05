import { View } from "react-native";

import { EmptyState } from "@/components/ui";

/**
 * Shown when a build has no Firebase configuration and is not in demo mode: a developer on a fresh
 * checkout, never a person with the app from a store (those builds carry the config files). It names the
 * two ways out instead of letting a native call crash.
 */
export function UnavailableScreen({ message }: { message: string }) {
  return (
    <View className="flex-1 justify-center bg-background px-md">
      <EmptyState description={message} title="Sign-in isn't set up" />
    </View>
  );
}
