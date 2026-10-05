import { addDaysISO, clampStart, isValidISODate, nowMinutes, snapMinutes, todayISO, type ScheduledTask } from "@klndr/core";
import {
  dayStats,
  dayTasksQuery,
  useCategoryColor,
  useChecklist,
  useData,
  useDayTimeline,
} from "@klndr/data";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import { DayHeader } from "@/components/day/day-header";
import { DayTimeline } from "@/components/day/day-timeline";
import { useClock } from "@/components/day/use-clock";
import { RoutinesShelf } from "@/components/day/routines-shelf";
import { Plus } from "@/icons";
import { useThemeColors } from "@/theme/tokens";

const SLIDE_MS = 180;
/** A swipe goes through if it travels a quarter of the screen, or is flicked. */
const SWIPE_DISTANCE = 0.25;
const SWIPE_VELOCITY = 600;
/** The neighbours of the day on screen are fetched ahead, so a swipe lands on blocks and not on a skeleton. */
const PREFETCH_STALE_MS = 30_000;

/**
 * The Day tab: the timeline for one day, with its routines above it. Swipe sideways (or use the arrows) to
 * change day; the date opens a calendar. Everything shown and changed here goes through `useDayTimeline`, so
 * a change appears at once, is put back if saving fails, and can be undone.
 */
export default function DayTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const clock = useClock();

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
  const colorOf = useCategoryColor();
  const { query } = timeline;
  const stats = useMemo(() => dayStats(timeline.tasks), [timeline.tasks]);
  const isToday = day === clock.today;

  // Fetch the days either side ahead of time.
  const { api } = useData();
  const queryClient = useQueryClient();
  useEffect(() => {
    for (const neighbour of [addDaysISO(day, -1), addDaysISO(day, 1)]) {
      void queryClient.prefetchQuery({ ...dayTasksQuery(api, neighbour), staleTime: PREFETCH_STALE_MS });
    }
  }, [api, day, queryClient]);

  // ---- Changing day: the page slides away, the new day slides in from the other side ----
  const slide = useSharedValue(0);
  const arriving = useRef<1 | -1 | 0>(0);

  const commitDay = useCallback((direction: 1 | -1) => {
    arriving.current = direction;
    setDay((current) => addDaysISO(current, direction));
  }, []);

  useEffect(() => {
    if (arriving.current === 0) return;
    const from = arriving.current * width;
    arriving.current = 0;
    slide.set(from);
    slide.set(withTiming(0, { duration: reducedMotion ? 0 : SLIDE_MS }));
  }, [day, slide, width, reducedMotion]);

  /** Slides the page off in the direction of travel, then swaps the day (see the effect above). */
  const changeDay = useCallback(
    (direction: 1 | -1) => {
      if (reducedMotion) return commitDay(direction);
      slide.set(
        withTiming(-direction * width, { duration: reducedMotion ? 0 : SLIDE_MS }, (finished) => {
          if (finished) scheduleOnRN(commitDay, direction);
        }),
      );
    },
    [commitDay, reducedMotion, slide, width],
  );

  const goToday = useCallback(() => {
    arriving.current = 0;
    slide.set(0);
    setDay(todayISO());
  }, [slide]);

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
      slide.set(
        withTiming(-direction * width, { duration: reducedMotion ? 0 : SLIDE_MS }, (finished) => {
          if (finished) scheduleOnRN(commitDay, direction);
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
        day={day}
        isToday={isToday}
        onNext={() => changeDay(1)}
        onPickDate={() => router.push({ pathname: "/date-sheet", params: { day } })}
        onPrevious={() => changeDay(-1)}
        onRedo={() => void timeline.redo()}
        onToday={goToday}
        onUndo={() => void timeline.undo()}
        stats={stats}
      />

      <Animated.View style={[{ flex: 1 }, slideStyle]}>
        {checklist.hasChecklist ? (
          <RoutinesShelf
            completedIds={checklist.completedIds}
            items={checklist.items}
            onToggle={checklist.toggle}
          />
        ) : null}

        <GestureDetector gesture={swipe}>
          <View style={{ flex: 1 }}>
            <DayTimeline
              key={day}
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
        accessibilityLabel="New block"
        accessibilityRole="button"
        onPress={() => createAt(clampStart(snapMinutes(nowMinutes(), 30)))}
        style={({ pressed }) => ({
          position: "absolute",
          right: 16,
          bottom: insets.bottom + 16,
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primary,
          opacity: pressed ? 0.85 : 1,
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        })}
      >
        <Plus color={colors["primary-foreground"]} size={26} />
      </Pressable>
    </View>
  );
}
