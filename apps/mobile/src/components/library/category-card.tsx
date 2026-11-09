import { formatDuration, type ActivityTemplate, type CategoryEntry } from "@klndr/core";
import { Pressable, StyleSheet, View } from "react-native";

import { Card, IconTile, Text } from "@/components/ui";
import { ChevronRight, Plus } from "@/icons";
import { useThemeColors } from "@/theme/tokens";
import { CategoryDot } from "./category-dot";

const SIDE = 16;
const TILE = 36;

export type CategoryCardProps = {
  entry: CategoryEntry;
  /** The activities to list: all of the category's, or the ones a search matched. */
  items: ActivityTemplate[];
  /** How many activities the category has in all (a search can show fewer). */
  total: number;
  searching: boolean;
  onOpenCategory: () => void;
  onOpenActivity: (template: ActivityTemplate) => void;
  onAddActivity: () => void;
};

/**
 * One category and its activities, the library's grouped list: the category's name above its card (tap it to rename,
 * recolour or delete it), then each activity on its category's tint (tap to edit), then a row to add another one to
 * the same category.
 */
export function CategoryCard({ entry, items, total, searching, onOpenCategory, onOpenActivity, onAddActivity }: CategoryCardProps) {
  const colors = useThemeColors();
  const count = total === 0 ? "Empty" : total === 1 ? "1 activity" : `${total} activities`;

  return (
    <View className="gap-sm">
      <Pressable
        accessibilityHint="Opens the category to rename, recolour or delete it"
        accessibilityLabel={`${entry.name}, ${count}${entry.id ? "" : ", not saved yet"}`}
        accessibilityRole="button"
        className="flex-row items-center gap-sm px-xs"
        onPress={onOpenCategory}
        style={({ pressed }) => ({ minHeight: 36, opacity: pressed ? 0.6 : 1 })}
      >
        <CategoryDot color={entry.color} size={10} />
        <Text className="shrink" numberOfLines={1} variant="headline">
          {entry.emoji ? `${entry.emoji} ${entry.name}` : entry.name}
        </Text>
        <Text className="flex-1" numberOfLines={1} tone="muted" variant="caption">
          {entry.id ? count : `${count} · not saved`}
        </Text>
        <Text tone="muted" variant="caption" weight={600}>
          Edit
        </Text>
        <ChevronRight color={colors["muted-foreground"]} size={15} style={{ marginLeft: -4 }} />
      </Pressable>

      <Card>
        {items.map((template, index) => (
          <Pressable
            accessibilityHint="Opens the activity to edit it"
            accessibilityLabel={`${template.name}, ${formatDuration(template.defaultDuration)}`}
            accessibilityRole="button"
            className="flex-row items-center gap-md"
            key={template.id}
            onPress={() => onOpenActivity(template)}
            style={({ pressed }) => ({ minHeight: 60, paddingHorizontal: SIDE, backgroundColor: pressed ? colors.muted : "transparent" })}
          >
            <IconTile color={entry.color} size={TILE}>
              {template.emoji}
            </IconTile>
            <View className="min-w-0 flex-1 py-sm" style={{ gap: 2 }}>
              <Text numberOfLines={1} variant="callout" weight={500}>
                {template.name}
              </Text>
              {template.notes ? (
                <Text numberOfLines={1} tone="muted" variant="caption">
                  {template.notes}
                </Text>
              ) : null}
            </View>
            <View className="rounded-full bg-muted px-sm" style={{ paddingVertical: 3 }}>
              <Text numeric tone="muted" variant="caption" weight={600}>
                {formatDuration(template.defaultDuration)}
              </Text>
            </View>
            {index < items.length - 1 || !searching ? (
              <View
                pointerEvents="none"
                style={{ position: "absolute", bottom: 0, right: 0, left: SIDE + TILE + 16, height: StyleSheet.hairlineWidth, backgroundColor: colors.border }}
              />
            ) : null}
          </Pressable>
        ))}

        {searching ? null : (
          <Pressable
            accessibilityLabel={`Add an activity to ${entry.name}`}
            accessibilityRole="button"
            className="flex-row items-center gap-md"
            onPress={onAddActivity}
            style={({ pressed }) => ({ minHeight: 52, paddingHorizontal: SIDE, backgroundColor: pressed ? colors.muted : "transparent" })}
          >
            <View
              className="items-center justify-center"
              style={{ width: TILE, height: TILE, borderRadius: 10, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.border }}
            >
              <Plus color={colors["muted-foreground"]} size={17} strokeWidth={2.4} />
            </View>
            <Text tone="muted" variant="callout" weight={500}>
              Add activity
            </Text>
          </Pressable>
        )}
      </Card>
    </View>
  );
}
