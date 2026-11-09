import { longDate, type ScheduledTask } from "@klndr/core";
import { useCategoryColor, useTaskActions } from "@klndr/data";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Chip, Section, Skeleton, Text } from "@/components/ui";
import { ChevronRight } from "@/icons";
import { useThemeColors } from "@/theme/tokens";
import { relativeDayName } from "./day-card";
import { TaskRow } from "./task-row";

/** How many blocks the agenda shows before "Show all". */
const COLLAPSED_COUNT = 8;

/**
 * The two weeks after today as a list, grouped by day. Each block can be ticked off right here (it updates the month grid
 * at once) or opened; a day's heading opens that day. Done blocks can be hidden, and the list follows the calendar's
 * category filter.
 */
export function AgendaCard({
  today,
  tasks,
  loading,
  filtered,
  onEdit,
  onOpenDay,
}: {
  today: string;
  /** The blocks of the two weeks after today, already narrowed by the category filter, in date and start order. */
  tasks: ScheduledTask[];
  loading: boolean;
  filtered: boolean;
  onEdit: (task: ScheduledTask) => void;
  onOpenDay: (day: string) => void;
}) {
  const colors = useThemeColors();
  const colorOf = useCategoryColor();
  const { toggleComplete } = useTaskActions();
  const [hideDone, setHideDone] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const shown = hideDone ? tasks.filter((task) => !task.completed) : tasks;
  const visible = showAll ? shown : shown.slice(0, COLLAPSED_COUNT);
  const doneCount = tasks.filter((task) => task.completed).length;

  const groups = useMemo(() => {
    const byDay = new Map<string, ScheduledTask[]>();
    for (const task of visible) byDay.set(task.day, [...(byDay.get(task.day) ?? []), task]);
    return [...byDay.entries()];
  }, [visible]);

  return (
    <Section
      action={
        doneCount > 0 ? <Chip compact label="Hide done" onPress={() => setHideDone((value) => !value)} selected={hideDone} /> : null
      }
      title="Coming up"
    >
      {loading && tasks.length === 0 ? (
        <View className="gap-sm p-md">
          <Skeleton height={36} />
          <Skeleton height={36} />
          <Skeleton height={36} />
        </View>
      ) : shown.length === 0 ? (
        <Text className="p-md" tone="muted" variant="callout">
          {filtered
            ? "No blocks in the selected categories."
            : tasks.length
              ? "Everything is done. Nice."
              : "Nothing scheduled for the next two weeks."}
        </Text>
      ) : (
        <View>
          {groups.map(([day, dayTasks], groupIndex) => (
            <View key={day}>
              <Pressable
                accessibilityHint="Opens this day"
                accessibilityLabel={longDate(day)}
                accessibilityRole="button"
                className="flex-row items-center gap-xs bg-muted px-md"
                onPress={() => onOpenDay(day)}
                style={({ pressed }) => ({
                  minHeight: 34,
                  opacity: pressed ? 0.6 : 1,
                  borderTopWidth: groupIndex === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                })}
              >
                <Text variant="caption" weight={700}>
                  {relativeDayName(day, today)}
                </Text>
                <Text className="flex-1" numberOfLines={1} tone="muted" variant="caption">
                  {longDate(day).split(", ").slice(1).join(", ")}
                </Text>
                <ChevronRight color={colors["muted-foreground"]} size={15} />
              </Pressable>
              {dayTasks.map((task, index) => (
                <TaskRow
                  color={colorOf(task)}
                  divider={index < dayTasks.length - 1}
                  key={task.id}
                  onPress={onEdit}
                  onToggle={(item) => void toggleComplete(item)}
                  task={task}
                />
              ))}
            </View>
          ))}

          {shown.length > COLLAPSED_COUNT ? (
            <Pressable
              accessibilityRole="button"
              className="items-center justify-center"
              onPress={() => setShowAll((value) => !value)}
              style={({ pressed }) => ({
                minHeight: 46,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.border,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text variant="callout" weight={600}>
                {showAll ? "Show less" : `Show all ${shown.length}`}
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </Section>
  );
}
