import {
  TOUCH_HOLD_MS,
  TOUCH_SLOP,
  blockHeight,
  blockTop,
  formatDuration,
  formatTime,
  hasResizeGrip,
  isShortBlock,
  resizedDuration,
  titleLines,
  type ScheduledTask,
} from "@klndr/core";
import type { ThemeName } from "@klndr/tokens";
import { memo, useEffect } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { Text } from "@/components/ui";
import { Check } from "@/icons";

import { blockColors } from "./block-colors";
import { BLOCK_RADIUS, RESIZE_STRIP, RING_HIT, RING_SIZE, VERY_WIDE_BLOCK, WIDE_BLOCK } from "./constants";

/**
 * What a block needs from the timeline to be lifted and dragged. The timeline owns the drag (one block is
 * held at a time, and the scroll area has to move with it), so these are shared values and worklets: the
 * finger is followed on the UI thread, and only discrete changes reach React.
 */
export type DragControls = {
  /** The id of the block being held; empty when none is. */
  id: SharedValue<string>;
  /** Where the held block's top edge is, following the finger. */
  top: SharedValue<number>;
  begin: (id: string, start: number, duration: number, x: number, y: number) => void;
  move: (x: number, y: number) => void;
  /** The finger went up: reports the drop, and returns the minute the block lands on. */
  end: (id: string) => number;
  /** The gesture was taken away (a call, the system): the block goes back where it was. */
  cancel: (id: string) => void;
  /** The block has taken its landing place for itself; the drag lets go of it. */
  release: (id: string) => void;
};

export type TimeBlockProps = {
  task: ScheduledTask;
  /** The category colour key (the colour of a block is its category's). */
  color: string;
  scheme: ThemeName;
  /** Where it sits across the timeline, in points: the column it is in. */
  left: number;
  width: number;
  /** The time shown under the title: the saved one, or where a held block would land. */
  timeLabel: string;
  /** Set while the block is being resized: its new length. */
  resizeLabel: string | null;
  /** Not saved yet (it has a made-up id), so it cannot be changed. */
  pending: boolean;
  drag: DragControls;
  /** Switched on while a finger is on the resize strip, so the scroll area does not take the touch. */
  lockScroll: SharedValue<boolean>;
  onOpen: (task: ScheduledTask) => void;
  onToggle: (task: ScheduledTask) => void;
  /** Called when the snapped length changes during a resize, with `null` when it ends or is cancelled. */
  onResizeStep: (id: string, duration: number | null) => void;
  onResizeCommit: (task: ScheduledTask, duration: number) => void;
  /** The same changes for assistive technology, which cannot drag. */
  onNudge: (task: ScheduledTask, direction: -1 | 1) => void;
  onLengthen: (task: ScheduledTask, direction: -1 | 1) => void;
  onDelete: (task: ScheduledTask) => void;
};

const A11Y_ACTIONS = [
  { name: "activate", label: "Edit block" },
  { name: "moveEarlier", label: "Move 15 minutes earlier" },
  { name: "moveLater", label: "Move 15 minutes later" },
  { name: "longer", label: "Make 15 minutes longer" },
  { name: "shorter", label: "Make 15 minutes shorter" },
  { name: "toggle", label: "Mark as done or not done" },
  { name: "delete", label: "Delete" },
];

/**
 * One block on the timeline. A tap opens it, a tap on its ring ticks it off, holding it for 300 ms lifts
 * it so it can be dragged to another time or column, and the strip along its bottom edge changes its
 * length. It looks like the web's block: the same palette, the same one-line and two-line rules.
 */
function TimeBlockView(props: TimeBlockProps) {
  const {
    task, color, scheme, left, width, timeLabel, resizeLabel, pending, drag, lockScroll,
    onOpen, onToggle, onResizeStep, onResizeCommit, onNudge, onLengthen, onDelete,
  } = props;

  const colors = blockColors(color, scheme, task.completed);
  const short = isShortBlock(task.durationMinutes);
  const wide = width >= WIDE_BLOCK;
  const showTime = short ? width >= VERY_WIDE_BLOCK : wide;
  const lines = titleLines(task.durationMinutes);
  const showRing = wide;

  // The block's resting place and size live in shared values, written by the UI thread while it is moved or
  // resized and by these effects when the saved data changes, so a render never fights a gesture.
  const top = useSharedValue(blockTop(task.startMinutes));
  const height = useSharedValue(blockHeight(task.durationMinutes));
  const x = useSharedValue(left);
  const w = useSharedValue(width);

  useEffect(() => {
    top.set(withTiming(blockTop(task.startMinutes), { duration: 150 }));
  }, [top, task]);
  useEffect(() => {
    height.set(withTiming(blockHeight(task.durationMinutes), { duration: 150 }));
  }, [height, task]);
  // The neighbours of a held block move aside, so a change of column is animated.
  useEffect(() => {
    x.set(withTiming(left, { duration: 160 }));
    w.set(withTiming(width, { duration: 160 }));
  }, [x, w, left, width]);

  const animated = useAnimatedStyle(() => {
    const held = drag.id.get() === task.id;
    return {
      top: held ? drag.top.get() : top.get(),
      height: height.get(),
      left: x.get(),
      width: w.get(),
      zIndex: held ? 40 : 10,
      transform: [{ scale: withTiming(held ? 1.02 : 1, { duration: 120 }) }],
      shadowOpacity: withTiming(held ? 0.28 : 0, { duration: 120 }),
      elevation: held ? 10 : 0,
    };
  });

  // ---- Gestures ----
  const id = task.id;
  const start = task.startMinutes;
  const duration = task.durationMinutes;

  const lift = Gesture.Pan()
    .enabled(!pending)
    .activateAfterLongPress(TOUCH_HOLD_MS)
    .maxPointers(1)
    .onStart((event) => {
      drag.begin(id, start, duration, event.absoluteX, event.absoluteY);
    })
    .onUpdate((event) => {
      drag.move(event.absoluteX, event.absoluteY);
    })
    .onEnd(() => {
      // Settle on the quarter hour it will land on, then take that place as its own before the drag lets go,
      // so that the block never jumps between the held position and the saved one.
      const landing = drag.end(id);
      top.set(blockTop(landing));
      drag.top.set(
        withTiming(blockTop(landing), { duration: 90 }, () => {
          drag.release(id);
        }),
      );
    })
    .onFinalize((_event, success) => {
      if (!success) drag.cancel(id);
    });

  const tap = Gesture.Tap()
    .maxDistance(TOUCH_SLOP)
    .enabled(!pending)
    .onEnd((_event, success) => {
      if (success) scheduleOnRN(onOpen, task);
    });

  const body = Gesture.Exclusive(lift, tap);

  const ring = Gesture.Tap()
    .enabled(!pending)
    .onEnd((_event, success) => {
      if (success) scheduleOnRN(onToggle, task);
    });

  // Resizing follows the finger in quarter-hour steps; the strip locks the scroll area the moment it is touched.
  const resizeDuration = useSharedValue(duration);
  const resize = Gesture.Pan()
    .maxPointers(1)
    .enabled(!pending)
    .minDistance(1)
    .onTouchesDown(() => {
      lockScroll.set(true);
    })
    .onStart(() => {
      resizeDuration.set(duration);
    })
    .onUpdate((event) => {
      const next = resizedDuration(start, duration, event.translationY);
      if (next === resizeDuration.get()) return;
      resizeDuration.set(next);
      height.set(withTiming(blockHeight(next), { duration: 70 }));
      scheduleOnRN(onResizeStep, id, next);
    })
    .onEnd(() => {
      const next = resizeDuration.get();
      if (next !== duration) scheduleOnRN(onResizeCommit, task, next);
    })
    .onFinalize((_event, success) => {
      lockScroll.set(false);
      if (!success || resizeDuration.get() === duration) height.set(withTiming(blockHeight(duration), { duration: 90 }));
      scheduleOnRN(onResizeStep, id, null);
    });

  const strip = Math.min(RESIZE_STRIP, Math.max(12, blockHeight(duration) / 2));
  const label = `${task.title}, ${formatTime(start)} to ${formatTime(start + duration)}${task.completed ? ", done" : ""}`;

  const ringView = showRing ? (
    <View
      style={{
        marginTop: short ? 0 : 1,
        width: RING_SIZE,
        height: RING_SIZE,
        borderRadius: RING_SIZE / 2,
        borderWidth: 1.5,
        borderColor: task.completed ? "transparent" : colors.ring,
        backgroundColor: task.completed ? colors.accent : "transparent",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {task.completed ? <Check color="#ffffff" size={11} strokeWidth={3.5} /> : null}
    </View>
  ) : null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        { position: "absolute", borderRadius: BLOCK_RADIUS, backgroundColor: colors.background, shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowRadius: 12 },
        animated,
      ]}
    >
      <GestureDetector gesture={body}>
        <Animated.View
          accessible
          accessibilityActions={A11Y_ACTIONS}
          accessibilityHint="Double tap to edit"
          accessibilityLabel={label}
          accessibilityRole="button"
          accessibilityState={{ checked: task.completed, busy: pending, disabled: pending }}
          onAccessibilityAction={(event) => {
            if (pending) return;
            switch (event.nativeEvent.actionName) {
              case "activate": return onOpen(task);
              case "moveEarlier": return onNudge(task, -1);
              case "moveLater": return onNudge(task, 1);
              case "longer": return onLengthen(task, 1);
              case "shorter": return onLengthen(task, -1);
              case "toggle": return onToggle(task);
              case "delete": return onDelete(task);
            }
          }}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: short ? "center" : "flex-start",
            gap: 8,
            overflow: "hidden",
            borderRadius: BLOCK_RADIUS,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
            paddingLeft: 10,
            paddingRight: 9,
            paddingTop: short ? 0 : 5,
            opacity: pending ? 0.7 : 1,
          }}
        >
          <View style={{ flex: 1, minWidth: 0, flexDirection: short ? "row" : "column", alignItems: short ? "baseline" : "stretch", gap: short ? 8 : 1 }}>
            <Text
              maxFontSizeMultiplier={1.25}
              numberOfLines={short ? 1 : lines}
              style={{ color: colors.text, fontSize: 13, lineHeight: 17, flexShrink: short ? 1 : 0 }}
              variant="caption"
              weight={600}
            >
              {task.emoji ? <Text style={{ opacity: task.completed ? 0.5 : 1, fontSize: 13 }}>{`${task.emoji} `}</Text> : null}
              {task.title}
            </Text>
            {showTime ? (
              <Text
                maxFontSizeMultiplier={1.25}
                numberOfLines={1}
                numeric
                style={{ color: colors.meta, fontSize: 12, lineHeight: 16, flexShrink: 0 }}
                variant="caption"
              >
                {timeLabel}
              </Text>
            ) : null}
          </View>

          {resizeLabel ? (
            <View style={{ borderRadius: 6, backgroundColor: "#171717", paddingHorizontal: 6 }}>
              <Text numeric style={{ color: "#fafafa", fontSize: 11, lineHeight: 16 }} variant="micro">
                {resizeLabel}
              </Text>
            </View>
          ) : null}

          {ringView}
        </Animated.View>
      </GestureDetector>

      {showRing ? (
        // The ring is small, so the square around it counts: a tap there ticks the block off, anywhere else opens it.
        <GestureDetector gesture={ring}>
          <View
            style={{ position: "absolute", right: 0, top: 0, width: RING_HIT, height: Math.min(RING_HIT, blockHeight(duration)) }}
          />
        </GestureDetector>
      ) : null}

      <GestureDetector gesture={resize}>
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: strip, alignItems: "center", justifyContent: "flex-end", paddingBottom: 3 }}>
          {hasResizeGrip(task.durationMinutes) ? (
            <View style={{ width: 20, height: 3, borderRadius: 2, backgroundColor: colors.text, opacity: 0.18 }} />
          ) : null}
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

export const TimeBlock = memo(TimeBlockView);

/** The label shown beside a block's title while it is resized. */
export const resizeLabelFor = (duration: number) => formatDuration(duration);
