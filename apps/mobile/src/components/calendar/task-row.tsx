import { canonicalColor, formatTimeRange, type ScheduledTask } from "@klndr/core";
import { PALETTE } from "@klndr/tokens";
import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { blockColors } from "@/components/day/block-colors";
import { Text } from "@/components/ui";
import { Check } from "@/icons";
import { useThemeColors, useThemeScheme } from "@/theme/tokens";

const SIDE = 16;
/** The tick's column: wide enough for a thumb, the circle drawn smaller inside it. */
const TICK_COLUMN = 44;

export type TaskRowProps = {
  task: ScheduledTask;
  /** The block's category colour key. */
  color: string;
  onToggle: (task: ScheduledTask) => void;
  /** A tap on the row (not its tick): open the block. */
  onPress: (task: ScheduledTask) => void;
  divider?: boolean;
};

/**
 * A block as a line in a list: a tick to mark it done right here, its emoji and title, and when it runs and in which
 * category. A tap anywhere else opens it in the editor.
 */
export const TaskRow = memo(function TaskRow({ task, color, onToggle, onPress, divider = true }: TaskRowProps) {
  const colors = useThemeColors();
  const scheme = useThemeScheme();
  const tone = blockColors(color, scheme, task.completed);
  const green = PALETTE.emerald[scheme].accent.background ?? colors.foreground;
  const dot = PALETTE[canonicalColor(color)][scheme].swatch.background ?? colors.foreground;
  const range = formatTimeRange(task.startMinutes, task.startMinutes + task.durationMinutes);

  return (
    <View className="flex-row items-stretch bg-card">
      <Pressable
        accessibilityLabel={`${task.completed ? "Reopen" : "Complete"} ${task.title}`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.completed }}
        onPress={() => onToggle(task)}
        style={({ pressed }) => ({ width: TICK_COLUMN + 4, paddingLeft: SIDE - 4, justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            borderWidth: task.completed ? 0 : 1.5,
            borderColor: tone.ring,
            backgroundColor: task.completed ? green : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {task.completed ? <Check color="#ffffff" size={13} strokeWidth={3.5} /> : null}
        </View>
      </Pressable>

      <Pressable
        accessibilityHint="Opens the block"
        accessibilityLabel={`${task.title}, ${range}, ${task.category}${task.completed ? ", done" : ""}`}
        accessibilityRole="button"
        className="min-w-0 flex-1 justify-center"
        onPress={() => onPress(task)}
        style={({ pressed }) => ({ minHeight: 56, paddingVertical: 8, paddingRight: SIDE, opacity: pressed ? 0.6 : 1 })}
      >
        <Text
          numberOfLines={1}
          style={{ textDecorationLine: task.completed ? "line-through" : "none" }}
          tone={task.completed ? "muted" : "foreground"}
          variant="callout"
          weight={500}
        >
          {task.emoji ? `${task.emoji}  ` : ""}
          {task.title}
        </Text>
        <View className="flex-row items-center" style={{ gap: 6, marginTop: 2 }}>
          <Text numeric tone="muted" variant="caption">
            {range}
          </Text>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dot }} />
          <Text className="shrink" numberOfLines={1} tone="muted" variant="caption">
            {task.category}
          </Text>
        </View>
      </Pressable>

      {divider ? (
        <View
          pointerEvents="none"
          style={{ position: "absolute", bottom: 0, right: 0, left: TICK_COLUMN + 4, height: StyleSheet.hairlineWidth, backgroundColor: colors.border }}
        />
      ) : null}
    </View>
  );
});
