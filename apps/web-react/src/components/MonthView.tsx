import {
  addDaysISO,
  formatDuration,
  getMonthIndex,
  getYear,
  isSameMonth,
  longDate,
  monthMatrix,
  parseISODate,
  todayISO,
  type ScheduledTask,
} from "@klndr/core";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { DateNavigatorModal } from "@/components/month-view/DateNavigatorModal";
import type { DayCell } from "@/components/month-view/DayCell";
import { MonthGrid } from "@/components/month-view/MonthGrid";
import { MonthSidebar } from "@/components/month-view/MonthSidebar";
import { MonthViewHeader } from "@/components/month-view/MonthViewHeader";

const MAX_VISIBLE = 3;

export function MonthView({ month, tasks }: { month: string; tasks: ScheduledTask[] }) {
  const navigate = useNavigate();
  const today = todayISO();
  const [isDateSelectorOpen, setDateSelectorOpen] = useState(false);

  const activeYear = getYear(month);
  const activeMonthIndex = getMonthIndex(month);
  const isCurrentMonth = isSameMonth(month, today);

  const onSelectMonth = (monthIso: string) => void navigate({ to: "/calendar", search: { m: monthIso } });
  const onOpenDay = (dateIso: string) => void navigate({ to: "/day/$date", params: { date: dateIso } });

  // The month grid reads the blocks by day, each day's list in start order.
  const byDay = useMemo(() => {
    const map = new Map<string, ScheduledTask[]>();
    for (const task of tasks) {
      const list = map.get(task.day) ?? [];
      list.push(task);
      map.set(task.day, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.startMinutes - b.startMinutes);
    return map;
  }, [tasks]);

  const days: DayCell[] = useMemo(
    () =>
      monthMatrix(month).map((iso) => {
        const date = parseISODate(iso);
        const dayTasks = byDay.get(iso) ?? [];
        return {
          iso,
          dayNumber: date.getDate(),
          inMonth: isSameMonth(iso, month),
          isToday: iso === today,
          isSelected: month === iso,
          isWeekend: date.getDay() === 0 || date.getDay() === 6,
          visible: dayTasks.slice(0, MAX_VISIBLE),
          hidden: Math.max(0, dayTasks.length - MAX_VISIBLE),
          total: dayTasks.length ? formatDuration(dayTasks.reduce((sum, task) => sum + task.durationMinutes, 0)) : "",
          label: `${longDate(iso)}, ${dayTasks.length} ${dayTasks.length === 1 ? "block" : "blocks"}`,
        };
      }),
    [month, byDay, today],
  );

  const upcoming = useMemo(() => {
    const end = addDaysISO(today, 14);
    return tasks
      .filter((task) => task.day >= today && task.day <= end)
      .sort((a, b) => a.day.localeCompare(b.day) || a.startMinutes - b.startMinutes)
      .slice(0, 6);
  }, [tasks, today]);

  const monthStats = useMemo(() => {
    const inMonth = tasks.filter((task) => isSameMonth(task.day, month));
    return {
      blocks: inMonth.length,
      hours: Math.round(inMonth.reduce((sum, task) => sum + task.durationMinutes, 0) / 60),
      done: inMonth.filter((task) => task.completed).length,
    };
  }, [tasks, month]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <MonthViewHeader
        month={month}
        today={today}
        isCurrentMonth={isCurrentMonth}
        isDateSelectorOpen={isDateSelectorOpen}
        monthStats={monthStats}
        onOpenSelector={() => setDateSelectorOpen(true)}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <MonthGrid days={days} />
        <MonthSidebar upcoming={upcoming} />
      </div>

      <DateNavigatorModal
        open={isDateSelectorOpen}
        month={month}
        activeYear={activeYear}
        activeMonthIndex={activeMonthIndex}
        today={today}
        onClose={() => setDateSelectorOpen(false)}
        onSelectMonth={onSelectMonth}
        onOpenDay={onOpenDay}
      />
    </div>
  );
}
