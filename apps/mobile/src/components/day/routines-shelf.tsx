import type { DayChecklistItem } from "@klndr/core";
import { PALETTE } from "@klndr/tokens";
import { Pressable, ScrollView, View } from "react-native";

import { Text } from "@/components/ui";
import { Check } from "@/icons";
import { useThemeColors, useThemeScheme } from "@/theme/tokens";

export type RoutinesShelfProps = {
  items: DayChecklistItem[];
  completedIds: string[];
  onToggle: (itemId: string, completed: boolean) => void;
  /** Opens the checklist, to add, skip or edit routines. */
  onManage?: () => void;
};

/**
 * The day's routines as a strip of chips above the timeline: tap one to tick it off. Like the web's shelf,
 * a ticked routine is quieter rather than gone, and the count says how the day is going.
 */
export function RoutinesShelf({ items, completedIds, onToggle, onManage }: RoutinesShelfProps) {
  const colors = useThemeColors();
  const scheme = useThemeScheme();
  const done = items.filter((item) => completedIds.includes(item.id)).length;
  const allDone = items.length > 0 && done === items.length;
  const green = PALETTE.emerald[scheme].accent.background ?? colors.foreground;

  return (
    <View className="flex-row items-center gap-sm border-b border-border bg-background pl-md">
      <View className="flex-row items-baseline gap-xs">
        <Text tone="muted" variant="nano">
          ROUTINES
        </Text>
        <Text numeric style={{ color: allDone ? green : colors["muted-foreground"] }} variant="micro">
          {done}/{items.length}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ alignItems: "center", gap: 6, paddingRight: 16, paddingVertical: 6 }}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        {items.map((item) => {
          const ticked = completedIds.includes(item.id);
          return (
            <Pressable
              accessibilityLabel={`${item.title}, ${ticked ? "done" : "not done"}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: ticked }}
              key={item.id}
              onPress={() => onToggle(item.id, !ticked)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                minHeight: 40,
                borderRadius: 9999,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: ticked ? colors.muted : colors.card,
                opacity: pressed ? 0.7 : ticked ? 0.7 : 1,
                paddingHorizontal: 14,
              })}
            >
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  borderWidth: 1,
                  borderColor: ticked ? green : colors["muted-foreground"],
                  backgroundColor: ticked ? green : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {ticked ? <Check color="#ffffff" size={11} strokeWidth={3.5} /> : null}
              </View>
              {item.emoji ? <Text variant="caption">{item.emoji}</Text> : null}
              <Text
                numberOfLines={1}
                style={{ maxWidth: 192, textDecorationLine: ticked ? "line-through" : "none" }}
                tone={ticked ? "muted" : "foreground"}
                variant="caption"
              >
                {item.title}
              </Text>
            </Pressable>
          );
        })}

        {onManage ? (
          <Pressable
            accessibilityLabel="Manage routines"
            accessibilityRole="button"
            onPress={onManage}
            style={({ pressed }) => ({
              minHeight: 40,
              justifyContent: "center",
              borderRadius: 9999,
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
              paddingHorizontal: 14,
            })}
          >
            <Text tone="muted" variant="caption">
              Manage
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}
