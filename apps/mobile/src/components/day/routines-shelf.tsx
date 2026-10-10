import type { DayChecklistItem } from "@klndr/core";
import { PALETTE } from "@klndr/tokens";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { CircleButton, ProgressRing, Text } from "@/components/ui";
import { Check, NotebookPen, Plus } from "@/icons";
import { useThemeColors, useThemeScheme } from "@/theme/tokens";

export type RoutinesShelfProps = {
  items: DayChecklistItem[];
  completedIds: string[];
  onToggle: (itemId: string, completed: boolean) => void;
  /** Opens the checklist, to add, skip or edit routines. */
  onManage?: () => void;
  /** Opens the day's notes. */
  onOpenNotes?: () => void;
  /** The day has notes written, so the button says so. */
  hasNotes?: boolean;
};

const CHIP_HEIGHT = 36;

/**
 * The day's routines as a strip of pills above the timeline: tap one to tick it off. Like the web's shelf, a
 * ticked routine is quieter rather than gone, and the ring at its start says how the day's routines are going.
 * The ring opens the checklist; the notebook opens the day's notes.
 */
export function RoutinesShelf({ items, completedIds, onToggle, onManage, onOpenNotes, hasNotes = false }: RoutinesShelfProps) {
  const colors = useThemeColors();
  const scheme = useThemeScheme();
  const done = items.filter((item) => completedIds.includes(item.id)).length;
  const allDone = items.length > 0 && done === items.length;
  const green = PALETTE.emerald[scheme].accent.background ?? colors.foreground;

  return (
    <View
      className="flex-row items-center bg-background"
      style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}
    >
      <ScrollView
        contentContainerStyle={{ alignItems: "center", gap: 8, paddingLeft: 16, paddingRight: 8, paddingVertical: 8 }}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        {onManage ? (
          <Pressable
            accessibilityHint="Opens the checklist to add, skip or edit routines"
            accessibilityLabel={items.length === 0 ? "Add a routine" : `Routines, ${done} of ${items.length} done`}
            accessibilityRole="button"
            className="flex-row items-center gap-xs rounded-full"
            onPress={onManage}
            style={({ pressed }) => ({
              minHeight: CHIP_HEIGHT,
              paddingLeft: items.length === 0 ? 12 : 4,
              paddingRight: 12,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.border,
              borderStyle: items.length === 0 ? "dashed" : "solid",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            {items.length === 0 ? (
              <Plus color={colors["muted-foreground"]} size={16} strokeWidth={2.4} />
            ) : (
              <ProgressRing color={allDone ? green : undefined} label="Routines done" size={28} stroke={2.5} value={done / items.length}>
                {allDone ? <Check color={green} size={13} strokeWidth={3.5} /> : null}
              </ProgressRing>
            )}
            <Text numeric tone={items.length === 0 ? "muted" : "foreground"} variant="caption" weight={600}>
              {items.length === 0 ? "Add a routine" : `${done}/${items.length}`}
            </Text>
          </Pressable>
        ) : null}

        {items.map((item) => {
          const ticked = completedIds.includes(item.id);
          return (
            <Pressable
              accessibilityLabel={`${item.title}, ${ticked ? "done" : "not done"}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: ticked }}
              className="flex-row items-center rounded-full bg-muted"
              key={item.id}
              onPress={() => onToggle(item.id, !ticked)}
              style={({ pressed }) => ({ minHeight: CHIP_HEIGHT, gap: 7, paddingLeft: 8, paddingRight: 13, opacity: pressed ? 0.6 : 1 })}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  borderWidth: ticked ? 0 : 1.5,
                  borderColor: colors["muted-foreground"],
                  backgroundColor: ticked ? green : colors.card,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {ticked ? <Check color="#ffffff" size={12} strokeWidth={3.5} /> : null}
              </View>
              {item.emoji ? <Text style={{ fontSize: 14, lineHeight: 18, opacity: ticked ? 0.5 : 1 }}>{item.emoji}</Text> : null}
              <Text
                numberOfLines={1}
                style={{ maxWidth: 180, textDecorationLine: ticked ? "line-through" : "none" }}
                tone={ticked ? "muted" : "foreground"}
                variant="caption"
                weight={500}
              >
                {item.title}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {onOpenNotes ? (
        <View className="pr-md" style={{ paddingLeft: 4 }}>
          <CircleButton label={hasNotes ? "Notes, this day has notes" : "Notes"} onPress={onOpenNotes} size={36} variant="muted">
            <NotebookPen color={colors.foreground} size={17} strokeWidth={2} />
          </CircleButton>
          {hasNotes ? (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 1,
                right: 15,
                width: 10,
                height: 10,
                borderRadius: 5,
                borderWidth: 2,
                borderColor: colors.background,
                backgroundColor: green,
              }}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
