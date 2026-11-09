import { addDaysISO, clampStart, isValidISODate, nowMinutes, snapMinutes, todayISO, type ScheduledTask } from "@klndr/core";
import {
  dayStats,
  dayTasksQuery,
  useCategoryColor,
  useChecklist,
  useData,
  useDayNotes,
  useDayTimeline,
  useProfile,
  useRangeTasks,
} from "@klndr/data";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { useAuth } from "@/auth";
import { DayHeader } from "@/components/day/day-header";
import { DayTimeline } from "@/components/day/day-timeline";
import { useClock } from "@/components/day/use-clock";
import { RoutinesShelf } from "@/components/day/routines-shelf";
import { weekOf } from "@/components/day/week-strip";
import { Plus } from "@/icons";
import { useTabBarInset } from "@/lib/insets";
import { useThemeColors } from "@/theme/tokens";

const SLIDE_MS = 180;
/** A swipe goes through if it travels a quarter of the screen, or is flicked. */
const SWIPE_DISTANCE = 0.25;
const SWIPE_VELOCITY = 600;
/** How far off the edge a tapped-to day starts its glide in, as a share of the width (a swiped one starts fully off). */
const TAP_ARRIVAL = 0.3;
/** The neighbours of the day on screen are fetched ahead, so a swipe lands on blocks and not on a skeleton. */
const PREFETCH_STALE_MS = 30_000;
const FAB_SIZE = 56;
const NONE: ScheduledTask[] = [];

/**
 * The Day tab: the timeline for one day, with its week above it and its routines. Swipe the timeline sideways (or
 * tap a day in the week) to change day; the month opens a calendar. Everything shown and changed here goes through
 * `useDayTimeline`, so a change appears at once, is put back if saving fails, and can be undone.
 */
export default function DayTab() {
  const router = useRouter();
  const tabBarInset = useTabBarInset();
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const clock = useClock();
  const { state } = useAuth();

  // The day on screen. Other screens send people here with `?day=YYYY-MM-DD`; that is read once and cleared.
  const params = useLocalSearchParams<{ day?: string }>();
  const [day, setDay] = useState(() => (isValidISODate(params.day) ? params.day : todayISO()));
  useEffect(() => {
    if (!isValidISODate(params.day)) return;
    setDay(params.day);
    router.setParams({ day: undefined });
  }, [params.day, router]);

  const timeline = useDayTimeline(day);
  const checklist = useChecklist(day);
  const notes = useDayNotes(day);
  const colorOf = useCategoryColor();
  const { query } = timeline;
  const stats = useMemo(() => dayStats(timeline.tasks), [timeline.tasks]);
  const isToday = day === clock.today;

  // The week strip's days and the blocks that put dots under them.
  const profile = useProfile().data ?? (state.status === "signed-in" ? state.profile : null);
  const mondayFirst = profile?.weekStartsOnMonday ?? true;
  const week = useMemo(() => weekOf(day, mondayFirst), [day, mondayFirst]);
  const weekTasks = useRangeTasks(week[0], week[6]).data ?? NONE;

  // Fetch the days either side ahead of time.
  const { api } = useData();
  const queryClient = useQueryClient();
  useEffect(() => {
    for (const neighbour of [addDaysISO(day, -1), addDaysISO(day, 1)]) {
      void queryClient.prefetchQuery({ ...dayTasksQuery(api, neighbour), staleTime: PREFETCH_STALE_MS });
    }
  }, [api, day, queryClient]);

  // ---- Changing day: the new day slides in from the side it lies on ----
  const slide = useSharedValue(0);
  /** Where the arriving page starts, as a signed share of the width, or 0 when nothing is arriving. */
  const arriving = useRef(0);

  /** Swaps the day; the effect below brings the new page in from `from` (a signed share of the width). */
  const commitDay = useCallback((target: string, from: number) => {
    arriving.current = from;
    setDay(target);
  }, []);

  useEffect(() => {
    if (arriving.current === 0) return;
    const from = arriving.current * width;
    arriving.current = 0;
    slide.set(from);
    slide.set(withTiming(0, { duration: reducedMotion ? 0 : SLIDE_MS }));
  }, [day, slide, width, reducedMotion]);

  /**
   * A tap on another day (the week strip, Today): the day changes at once and the new page glides in from that
   * side. It does not wait for the old page to slide away first, so a tap is never lost to an interrupted
   * animation, and a quick run of taps keeps up with the finger.
   */
  const goTo = useCallback(
    (target: string) => {
      if (target === day) return;
      commitDay(target, target > day ? TAP_ARRIVAL : -TAP_ARRIVAL);
    },
    [commitDay, day],
  );

  const goToday = useCallback(() => goTo(todayISO()), [goTo]);

  const swipe = Gesture.Pan()
    .maxPointers(1)
    .activeOffsetX([-24, 24])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      slide.set(event.translationX);
    })
    .onEnd((event) => {
      const far = Math.abs(event.translationX) > width * SWIPE_DISTANCE || Math.abs(event.velocityX) > SWIPE_VELOCITY;
      if (!far) {
        slide.set(withTiming(0, { duration: reducedMotion ? 0 : SLIDE_MS }));
        return;
      }
      const direction = event.translationX < 0 ? 1 : -1;
      const target = addDaysISO(day, direction);
      slide.set(
        withTiming(-direction * width, { duration: reducedMotion ? 0 : SLIDE_MS }, (finished) => {
          if (finished) scheduleOnRN(commitDay, target, direction);
        }),
      );
    })
    .onFinalize((_event, success) => {
      if (!success) slide.set(withTiming(0, { duration: reducedMotion ? 0 : SLIDE_MS }));
    });

  const slideStyle = useAnimatedStyle(() => ({ transform: [{ translateX: slide.get() }] }));

  // ---- Opening the editor ----
  const createAt = useCallback(
    (startMinutes: number) => router.push({ pathname: "/task-editor", params: { day, start: String(startMinutes) } }),
    [day, router],
  );
  const open = useCallback(
    (task: ScheduledTask) => router.push({ pathname: "/task-editor", params: { day, taskId: task.id } }),
    [day, router],
  );

  return (
    <View className="flex-1 bg-background">
      <DayHeader
        canRedo={timeline.canRedo}
        canUndo={timeline.canUndo}
        colorOf={colorOf}
        day={day}
        mondayFirst={mondayFirst}
        onPickDate={() => router.push({ pathname: "/date-sheet", params: { day } })}
        onRedo={() => void timeline.redo()}
        onSelectDay={goTo}
        onToday={goToday}
        onUndo={() => void timeline.undo()}
        stats={stats}
        today={clock.today}
        weekTasks={weekTasks}
      />

      <Animated.View style={[{ flex: 1 }, slideStyle]}>
        <RoutinesShelf
          completedIds={checklist.completedIds}
          hasNotes={Boolean(notes.data?.text.trim())}
          items={checklist.items}
          onManage={() => router.push({ pathname: "/day-sheet", params: { day, tab: "checklist" } })}
          onOpenNotes={() => router.push({ pathname: "/day-sheet", params: { day, tab: "notes" } })}
          onToggle={checklist.toggle}
        />

        <GestureDetector gesture={swipe}>
          <View style={{ flex: 1 }}>
            <DayTimeline
              key={day}
              bottomInset={tabBarInset}
              colorOf={colorOf}
              day={day}
              failed={query.isError && !query.data}
              loading={query.isPending}
              nowMinute={isToday ? clock.nowMinute : null}
              onCreateAt={createAt}
              onDelete={timeline.deleteTask}
              onMove={timeline.moveTask}
              onOpen={open}
              onResize={timeline.resizeTask}
              onRetry={() => void query.refetch()}
              onToggle={timeline.toggleComplete}
              tasks={timeline.tasks}
            />
          </View>
        </GestureDetector>
      </Animated.View>

      <Pressable
        accessibilityHint={isToday ? "Starts a block at the next half hour" : undefined}
        accessibilityLabel="New block"
        accessibilityRole="button"
        className="items-center justify-center rounded-full bg-primary"
        onPress={() => createAt(isToday ? clampStart(snapMinutes(nowMinutes(), 30)) : 9 * 60)}
        style={({ pressed }) => ({
          position: "absolute",
          right: 16,
          bottom: tabBarInset + 16,
          width: FAB_SIZE,
          height: FAB_SIZE,
          transform: [{ scale: pressed ? 0.94 : 1 }],
          shadowColor: "#000",
          shadowOpacity: 0.22,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        })}
      >
        <Plus color={colors["primary-foreground"]} size={26} strokeWidth={2.4} />
      </Pressable>
    </View>
  );
}
