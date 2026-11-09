import { withImplicitCategories, type ActivityTemplate, type Category } from "@dayro/core";
import { useMemo } from "react";
import { ScrollView, View } from "react-native";

import { CategoryDot } from "@/components/library/category-dot";
import { Chip, SHEET_SIDE, Text } from "@/components/ui";

/** How many categories get a chip; the rest are in the Category row's menu. */
const CHIPS = 5;

/**
 * A block's category as one tap, under its name: a chip for each of the most used categories, the one in use
 * filled. The app picks one from the name as it is typed and says so, so a wrong guess is noticed and changed
 * with a tap. Every category, and a new one, stay in the Category row further down.
 */
export function CategoryChips({
  value,
  suggested,
  guessing,
  named,
  ranked,
  categories,
  templates,
  onChange,
}: {
  value: string | null;
  suggested: boolean;
  guessing: boolean;
  /** The block has a name yet, so there is something to pick from. */
  named: boolean;
  ranked: string[];
  categories: Category[];
  templates: ActivityTemplate[];
  onChange: (name: string) => void;
}) {
  const entries = useMemo(() => withImplicitCategories(categories, templates), [categories, templates]);

  const shown = useMemo(() => {
    const top = ranked.slice(0, CHIPS);
    if (value && !top.some((name) => name.toLowerCase() === value.toLowerCase())) return [value, ...top.slice(0, CHIPS - 1)];
    return top;
  }, [ranked, value]);

  if (!shown.length) return null;

  const status = guessing
    ? "Picking one from the name…"
    : suggested
      ? "✨ Picked from the name"
      : value
        ? null
        : named
          ? "No match: pick one"
          : "Picked from the name as you type";

  return (
    <View className="gap-sm">
      <View className="flex-row items-center justify-between px-md">
        <Text tone="muted" variant="caption" weight={600}>
          Category
        </Text>
        {status ? (
          <Text accessibilityLiveRegion="polite" numberOfLines={1} tone="muted" variant="caption">
            {status}
          </Text>
        ) : null}
      </View>
      <ScrollView
        contentContainerStyle={{ gap: 8, paddingHorizontal: SHEET_SIDE }}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -SHEET_SIDE }}
      >
        {shown.map((name) => {
          const entry = entries.find((item) => item.name.toLowerCase() === name.toLowerCase());
          const selected = value?.toLowerCase() === name.toLowerCase();
          return (
            <Chip
              key={name}
              accessibilityRole="radio"
              label={entry?.name ?? name}
              leading={<CategoryDot color={entry?.color ?? "slate"} size={10} />}
              onPress={() => onChange(entry?.name ?? name)}
              selected={selected}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}
