import type { ReactNode } from "react";
import { View, type ViewProps } from "react-native";

import { Text } from "./text";

/** The corner of every grouped card, a step softer than the 14-point panel radius: the phone's own forms. */
export const CARD_RADIUS = 20;

export type CardProps = ViewProps & { className?: string };

/**
 * A rounded surface on the screen's canvas: the grouped look of the phone's own Settings. Its elevation is the
 * step from the canvas to the card, so it carries neither a border nor a shadow (DESIGN.md: one or the other,
 * and here neither is needed).
 */
export function Card({ className, style, ...rest }: CardProps) {
  return (
    <View
      className={["overflow-hidden bg-card", className].filter(Boolean).join(" ")}
      style={[{ borderRadius: CARD_RADIUS, borderCurve: "continuous" }, style]}
      {...rest}
    />
  );
}

export type SectionProps = {
  /** The group's name, above the card. */
  title?: string;
  /** Something to do with the whole group, at the end of the title line ("Clear", "Edit"). */
  action?: ReactNode;
  /** A quieter line under the card: what the group is for, or what a setting does. */
  footer?: string;
  /** `padded` is for a card of fields and text; a card of rows runs edge to edge. */
  padded?: boolean;
  /** The danger zone: the title in the destructive colour. */
  destructive?: boolean;
  children: ReactNode;
  className?: string;
};

/** One group on a grouped screen: a title, a card of rows or fields, and an optional note under it. */
export function Section({ title, action, footer, padded = false, destructive = false, children, className }: SectionProps) {
  return (
    <View className={["gap-sm", className].filter(Boolean).join(" ")}>
      {title || action ? (
        <View className="min-h-6 flex-row items-end justify-between gap-sm px-md">
          {title ? (
            <Text accessibilityRole="header" tone={destructive ? "destructive" : "muted"} variant="caption" weight={600}>
              {title}
            </Text>
          ) : (
            <View />
          )}
          {action}
        </View>
      ) : null}
      <Card className={padded ? "gap-md p-md" : undefined}>{children}</Card>
      {footer ? (
        <Text className="px-md" tone="muted" variant="caption">
          {footer}
        </Text>
      ) : null}
    </View>
  );
}
