import type { ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "./text";

/**
 * The bar pinned under a sheet's form, so the action and any problem are always in view whatever the
 * keyboard is doing. `error` is announced as it appears.
 */
export function SheetFooter({ error, children }: { error?: string | null; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="gap-sm bg-canvas px-md pt-sm" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
      {error ? (
        <Text accessibilityLiveRegion="polite" className="px-xs" tone="destructive" variant="caption">
          {error}
        </Text>
      ) : null}
      <View className="flex-row items-center gap-sm">{children}</View>
    </View>
  );
}
