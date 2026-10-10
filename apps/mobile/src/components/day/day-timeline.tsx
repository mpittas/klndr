import {
  GRID_HEIGHT,
  HOUR_OPTIONS,
  SLOT_HEIGHT,
  blockHeight,
  blockTop,
  boxOf,
  changedLanes,
  columnsBeside,
  dragFraction,
  dragPosition,
  edgeScrollSpeed,
  formatTime,
  formatTimeRange,
  grabOffset,
  gutterLabel,
  initialScrollOffset,
  layoutDay,
  minutesToPx,
  nudgedDuration,
  nudgedStart,
  planDrag,
  pxToMinutes,
  slotAt,
  DAY_MINUTES,
  type ScheduledTask,
} from "@klndr/core";
import { isTempId } from "@klndr/data";
import * as Haptics from "expo-haptics";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  measure,
  scrollTo,
  useAnimatedProps,
  useAnimatedRef,
  useFrameCallback,
  useScrollOffset,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { EmptyState, Button, Skeleton, Text } from "@/components/ui";
import { useThemeColors, useThemeScheme } from "@/theme/tokens";

import { nowColor } from "./block-colors";
import { BLOCK_RADIUS, BLOCK_SIDE_INSET, BOTTOM_PADDING, GRID_TOP, GUTTER_WIDTH } from "./constants";
import { TimeBlock, resizeLabelFor, type DragControls } from "./time-block";

export type DayTimelineProps = {
  day: string;
  tasks: ScheduledTask[];
  /** The day's blocks are not here yet. */
  loading: boolean;
  /** They could not be fetched and nothing older is held. */
  failed: boolean;
  onRetry: () => void;
  /** The colour of a block: its category's. */
  colorOf: (task: ScheduledTask) => string;
  /** The minute of the day when it is today, otherwise null. */
  nowMinute: number | null;
  onCreateAt: (startMinutes: number) => void;
  onOpen: (task: ScheduledTask) => void;
  onToggle: (task: ScheduledTask) => void;
  onMove: (task: ScheduledTask, startMinutes: number, lanes?: Map<string, number>) => void;
  onResize: (task: ScheduledTask, durationMinutes: number) => void;
  onDelete: (task: ScheduledTask) => void;
  /** How much of the bottom edge the tab bar covers: the timeline scrolls on under it, and stops clear of it. */
  bottomInset?: number;
};

/** A block being held: where it would land, and how far across the timeline the finger is. */
type Held = { id: string; start: number; fraction: number; dropped: boolean };

/** The span, in minutes, whose edges are marked in the gutter and across the grid. */
type Guide = { start: number; end: number };

/**
 * The day's timeline: the hour gutter, the grid, the now-line and the blocks, in a vertical scroll area.
 *
 * Holding a block lifts it. From then on the finger is followed on the UI thread (`dragTop`, a shared
 * value), the scroll area scrolls by itself near its edges, and only *discrete* changes reach React: a new
 * quarter hour, or a different column. Those drive the ghost slot, the gutter times, the neighbours moving
 * aside and the selection haptic. Nothing re-renders on every frame of a drag.
 */
export function DayTimeline(props: DayTimelineProps) {
  const { day, tasks, loading, failed, onRetry, colorOf, nowMinute, onCreateAt, onOpen, onToggle, onMove, onResize, onDelete, bottomInset = 0 } = props;

  const { width: windowWidth } = useWindowDimensions();
  const areaWidth = windowWidth - GUTTER_WIDTH;
  const scheme = useThemeScheme();
  const theme = useThemeColors();

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollOffset(scrollRef);
  /** True while a block is held or resized, so the scroll area leaves the finger alone. */
  const scrollLocked = useSharedValue(false);
  const scrollProps = useAnimatedProps(() => ({ scrollEnabled: !scrollLocked.get() }));

  // The latest blocks, for the callbacks the UI thread calls back into: they must not use a stale list.
  const tasksRef = useRef(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // ---- Where a day opens: its first block, once, for each day ----
  const scrolledFor = useRef<string | null>(null);
  useEffect(() => {
    if (scrolledFor.current === day) return;
    scrollRef.current?.scrollTo({ y: initialScrollOffset(tasks), animated: false });
    // Show the skeleton near 07:00 while fetching, then settle once on the first actual block.
    if (!loading) scrolledFor.current = day;
  }, [loading, day, tasks, scrollRef]);

  // ---- Holding a block ----
  const dragId = useSharedValue("");
  const dragTop = useSharedValue(0);
  const grab = useSharedValue(0);
  const heldDuration = useSharedValue(0);
  const heldStart = useSharedValue(0);
  const fingerX = useSharedValue(0);
  const fingerY = useSharedValue(0);
  const viewportTop = useSharedValue(0);
  const viewportHeight = useSharedValue(0);
  /** Where the scroll area is while a block is held: the one place that knows, since `scrollY` lags a frame. */
  const scrollCursor = useSharedValue(0);
  const sentStart = useSharedValue(-1);
  const sentColumn = useSharedValue(-1);
  /** How many columns the held block would sit beside at its current time: where "which column" divides. */
  const besideCount = useSharedValue(0);

  const [held, setHeld] = useState<Held | null>(null);
  const [resizing, setResizing] = useState<{ id: string; duration: number } | null>(null);
  const lastHeldStart = useRef(-1);

  const handleDragStart = useCallback(() => {
    lastHeldStart.current = -1;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleDragChange = useCallback(
    (id: string, start: number, fraction: number) => {
      if (start !== lastHeldStart.current) {
        if (lastHeldStart.current !== -1) void Haptics.selectionAsync();
        lastHeldStart.current = start;
      }
      besideCount.set(columnsBeside(tasksRef.current, id, start).length);
      setHeld({ id, start, fraction, dropped: false });
    },
    [besideCount],
  );

  /** The finger went up over `start`: save it (with the lanes of whoever moved aside) or let it go back. */
  const handleDrop = useCallback(
    (id: string, start: number, fraction: number) => {
      const list = tasksRef.current;
      const task = list.find((item) => item.id === id);
      if (!task) return setHeld(null);
      const lanes = changedLanes(list, planDrag(list, id, start, fraction));
      if (start === task.startMinutes && !lanes) return setHeld(null);
      // The saved blocks arrive a moment later; the plan stays up until they do, so nothing jumps back first.
      setHeld({ id, start, fraction, dropped: true });
      onMove(task, start, lanes);
    },
    [onMove],
  );

  const handleDragCancel = useCallback(() => setHeld(null), []);

  // The moment the blocks change after a drop, the plan has become the layout.
  useEffect(() => {
    setHeld((current) => (current?.dropped ? null : current));
  }, [tasks]);
  useEffect(() => {
    if (!held?.dropped) return;
    const timer = setTimeout(() => setHeld(null), 600);
    return () => clearTimeout(timer);
  }, [held]);

  // The worklets that follow the finger. Built once and kept (a block is only re-rendered when its own data
  // changes), they read and write shared values, and call back into React only through `scheduleOnRN`.
  const engine = useMemo(() => {
    /** Re-reads where the held block is for the finger and the scroll position, and reports what changed. */
    const refresh = () => {
      "worklet";
      const gridY = fingerY.get() - viewportTop.get() + scrollCursor.get() - GRID_TOP;
      const { rawStart, snappedStart } = dragPosition(pxToMinutes(gridY), grab.get(), heldDuration.get());
      dragTop.set(blockTop(rawStart));
      const fraction = dragFraction(fingerX.get(), GUTTER_WIDTH, areaWidth);
      const column = Math.floor(fraction * (besideCount.get() + 1));
      if (snappedStart !== sentStart.get() || column !== sentColumn.get()) {
        sentStart.set(snappedStart);
        sentColumn.set(column);
        scheduleOnRN(handleDragChange, dragId.get(), snappedStart, fraction);
      }
    };

    const drag: DragControls = {
      id: dragId,
      top: dragTop,
      begin: (id, start, duration, x, y) => {
        "worklet";
        const frame = measure(scrollRef);
        if (frame) {
          viewportTop.set(frame.pageY);
          viewportHeight.set(frame.height);
        }
        scrollCursor.set(scrollY.get());
        fingerX.set(x);
        fingerY.set(y);
        heldDuration.set(duration);
        heldStart.set(start);
        grab.set(grabOffset(pxToMinutes(y - viewportTop.get() + scrollCursor.get() - GRID_TOP), start));
        dragTop.set(blockTop(start));
        dragId.set(id);
        scrollLocked.set(true);
        sentStart.set(-1);
        sentColumn.set(-1);
        scheduleOnRN(handleDragStart);
        refresh();
      },
      move: (x, y) => {
        "worklet";
        fingerX.set(x);
        fingerY.set(y);
        refresh();
      },
      end: (id) => {
        "worklet";
        if (dragId.get() !== id) return heldStart.get();
        const gridY = fingerY.get() - viewportTop.get() + scrollCursor.get() - GRID_TOP;
        const { snappedStart } = dragPosition(pxToMinutes(gridY), grab.get(), heldDuration.get());
        scrollLocked.set(false);
        scheduleOnRN(handleDrop, id, snappedStart, dragFraction(fingerX.get(), GUTTER_WIDTH, areaWidth));
        return snappedStart;
      },
      cancel: (id) => {
        "worklet";
        if (dragId.get() !== id) return;
        scrollLocked.set(false);
        dragTop.set(
          withTiming(blockTop(heldStart.get()), { duration: 120 }, () => {
            "worklet";
            dragId.set("");
          }),
        );
        scheduleOnRN(handleDragCancel);
      },
      release: (id) => {
        "worklet";
        if (dragId.get() === id) dragId.set("");
      },
    };
    return { refresh, drag };
  }, [
    areaWidth, besideCount, dragId, dragTop, fingerX, fingerY, grab, handleDragCancel, handleDragChange, handleDragStart,
    handleDrop, heldDuration, heldStart, scrollCursor, scrollLocked, scrollRef, scrollY, sentColumn, sentStart,
    viewportHeight, viewportTop,
  ]);
  const { drag, refresh } = engine;

  // Near the top or bottom edge of the scroll area, a held block scrolls it; the block stays under the finger.
  // The bottom edge that counts is the tab bar's top, not the scroll area's own (it runs on under the bar).
  const contentHeight = GRID_TOP + GRID_HEIGHT + BOTTOM_PADDING + bottomInset;
  useFrameCallback(() => {
    "worklet";
    if (dragId.get() === "" || !scrollLocked.get()) return;
    const top = viewportTop.get();
    const speed = edgeScrollSpeed(fingerY.get(), top, top + viewportHeight.get() - bottomInset);
    if (speed === 0) return;
    const next = Math.max(0, Math.min(contentHeight - viewportHeight.get(), scrollCursor.get() + speed));
    if (next === scrollCursor.get()) return;
    scrollCursor.set(next);
    scrollTo(scrollRef, 0, next, false);
    refresh();
  });

  // ---- Resizing a block (the block does the gesture; this keeps the label and the guides) ----
  const lastResize = useRef<{ id: string; duration: number } | null>(null);
  const handleResizeStep = useCallback((id: string, duration: number | null) => {
    if (duration === null) {
      lastResize.current = null;
      return setResizing(null);
    }
    if (lastResize.current?.id === id && lastResize.current.duration !== duration) void Haptics.selectionAsync();
    lastResize.current = { id, duration };
    setResizing({ id, duration });
  }, []);

  const handleResizeCommit = useCallback(
    (task: ScheduledTask, duration: number) => onResize(task, duration),
    [onResize],
  );

  // ---- Accessibility: what dragging does, as actions ----
  const handleNudge = useCallback(
    (task: ScheduledTask, direction: -1 | 1) => {
      const next = nudgedStart(task.startMinutes, task.durationMinutes, direction);
      if (next !== task.startMinutes) onMove(task, next);
    },
    [onMove],
  );
  const handleLengthen = useCallback(
    (task: ScheduledTask, direction: -1 | 1) => {
      const next = nudgedDuration(task.startMinutes, task.durationMinutes, direction);
      if (next !== task.durationMinutes) onResize(task, next);
    },
    [onResize],
  );

  // ---- Layout ----
  const layout = useMemo(() => layoutDay(tasks), [tasks]);
  const plan = useMemo(
    () => (held ? planDrag(tasks, held.id, held.start, held.fraction) : null),
    [tasks, held],
  );
  const placementOf = (id: string) => plan?.placements.get(id) ?? layout.get(id);
  const boxFor = (id: string) => {
    const box = boxOf(placementOf(id) ?? { column: 0, columns: 1 });
    return {
      left: box.left * areaWidth + areaWidth * BLOCK_SIDE_INSET,
      width: box.width * areaWidth - areaWidth * BLOCK_SIDE_INSET * 2,
    };
  };

  const heldTask = held ? tasks.find((task) => task.id === held.id) : undefined;
  const resizingTask = resizing ? tasks.find((task) => task.id === resizing.id) : undefined;
  const guideStart = heldTask && held ? held.start : resizingTask?.startMinutes;
  const guideLength = heldTask ? heldTask.durationMinutes : resizingTask && resizing ? resizing.duration : undefined;
  const guide = useMemo<Guide | null>(
    () =>
      guideStart === undefined || guideLength === undefined
        ? null
        : { start: guideStart, end: Math.min(guideStart + guideLength, DAY_MINUTES) },
    [guideStart, guideLength],
  );

  // ---- Tapping an empty stretch makes a block there ----
  const handleGridTap = useCallback((y: number) => onCreateAt(slotAt(y)), [onCreateAt]);
  const gridTap = Gesture.Tap().onEnd((event, success) => {
    if (success) scheduleOnRN(handleGridTap, event.y);
  });

  const ink = theme.foreground;
  const lineColor = theme.border;

  return (
    <Animated.ScrollView
      animatedProps={scrollProps}
      contentContainerStyle={{ paddingTop: GRID_TOP, paddingBottom: BOTTOM_PADDING + bottomInset }}
      ref={scrollRef}
      scrollIndicatorInsets={{ bottom: bottomInset }}
      style={{ flex: 1 }}
    >
      <View style={{ flexDirection: "row", height: GRID_HEIGHT }}>
        <Gutter
          guide={guide}
          nowMinute={nowMinute}
          nowTone={nowColor(scheme)}
          mutedColor={theme["muted-foreground"]}
          pillBackground={theme.muted}
          pillBorder={lineColor}
          pillText={ink}
        />

        <View style={{ flex: 1 }}>
          <GridLines color={lineColor} />

          <GestureDetector gesture={gridTap}>
            <View style={StyleSheet.absoluteFill} />
          </GestureDetector>

          {guide ? <GuideLines guide={guide} color={ink} /> : null}
          {nowMinute !== null ? <NowLine minute={nowMinute} color={nowColor(scheme)} /> : null}

          {heldTask && held ? (
            <Ghost
              borderColor={ink}
              duration={heldTask.durationMinutes}
              left={boxFor(held.id).left}
              start={held.start}
              width={boxFor(held.id).width}
            />
          ) : null}

          {loading ? <LoadingBlocks /> : null}
          {!loading && !failed && tasks.length === 0 ? <EmptyHint color={theme["muted-foreground"]} /> : null}
          {failed ? (
            <View style={{ position: "absolute", left: 0, right: 0, top: 640 }}>
              <EmptyState
                action={<Button label="Try again" onPress={onRetry} variant="secondary" />}
                description="Check your connection and try again."
                title="Could not load this day"
              />
            </View>
          ) : null}

          <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            {tasks.map((task) => {
              const box = boxFor(task.id);
              return (
                <TimeBlock
                  color={colorOf(task)}
                  drag={drag}
                  key={task.id}
                  left={box.left}
                  lockScroll={scrollLocked}
                  onDelete={onDelete}
                  onLengthen={handleLengthen}
                  onNudge={handleNudge}
                  onOpen={onOpen}
                  onResizeCommit={handleResizeCommit}
                  onResizeStep={handleResizeStep}
                  onToggle={onToggle}
                  pending={isTempId(task.id)}
                  resizeLabel={resizing?.id === task.id ? resizeLabelFor(resizing.duration) : null}
                  scheme={scheme}
                  task={task}
                  timeLabel={
                    held?.id === task.id
                      ? formatTimeRange(held.start, held.start + task.durationMinutes)
                      : formatTimeRange(task.startMinutes, task.startMinutes + (resizing?.id === task.id ? resizing.duration : task.durationMinutes))
                  }
                  width={box.width}
                />
              );
            })}
          </View>
        </View>
      </View>
    </Animated.ScrollView>
  );
}

// ---- The pieces of the grid, drawn once ----

type GutterProps = {
  guide: Guide | null;
  nowMinute: number | null;
  nowTone: string;
  mutedColor: string;
  pillBackground: string;
  pillBorder: string;
  pillText: string;
};

/** A time in the gutter's pills: one line, never wrapped, centred on its line across the grid. */
function GutterPill({ minute, background, border, color, z }: { minute: number; background: string; border?: string; color: string; z: number }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        right: 4,
        top: minutesToPx(minute) - 9,
        minWidth: GUTTER_WIDTH - 8,
        alignItems: "center",
        borderRadius: 9,
        borderWidth: border ? StyleSheet.hairlineWidth : 0,
        borderColor: border,
        backgroundColor: background,
        paddingHorizontal: 4,
        paddingVertical: 2,
        zIndex: z,
      }}
    >
      <Text maxFontSizeMultiplier={1} numberOfLines={1} numeric style={{ color }} variant="nano">
        {formatTime(minute)}
      </Text>
    </View>
  );
}

/** The hour labels, and — while a block is moved or resized — its start and end, and the live time. */
const Gutter = memo(function Gutter(props: GutterProps) {
  const { guide, nowMinute, nowTone, mutedColor, pillBackground, pillBorder, pillText } = props;
  return (
    <View style={{ width: GUTTER_WIDTH }}>
      {HOUR_OPTIONS.map((minute) => {
        const label = gutterLabel(minute);
        // An hour under the live time or a moved block's edge is hidden, so the two never print over each other.
        const covered = (nowMinute !== null && Math.abs(minute - nowMinute) < 20) || guide?.start === minute || guide?.end === minute;
        return label && !covered ? (
          <Text
            key={minute}
            maxFontSizeMultiplier={1.2}
            numberOfLines={1}
            numeric
            style={{ position: "absolute", right: 10, top: minutesToPx(minute) - 7, color: mutedColor }}
            variant="micro"
          >
            {label}
          </Text>
        ) : null;
      })}

      {guide
        ? [guide.start, guide.end].map((minute) => (
            <GutterPill background={pillBackground} border={pillBorder} color={pillText} key={`edge-${minute}`} minute={minute} z={20} />
          ))
        : null}

      {nowMinute !== null ? <GutterPill background={nowTone} color="#ffffff" minute={nowMinute} z={30} /> : null}
    </View>
  );
});

/** Hairlines on the hour, fainter on the half hour, as on the web. */
const GridLines = memo(function GridLines({ color }: { color: string }) {
  return (
    <>
      {HOUR_OPTIONS.map((minute) => (
        <View
          key={minute}
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: minutesToPx(minute),
            height: StyleSheet.hairlineWidth,
            backgroundColor: color,
            opacity: minute % 60 === 0 ? 1 : 0.45,
          }}
        />
      ))}
    </>
  );
});

/** The start and end of the block being moved or resized, across the grid. */
function GuideLines({ guide, color }: { guide: Guide; color: string }) {
  return (
    <>
      {[guide.start, guide.end].map((minute) => (
        <View
          key={minute}
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: minutesToPx(minute),
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: color,
            borderStyle: "dashed",
            opacity: 0.3,
            zIndex: 5,
          }}
        />
      ))}
    </>
  );
}

/** Where a held block lands: its slot, outlined, with the time in the gutter. */
function Ghost(props: { start: number; duration: number; left: number; width: number; borderColor: string }) {
  const { start, duration, left, width, borderColor } = props;
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: blockTop(start),
        height: blockHeight(duration),
        left,
        width,
        borderRadius: BLOCK_RADIUS,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor,
        opacity: 0.35,
        backgroundColor: "rgba(127,127,127,0.08)",
        zIndex: 30,
      }}
    />
  );
}

/** The red line across the grid at the current time. */
function NowLine({ minute, color }: { minute: number; color: string }) {
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", left: -4, right: 0, top: minutesToPx(minute) - 4, height: 8, flexDirection: "row", alignItems: "center", zIndex: 20 }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <View style={{ flex: 1, height: 1.5, backgroundColor: color }} />
    </View>
  );
}

/** An empty day says how to start, where the day opens, without taking the taps the grid needs. */
function EmptyHint({ color }: { color: string }) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 12, right: 12, top: blockTop(8 * 60) + 6, alignItems: "center" }}>
      <Text style={{ color, textAlign: "center" }} variant="caption">
        Nothing planned yet. Tap a time to add a block, or use +.
      </Text>
    </View>
  );
}

/** Placeholders where blocks will appear, around the hour the day opens on. */
function LoadingBlocks() {
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0 }}>
      {[
        { top: blockTop(8 * 60), height: SLOT_HEIGHT * 2 - 4 },
        { top: blockTop(10 * 60 + 30), height: SLOT_HEIGHT - 4 },
        { top: blockTop(12 * 60), height: SLOT_HEIGHT * 3 - 4 },
        { top: blockTop(15 * 60), height: SLOT_HEIGHT * 2 - 4 },
      ].map((box) => (
        <View key={box.top} style={{ position: "absolute", top: box.top, left: 8, right: 8 }}>
          <Skeleton height={box.height} />
        </View>
      ))}
    </View>
  );
}
