import { addDaysISO, type ScheduledTask } from "@klndr/core";
import { useRangeTasks } from "@klndr/data";
import { useMemo } from "react";

import { AgendaCard } from "@/components/month-view/AgendaCard";
import { CategoryCard } from "@/components/month-view/CategoryCard";
import { ShortcutsCard } from "@/components/month-view/ShortcutsCard";
import { categoryBreakdown } from "@/components/month-view/stats";
import { TodayCard } from "@/components/month-view/TodayCard";

const AGENDA_DAYS = 14;
const NONE: ScheduledTask[] = [];

const inOrder = (a: ScheduledTask, b: ScheduledTask) => a.day.localeCompare(b.day) || a.startMinutes - b.startMinutes;

/**
 * The calendar's sidebar: today's progress, the agenda of the next two weeks (blocks can be ticked off in
 * place), the month's time by category (which doubles as the category filter) and the keyboard shortcuts.
 *
 * The agenda and today come from their own query, so they stay the same whichever month the grid shows;
 * the category breakdown is of the month on screen, unfiltered, so every category stays there to be picked.
 */
export function MonthSidebar({
  today,
  monthTasks,
  categories,
  onToggleCategory,
  onClearCategories,
  onAddBlock,
}: {
  today: string;
  /** The month on screen's blocks, before the category filter. */
  monthTasks: ScheduledTask[];
  /** The categories being shown; empty means all. */
  categories: string[];
  onToggleCategory: (category: string) => void;
  onClearCategories: () => void;
  onAddBlock: (day: string) => void;
}) {
  const { data, isPending } = useRangeTasks(today, addDaysISO(today, AGENDA_DAYS - 1));
  const upcoming = data ?? NONE;

  const todays = useMemo(
    () => upcoming.filter((task) => task.day === today).sort(inOrder),
    [upcoming, today],
  );
  const agenda = useMemo(
    () =>
      upcoming
        .filter((task) => categories.length === 0 || categories.includes(task.category))
        .sort(inOrder),
    [upcoming, categories],
  );
  const shares = useMemo(() => categoryBreakdown(monthTasks), [monthTasks]);

  return (
    <aside className="space-y-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain lg:[scrollbar-width:thin]">
      <TodayCard today={today} tasks={todays} onAddBlock={onAddBlock} />
      <AgendaCard
        today={today}
        tasks={agenda}
        loading={isPending}
        filtered={categories.length > 0}
        onAddBlock={onAddBlock}
      />
      <CategoryCard shares={shares} selected={categories} onToggle={onToggleCategory} onClear={onClearCategories} />
      <ShortcutsCard />
    </aside>
  );
}
