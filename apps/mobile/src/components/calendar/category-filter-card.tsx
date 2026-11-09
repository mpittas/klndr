import { canonicalColor, hoursLabel, type CategoryShare } from "@klndr/core";
import { useCategoryColor } from "@klndr/data";
import { PALETTE } from "@klndr/tokens";
import { Pressable, StyleSheet, View } from "react-native";

import { CategoryDot } from "@/components/library/category-dot";
import { Chip, Section, Text } from "@/components/ui";
import { Check } from "@/icons";
import { useThemeColors, useThemeScheme } from "@/theme/tokens";

const SIDE = 16;

/**
 * The month at a glance and where its time goes, by category: three figures, a stacked bar and one line per category
 * with its hours. The lines are filters: pick one or more and the grid, the day and the agenda show only those
 * categories.
 */
export function CategoryFilterCard({
  shares,
  stats,
  selected,
  onToggle,
  onClear,
}: {
  shares: CategoryShare[];
  /** What the month holds, with the category filter applied. */
  stats: { blocks: number; minutes: number; done: number };
  /** The categories being shown; empty means all of them. */
  selected: string[];
  onToggle: (category: string) => void;
  onClear: () => void;
}) {
  const colors = useThemeColors();
  const scheme = useThemeScheme();
  const colorOf = useCategoryColor();
  const total = shares.reduce((sum, share) => sum + share.minutes, 0);
  const isOn = (category: string) => selected.length === 0 || selected.includes(category);
  const percent = stats.blocks ? Math.round((stats.done / stats.blocks) * 100) : 0;

  return (
    <Section
      action={selected.length > 0 ? <Chip compact label={`Clear filter (${selected.length})`} onPress={onClear} selected /> : null}
      footer={shares.length > 1 ? "Tap a category to show only its blocks." : undefined}
      title="This month"
    >
      <View className="flex-row px-md" style={{ paddingTop: 14, paddingBottom: 12 }}>
        {[
          { value: String(stats.blocks), label: stats.blocks === 1 ? "block" : "blocks" },
          { value: hoursLabel(stats.minutes), label: "planned" },
          { value: `${percent}%`, label: "done" },
        ].map((figure, index) => (
          <View
            accessible
            accessibilityLabel={`${figure.value} ${figure.label}`}
            key={figure.label}
            style={{
              flex: 1,
              paddingLeft: index === 0 ? 0 : 12,
              borderLeftWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
              borderLeftColor: colors.border,
            }}
          >
            <Text numeric style={{ fontSize: 22, lineHeight: 28, letterSpacing: -0.4 }} weight={700}>
              {figure.value}
            </Text>
            <Text tone="muted" variant="caption">
              {figure.label}
            </Text>
          </View>
        ))}
      </View>

      {shares.length === 0 ? (
        <Text className="px-md pb-md" tone="muted" variant="callout">
          Nothing planned this month yet.
        </Text>
      ) : (
        <>
          <View accessibilityElementsHidden className="mx-md mb-sm h-2 flex-row overflow-hidden rounded-full" style={{ gap: 2 }}>
            {shares.map((share) => (
              <View
                key={share.category}
                style={{
                  height: "100%",
                  width: `${(share.minutes / total) * 100}%`,
                  borderRadius: 4,
                  backgroundColor: PALETTE[canonicalColor(colorOf(share.sample))][scheme].swatch.background,
                  opacity: isOn(share.category) ? 1 : 0.2,
                }}
              />
            ))}
          </View>

          <View>
            {shares.map((share, index) => {
              const on = selected.includes(share.category);
              return (
                <Pressable
                  accessibilityLabel={`${share.category}, ${share.done} of ${share.count} done, ${hoursLabel(share.minutes)}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  className="flex-row items-center gap-md"
                  key={share.category}
                  onPress={() => onToggle(share.category)}
                  style={({ pressed }) => ({
                    minHeight: 48,
                    paddingHorizontal: SIDE,
                    backgroundColor: pressed ? colors.muted : "transparent",
                    opacity: isOn(share.category) ? 1 : 0.45,
                  })}
                >
                  <CategoryDot color={colorOf(share.sample)} size={10} />
                  <Text className="flex-1" numberOfLines={1} variant="callout">
                    {share.category}
                  </Text>
                  <Text numeric tone="muted" variant="caption">
                    {share.done}/{share.count}
                  </Text>
                  <Text numeric style={{ minWidth: 44, textAlign: "right" }} variant="callout" weight={600}>
                    {hoursLabel(share.minutes)}
                  </Text>
                  <View style={{ width: 16, alignItems: "flex-end" }}>
                    {on ? <Check color={colors.foreground} size={16} strokeWidth={3} /> : null}
                  </View>
                  {index < shares.length - 1 ? (
                    <View
                      pointerEvents="none"
                      style={{ position: "absolute", bottom: 0, right: 0, left: SIDE + 10 + 16, height: StyleSheet.hairlineWidth, backgroundColor: colors.border }}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </Section>
  );
}
