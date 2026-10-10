import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";

import { Button } from "./button";
import { Card } from "./card";
import { EmptyState } from "./empty-state";
import { SheetHeader, type SheetHeaderProps } from "./sheet-header";
import { Skeleton } from "./skeleton";
import { Text } from "./text";

/** The one inset every sheet keeps from its edges, so the gap above a card is the gap beside it. */
export const SHEET_SIDE = 16;

export type SheetScreenProps = SheetHeaderProps & {
  /** What went wrong with the last attempt, announced and shown above the content, where the header's action is. */
  error?: string | null;
  /** Fixed between the header and the scrolling content: a segmented control, a search field. */
  top?: ReactNode;
  /** `false` for a sheet that lays itself out and scrolls on its own (a long list). */
  scroll?: boolean;
  /** The space between the content's groups. */
  gap?: number;
  children: ReactNode;
};

/**
 * The frame every sheet shares: a header with the close disc, the title and the sheet's one action, and content
 * that scrolls above the keyboard on the canvas with the same inset on all four sides. Sheets differ in what
 * they hold, not in how it is laid out, so the spacing is decided here once.
 */
export function SheetScreen({ error, top, scroll = true, gap = 20, children, ...header }: SheetScreenProps) {
  return (
    <View className="flex-1 bg-canvas">
      <SheetHeader {...header} />
      {top}
      {scroll ? (
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{ gap, padding: SHEET_SIDE, paddingTop: 8 }}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1 }}
        >
          {error ? (
            <Card className="px-md py-sm">
              <Text accessibilityLiveRegion="polite" tone="destructive" variant="callout">
                {error}
              </Text>
            </Card>
          ) : null}
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </View>
  );
}

/** What a sheet shows while the thing it edits is loading: the shape of its first fields. */
export function SheetLoading() {
  return (
    <View className="flex-1 gap-sm bg-canvas p-md" style={{ paddingTop: 32 }}>
      <Skeleton height={28} width="50%" />
      <Skeleton height={64} />
      <Skeleton height={44} />
      <Skeleton height={44} />
    </View>
  );
}

/** What a sheet shows when the thing it edits could not load, or was deleted somewhere else. */
export function SheetMessage({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <View className="flex-1 justify-center bg-canvas">
      <EmptyState
        action={<Button label={actionLabel} onPress={onAction} variant="surface" />}
        description={description}
        title={title}
      />
    </View>
  );
}
