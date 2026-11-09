import {
  addDaysISO,
  addMonths,
  categoryBreakdown,
  clampStart,
  isSameMonth,
  isValidISODate,
  longDate,
  monthMatrix,
  monthRange,
  nowMinutes,
  parseISODate,
  snapMinutes,
  weekdayLabels,
  type ScheduledTask,
} from "@klndr/core";
import { rangeTasksQuery, useCategoryColor, useData, useProfile, useRangeTasks, useTaskActions } from "@klndr/data";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/auth";
import { AgendaCard } from "@/components/calendar/agenda-card";
import { CategoryFilterCard } from "@/components/calendar/category-filter-card";
import { DayCard } from "@/components/calendar/day-card";
import { MonthGrid } from "@/components/calendar/month-grid";
import { MonthHeader } from "@/components/calendar/month-header";
import type { DayCell } from "@/components/calendar/types";
import { useClock } from "@/components/day/use-clock";
import { useTabBarInset } from "@/lib/insets";
import { useSlide } from "@/lib/use-slide";

const AGENDA_DAYS = 14;
const PREFETCH_STALE_MS = 30_000;
const NONE: ScheduledTask[] = [];

/** The first of the month a day, or a `YYYY-MM`, belongs to; today's month for anything else. */
const monthOf = (value: string | undefined, fallback: string) => {
  const candidate = value && /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value;
  return `${(isValidISODate(candidate) ? candidate : fallback).slice(0, 7)}-01`;
};

const inOrder = (a: ScheduledTask, b: ScheduledTask) => a.day.localeCompare(b.day) || a.startMinutes - b.startMinutes;

/**
 * The Calendar tab: the month as a grid (swipe or use the arrows to change month), the chosen day's blocks under it,
 * the agenda of the two weeks after today, and the month's time by category. A tap on a day chooses it, a second tap opens
 * it in the Day tab, and holding one starts a block on it. The category list filters everything above it, as on the
 * web.
 */
export default function CalendarTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarInset = useTabBarInset();
  const queryClient = useQueryClient();
  const { api } = useData();
  const { state } = useAuth();
  const { today } = useClock();
  const colorOf = useCategoryColor();
  const { toggleComplete } = useTaskActions();

  // The month on screen. Other screens send people here with `?m=YYYY-MM`; that is read once and cleared.
  const params = useLocalSearchParams<{ m?: string }>();
  const [month, setMonth] = useState(() => monthOf(params.m, today));
  useEffect(() => {
    if (!params.m) return;
    setMonth(monthOf(params.m, today));
    router.setParams({ m: undefined });
  }, [params.m, router, today]);

  const profile = useProfile().data ?? (state.status === "signed-in" ? state.profile : null);
  const mondayFirst = profile?.weekStartsOnMonday ?? true;
  const isCurrentMonth = isSameMonth(month, today);

  // The chosen day. It stays with its month: on another month the first of it is chosen (today on this month).
  const [chosen, setChosen] = useState(today);
  const selected = isSameMonth(chosen, month) ? chosen : isCurrentMonth ? today : month;

  const range = monthRange(month, mondayFirst);
  const monthQuery = useRangeTasks(range.from, range.to);
  const tasks = monthQuery.data ?? NONE;
  // What comes after today: today itself is the day card's, chosen when the tab opens.
  const agendaQuery = useRangeTasks(addDaysISO(today, 1), addDaysISO(today, AGENDA_DAYS));
  const upcoming = agendaQuery.data ?? NONE;

  // The months either side are fetched ahead of time, so a swipe lands on blocks and not on an empty grid.
  useEffect(() => {
    for (const offset of [-1, 1]) {
      const { from, to } = monthRange(addMonths(month, offset), mondayFirst);
      void queryClient.prefetchQuery({ ...rangeTasksQuery(api, from, to), staleTime: PREFETCH_STALE_MS });
    }
  }, [api, month, mondayFirst, queryClient]);

  // ---- The category filter: none picked means all of them ----
  const [categories, setCategories] = useState<string[]>([]);
  const toggleCategory = useCallback(
    (category: string) =>
      setCategories((current) => (current.includes(category) ? current.filter((name) => name !== category) : [...current, category])),
    [],
  );
  const clearCategories = useCallback(() => setCategories([]), []);

  const shown = useMemo(
    () => (categories.length ? tasks.filter((task) => categories.includes(task.category)) : tasks),
    [tasks, categories],
  );
  // The breakdown is of the month on screen, before the filter, so every category stays there to be picked.
  const monthTasks = useMemo(() => tasks.filter((task) => isSameMonth(task.day, month)), [tasks, month]);
  const shares = useMemo(() => categoryBreakdown(monthTasks), [monthTasks]);

  const byDay = useMemo(() => {
    const map = new Map<string, ScheduledTask[]>();
    for (const task of shown) map.set(task.day, [...(map.get(task.day) ?? []), task]);
    for (const list of map.values()) list.sort((a, b) => a.startMinutes - b.startMinutes);
    return map;
  }, [shown]);

  const days: DayCell[] = useMemo(
    () =>
      monthMatrix(month, mondayFirst).map((iso) => {
        const date = parseISODate(iso);
        const dayTasks = byDay.get(iso) ?? NONE;
        return {
          iso,
          dayNumber: date.getDate(),
          inMonth: isSameMonth(iso, month),
          isToday: iso === today,
          isPast: iso < today,
          isWeekend: date.getDay() === 0 || date.getDay() === 6,
          tasks: dayTasks,
          done: dayTasks.filter((task) => task.completed).length,
          count: dayTasks.length,
          label: `${longDate(iso)}, ${dayTasks.length} ${dayTasks.length === 1 ? "block" : "blocks"}`,
        };
      }),
    [month, mondayFirst, byDay, today],
  );

  const stats = useMemo(() => {
    const inMonth = shown.filter((task) => isSameMonth(task.day, month));
    return {
      blocks: inMonth.length,
      minutes: inMonth.reduce((sum, task) => sum + task.durationMinutes, 0),
      done: inMonth.filter((task) => task.completed).length,
    };
  }, [shown, month]);

  const agenda = useMemo(
    () => upcoming.filter((task) => categories.length === 0 || categories.includes(task.category)).sort(inOrder),
    [upcoming, categories],
  );

  // ---- Paging between months ----
  const stepMonth = useCallback((direction: 1 | -1) => setMonth((current) => monthOf(addMonths(current, direction), today)), [today]);
  const { slideStyle, step, swipe } = useSlide(month, stepMonth);

  // ---- Going places ----
  const openDay = useCallback((day: string) => router.navigate({ pathname: "/", params: { day } }), [router]);
  const selectDay = useCallback(
    (day: string) => {
      // A second tap on the chosen day opens it; a day of the month either side brings that month in.
      if (day === selected) return openDay(day);
      setChosen(day);
      if (!isSameMonth(day, month)) setMonth(monthOf(day, today));
    },
    [month, openDay, selected, today],
  );
  const addBlock = useCallback(
    (day: string) =>
      router.push({
        pathname: "/task-editor",
        // A new block on today starts at the next half hour; on any other day, at nine.
        params: { day, start: String(day === today ? clampStart(snapMinutes(nowMinutes(), 30)) : 9 * 60) },
      }),
    [router, today],
  );
  const editTask = useCallback(
    (task: ScheduledTask) => router.push({ pathname: "/task-editor", params: { day: task.day, taskId: task.id } }),
    [router],
  );

  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([monthQuery.refetch(), agendaQuery.refetch()]);
    setRefreshing(false);
  };

  return (
    <ScrollView
      className="bg-canvas"
      contentContainerClassName="gap-lg px-md"
      contentContainerStyle={{ paddingBottom: tabBarInset + 24, paddingTop: insets.top + 4 }}
      refreshControl={<RefreshControl onRefresh={() => void refresh()} refreshing={refreshing} />}
      scrollIndicatorInsets={{ bottom: tabBarInset }}
    >
      <MonthHeader
        isCurrentMonth={isCurrentMonth}
        month={month}
        onNext={() => step(1)}
        onPickMonth={() => router.push({ pathname: "/month-sheet", params: { month } })}
        onPrevious={() => step(-1)}
        onToday={() => {
          setMonth(monthOf(today, today));
          setChosen(today);
        }}
      />

      <GestureDetector gesture={swipe}>
        <Animated.View style={[slideStyle, { marginTop: -8 }]}>
          <MonthGrid
            colorOf={colorOf}
            days={days}
            onAddBlock={addBlock}
            onSelectDay={selectDay}
            selected={selected}
            weekdays={weekdayLabels(mondayFirst)}
          />
        </Animated.View>
      </GestureDetector>

      <DayCard
        colorOf={colorOf}
        day={selected}
        filtered={categories.length > 0}
        onAddBlock={addBlock}
        onEdit={editTask}
        onOpenDay={openDay}
        onToggle={(task) => void toggleComplete(task)}
        tasks={byDay.get(selected) ?? NONE}
        today={today}
      />

      <AgendaCard
        filtered={categories.length > 0}
        loading={agendaQuery.isPending}
        onEdit={editTask}
        onOpenDay={openDay}
        tasks={agenda}
        today={today}
      />

      <CategoryFilterCard
        onClear={clearCategories}
        onToggle={toggleCategory}
        selected={categories}
        shares={shares}
        stats={stats}
      />
    </ScrollView>
  );
}
