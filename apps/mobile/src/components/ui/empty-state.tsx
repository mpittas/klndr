import type { ReactNode } from "react";
import { View } from "react-native";

import { Text } from "./text";

export type EmptyStateProps = {
  title: string;
  description?: string;
  /** A drawn icon, not an emoji (DESIGN.md). */
  icon?: ReactNode;
  /** The one thing to do about it, if there is one. */
  action?: ReactNode;
  className?: string;
};

/** What a list says when it has nothing to show: what this is, and what to do next. */
export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <View
      className={["items-center justify-center gap-sm px-lg py-lg", className].filter(Boolean).join(" ")}
      // One announcement for the whole block rather than three separate ones.
      accessible
    >
      {icon}
      <Text className="text-center" tone="foreground" variant="title">
        {title}
      </Text>
      {description ? (
        <Text className="text-center" tone="muted">
          {description}
        </Text>
      ) : null}
      {action}
    </View>
  );
}
