import { View } from "react-native";

import { EmptyState } from "@/components/ui";

/** A tab whose screen is built in a later task: it says which, rather than pretending to be done. */
export function PlaceholderTab({ title, task }: { title: string; task: string }) {
  return (
    <View className="flex-1 justify-center bg-background px-md">
      <EmptyState description={`Built in task ${task} of the mobile plan.`} title={title} />
    </View>
  );
}
