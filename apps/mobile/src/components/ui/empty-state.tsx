import type { ReactNode } from "react";
import { View } from "react-native";

import { Text } from "./text";

export type EmptyStateProps = {
  title: string;
  description?: string;
  /** A drawn icon, not an emoji (DESIGN.md); it sits in a soft disc above the title. */
  icon?: ReactNode;
  /** The one thing to do about it, if there is one. */
  action?: ReactNode;
  className?: string;
};

/** What a list says when it has nothing to show: what this is, and what to do next. */
export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <View className={["items-center justify-center gap-sm px-lg py-lg", className].filter(Boolean).join(" ")}>
      {/* One announcement for the words rather than three separate ones; the action stays its own control. */}
      <View accessible className="items-center gap-sm">
        {icon ? <View className="mb-xs h-14 w-14 items-center justify-center rounded-full bg-muted">{icon}</View> : null}
        <Text className="text-center" tone="foreground" variant="headline">
          {title}
        </Text>
        {description ? (
          <Text className="text-center" style={{ maxWidth: 300 }} tone="muted" variant="callout">
            {description}
          </Text>
        ) : null}
      </View>
      {action ? <View className="mt-xs">{action}</View> : null}
    </View>
  );
}
