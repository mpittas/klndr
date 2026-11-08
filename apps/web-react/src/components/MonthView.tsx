import {
  addMonths,
  formatDuration,
  isSameMonth,
  longDate,
  monthMatrix,
  nowMinutes,
  parseISODate,
  snapMinutes,
  todayISO,
  weekdayLabels,
  type ScheduledTask,
} from "@klndr/core";
import { useLibraryActions, useTaskActions, useTemplates } from "@klndr/data";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";

import { DatePickerModal } from "@/components/DatePickerModal";
import { LibraryModal } from "@/components/LibraryModal";
import type { DayCell } from "@/components/month-view/DayCell";
import { MonthGrid } from "@/components/month-view/MonthGrid";
import { CategoryFilter } from "@/components/planner/CategoryFilter";
import { PlannerLayout } from "@/components/planner/PlannerLayout";
import { PlannerSidebar } from "@/components/planner/PlannerSidebar";
import { PlannerToolbar } from "@/components/planner/PlannerToolbar";
import { nextFreeStart } from "@/components/planner/planning";
import { useActivityPlanning } from "@/components/planner/useActivityPlanning";
import { usePlannerShortcuts } from "@/components/planner/usePlannerShortcuts";
import { TaskEditor, type EditorRequest } from "@/components/TaskEditor";
import { useHiddenCategories } from "@/hooks/useHiddenCategories";
import { useSidebarOpen } from "@/hooks/useSidebarOpen";
import { useMediaQuery } from "@/hooks/useViewport";
import { useWeekStartsOnMonday } from "@/hooks/useWeekStart";
import { useLibrary } from "@/lib/library";

const NO_TEMPLATES: never[] = [];

/**
 * The month page, in the planner's frame (`PlannerLayout`, `PlannerToolbar` and `PlannerSidebar`, as the week and
 * the day): the month as a grid filling the screen, the mini calendar and the activities in the sidebar (drop
 * one on a day to plan it), and the Categories control in the toolbar.
 *
 * It owns the block editor (opened from the toolbar, a cell's "+" or an activity), the date picker and the keys
 * (`usePlannerShortcuts`).
 */
export function MonthView({ month, tasks }: { month: string; tasks: ScheduledTask[] }) {
  const navigate = useNavigate();
  const today = todayISO();
  const isCurrentMonth = isSameMonth(month, today);
  const weekStartsOnMonday = useWeekStartsOnMonday();
  const isDesktop = useMediaQuery("(min-width: 64rem)");
  const sidebar = useSidebarOpen();
  const categoryFilter = useHiddenCategories();
  const hidden = categoryFilter.hidden;

  const templates = useTemplates().data ?? NO_TEMPLATES;
  const { saveTask, deleteTask } = useTaskActions();
  const library = useLibraryActions();
  const { open: libraryOpen, show: showLibrary } = useLibrary();
  const planning = useActivityPlanning(tasks, today);

  const [picking, setPicking] = useState(false);
  const [editor, setEditor] = useState<EditorRequest | null>(null);

  const firstOfMonth = `${month.slice(0, 7)}-01`;

  // A new block starts today, or on the first of the month when another month is on screen.
  const addBlock = useCallback(
    (day?: string) => {
      const target = day ?? (isCurrentMonth ? today : firstOfMonth);
      setEditor({
        mode: "create",
        day: target,
        startMinutes: target === today ? snapMinutes(nowMinutes(), 30) : 9 * 60,
        template: null,
      });
    },
    [isCurrentMonth, firstOfMonth, today],
  );

  const goToMonth = (value: string) => void navigate({ to: "/calendar", search: { m: value } });

  usePlannerShortcuts(
    {
      previous: () => goToMonth(addMonths(month, -1).slice(0, 7)),
      next: () => goToMonth(addMonths(month, 1).slice(0, 7)),
      today: () => goToMonth(today.slice(0, 7)),
      create: () => addBlock(),
      goTo: () => setPicking(true),
      toggleSidebar: sidebar.toggle,
    },
    Boolean(editor || picking || libraryOpen),
  );

  // The month on screen's blocks, before the filter (the Categories control's hours) and after it (the grid and
  // the toolbar's totals).
  const monthTasks = useMemo(() => tasks.filter((task) => isSameMonth(task.day, month)), [tasks, month]);
  const shown = useMemo(
    () => (hidden.length ? tasks.filter((task) => !hidden.includes(task.category)) : tasks),
    [tasks, hidden],
  );
  const stats = useMemo(() => {
    const inMonth = shown.filter((task) => isSameMonth(task.day, month));
    return {
      minutes: inMonth.reduce((sum, task) => sum + task.durationMinutes, 0),
      done: inMonth.filter((task) => task.completed).length,
      count: inMonth.length,
    };
  }, [shown, month]);

  // The grid reads the blocks by day, each day's list in start order.
  const byDay = useMemo(() => {
    const map = new Map<string, ScheduledTask[]>();
    for (const task of shown) {
      const list = map.get(task.day) ?? [];
      list.push(task);
      map.set(task.day, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.startMinutes - b.startMinutes);
    return map;
  }, [shown]);

  const days: DayCell[] = useMemo(
    () =>
      monthMatrix(month, weekStartsOnMonday).map((iso) => {
        const date = parseISODate(iso);
        const dayTasks = byDay.get(iso) ?? [];
        return {
          iso,
          dayNumber: date.getDate(),
          inMonth: isSameMonth(iso, month),
          isToday: iso === today,
          isPast: iso < today,
          isWeekend: date.getDay() === 0 || date.getDay() === 6,
          tasks: dayTasks,
          total: dayTasks.length ? formatDuration(dayTasks.reduce((sum, task) => sum + task.durationMinutes, 0)) : "",
          done: dayTasks.filter((task) => task.completed).length,
          count: dayTasks.length,
          label: `${longDate(iso)}, ${dayTasks.length} ${dayTasks.length === 1 ? "block" : "blocks"}`,
        };
      }),
    [month, byDay, today, weekStartsOnMonday],
  );

  const todayColumn = isCurrentMonth ? days.findIndex((day) => day.isToday) % 7 : null;

  return (
    <PlannerLayout
      sidebarLabel="Calendar and activities"
      sidebarOpen={sidebar.open}
      sidebar={
        isDesktop ? (
          <PlannerSidebar
            view="month"
            anchor={month}
            today={today}
            weekStartsOnMonday={weekStartsOnMonday}
            onPickDate={(date) => goToMonth(date.slice(0, 7))}
            templates={templates}
            // Clicked, an activity opens in the editor on today (or the 1st), after that day's last block.
            onPickActivity={(template) => {
              const target = isCurrentMonth ? today : firstOfMonth;
              const dayTasks = tasks.filter((task) => task.day === target);
              setEditor({
                mode: "create",
                day: target,
                startMinutes: nextFreeStart(dayTasks, target, today, template.defaultDuration),
                template,
              });
            }}
            onDragActivity={planning.startDrag}
            onDropActivityEnd={planning.endDrag}
            onMoveActivity={(template, category) => void library.moveTemplate(template, category)}
            onManage={() => showLibrary()}
          />
        ) : undefined
      }
      toolbar={
        <PlannerToolbar
          view="month"
          anchor={month}
          today={today}
          isCurrent={isCurrentMonth}
          stats={stats}
          filter={
            <CategoryFilter
              tasks={monthTasks}
              period="month"
              hidden={hidden}
              onToggle={categoryFilter.toggle}
              onOnly={categoryFilter.only}
              onShowAll={categoryFilter.showAll}
            />
          }
          pickerOpen={picking}
          onOpenPicker={() => setPicking(true)}
          onCreate={() => addBlock()}
          sidebar={isDesktop ? { open: sidebar.open, onToggle: sidebar.toggle } : undefined}
        />
      }
      dialogs={
        <>
          <DatePickerModal
            open={picking}
            initial={month}
            activeMonth={month.slice(0, 7)}
            today={today}
            weekStartsOnMonday={weekStartsOnMonday}
            onClose={() => setPicking(false)}
          />

          <TaskEditor
            request={editor}
            templates={templates}
            onClose={() => setEditor(null)}
            onSave={(vars) => saveTask(vars)}
            onDelete={(task) => deleteTask(task)}
            onDeleteTemplate={(id) => library.deleteTemplate({ id })}
          />

          {/* After the editor so it opens on top of it (e.g. from the category picker). */}
          <LibraryModal templates={templates} />
        </>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        <MonthGrid
          days={days}
          weekdays={weekdayLabels(weekStartsOnMonday)}
          todayColumn={todayColumn}
          onAddBlock={addBlock}
          dropping={planning.dragging}
          onDropActivity={(day) => {
            if (planning.dragging) planning.place(planning.dragging, day);
          }}
        />
      </div>
    </PlannerLayout>
  );
}
