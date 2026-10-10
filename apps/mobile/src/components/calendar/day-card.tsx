import { addDaysISO, formatDuration, longDate, type ScheduledTask } from "@klndr/core";
import { PALETTE } from "@klndr/tokens";
import { Pressable, StyleSheet, View } from "react-native";

import { Card, ProgressRing, Text } from "@/components/ui";
import { ArrowUpRight, Plus } from "@/icons";
import { useThemeColors, useThemeScheme } from "@/theme/tokens";
import { TaskRow } from "./task-row";

/** "Today", "Tomorrow", "Yesterday", or the weekday's name. */
export function relativeDayName(day: string, today: string): string {
  if (day === today) return "Today";
  if (day === addDaysISO(today, 1)) return "Tomorrow";
  if (day === addDaysISO(today, -1)) return "Yesterday";
  return longDate(day).split(",")[0];
}

/** The date under the day's name: in full beside "Today", without the weekday the name already says. */
const dateLine = (day: string, today: string) => {
  const full = longDate(day);
  return relativeDayName(day, today) === full.split(",")[0] ? full.split(", ").slice(1).join(", ") : full;
};

export type DayCardProps = {
  day: string;
  today: string;
  /** The day's blocks, in start order, already narrowed by the category filter. */
  tasks: ScheduledTask[];
  filtered: boolean;
  colorOf: (task: ScheduledTask) => string;
  onToggle: (task: ScheduledTask) => void;
  onEdit: (task: ScheduledTask) => void;
  onOpenDay: (day: string) => void;
  onAddBlock: (day: string) => void;
};

/**
 * The day chosen in the grid: its name and how it is going, its blocks (tick one off, or open it), and the two things
 * to do from here — add a block to it, or open it on the timeline.
 */
export function DayCard({ day, today, tasks, filtered, colorOf, onToggle, onEdit, onOpenDay, onAddBlock }: DayCardProps) {
  const colors = useThemeColors();
  const scheme = useThemeScheme();
  const done = tasks.filter((task) => task.completed).length;
  const minutes = tasks.reduce((sum, task) => sum + task.durationMinutes, 0);
  const allDone = tasks.length > 0 && done === tasks.length;
  const green = PALETTE.emerald[scheme].accent.background ?? colors.foreground;

  return (
    <Card>
      <View className="flex-row items-center gap-md px-md" style={{ paddingTop: 14, paddingBottom: 10 }}>
        <View className="min-w-0 flex-1">
          <Text accessibilityRole="header" numberOfLines={1} variant="headline">
            {relativeDayName(day, today)}
          </Text>
          <Text numberOfLines={1} numeric tone="muted" variant="caption">
            {dateLine(day, today)} · {tasks.length === 0 ? "nothing planned" : `${formatDuration(minutes)} planned`}
          </Text>
        </View>
        {tasks.length > 0 ? (
          <ProgressRing color={allDone ? green : undefined} label="Blocks done" size={40} stroke={3.5} value={done / tasks.length}>
            <Text numeric style={{ fontSize: 11, lineHeight: 13 }} weight={700}>
              {done}/{tasks.length}
            </Text>
          </ProgressRing>
        ) : null}
      </View>

      {tasks.length === 0 ? (
        <Text className="px-md pb-md" tone="muted" variant="callout">
          {filtered ? "No blocks in the selected categories." : "A free day. Add a block, or hold a day in the grid."}
        </Text>
      ) : (
        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
          {tasks.map((task, index) => (
            <TaskRow
              color={colorOf(task)}
              divider={index < tasks.length - 1}
              key={task.id}
              onPress={onEdit}
              onToggle={onToggle}
              task={task}
            />
          ))}
        </View>
      )}

      <View className="flex-row" style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
        <Pressable
          accessibilityLabel={`Add a block on ${longDate(day)}`}
          accessibilityRole="button"
          className="flex-1 flex-row items-center justify-center gap-xs"
          onPress={() => onAddBlock(day)}
          style={({ pressed }) => ({ minHeight: 48, opacity: pressed ? 0.6 : 1 })}
        >
          <Plus color={colors.foreground} size={17} strokeWidth={2.4} />
          <Text variant="callout" weight={600}>
            Add block
          </Text>
        </Pressable>
        <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 10 }} />
        <Pressable
          accessibilityLabel={`Open ${longDate(day)} on the timeline`}
          accessibilityRole="button"
          className="flex-1 flex-row items-center justify-center gap-xs"
          onPress={() => onOpenDay(day)}
          style={({ pressed }) => ({ minHeight: 48, opacity: pressed ? 0.6 : 1 })}
        >
          <Text variant="callout" weight={600}>
            Open day
          </Text>
          <ArrowUpRight color={colors.foreground} size={17} strokeWidth={2.4} />
        </Pressable>
      </View>
    </Card>
  );
}
