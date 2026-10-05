import {
  formatDuration,
  isSameMonth,
  longDate,
  monthMatrix,
  nowMinutes,
  parseISODate,
  snapMinutes,
  todayISO,
  addMonths,
  type ScheduledTask,
} from "@klndr/core";
import { useLibraryActions, useTaskActions, useTemplates } from "@klndr/data";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useEffectEvent, useMemo, useState } from "react";

import { DatePickerModal } from "@/components/DatePickerModal";
import { LibraryModal } from "@/components/LibraryModal";
import type { DayCell } from "@/components/month-view/DayCell";
import { MonthGrid } from "@/components/month-view/MonthGrid";
import { MonthSidebar } from "@/components/month-view/MonthSidebar";
import { MonthViewHeader } from "@/components/month-view/MonthViewHeader";
import { TaskEditor, type EditorRequest } from "@/components/TaskEditor";
import { useLibrary } from "@/lib/library";

const MAX_VISIBLE = 3;
const NO_TEMPLATES: never[] = [];

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/**
 * The calendar page: the month as a grid, with the header's controls and a sidebar (today, the agenda, the
 * categories, shortcuts). It owns what they share: the category filter, the block editor (opened from the
 * header, a cell's "+" or the sidebar) and the keys the page answers to.
 */
export function MonthView({ month, tasks }: { month: string; tasks: ScheduledTask[] }) {
  const navigate = useNavigate();
  const today = todayISO();
  const isCurrentMonth = isSameMonth(month, today);

  const templates = useTemplates().data ?? NO_TEMPLATES;
  const { saveTask, deleteTask } = useTaskActions();
  const library = useLibraryActions();
  const { open: libraryOpen } = useLibrary();

  const [isDateSelectorOpen, setDateSelectorOpen] = useState(false);
  const [editor, setEditor] = useState<EditorRequest | null>(null);
  /** The categories being shown; none picked means all of them. */
  const [categories, setCategories] = useState<string[]>([]);

  const toggleCategory = useCallback(
    (category: string) =>
      setCategories((current) =>
        current.includes(category) ? current.filter((name) => name !== category) : [...current, category],
      ),
    [],
  );
  const clearCategories = useCallback(() => setCategories([]), []);

  // A new block starts today, or on the first of the month when another month is on screen.
  const addBlock = useCallback(
    (day?: string) => {
      const target = day ?? (isCurrentMonth ? today : `${month.slice(0, 7)}-01`);
      setEditor({
        mode: "create",
        day: target,
        startMinutes: target === today ? snapMinutes(nowMinutes(), 30) : 9 * 60,
        template: null,
      });
    },
    [isCurrentMonth, month, today],
  );

  const goToMonth = (offset: number) =>
    void navigate({ to: "/calendar", search: { m: addMonths(month, offset).slice(0, 7) } });

  // ← and → page the months, T returns to today, N adds a block, G opens the date picker. Left alone while
  // typing or while a dialog is open.
  const onShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
    if (editor || isDateSelectorOpen || libraryOpen) return;
    switch (event.key) {
      case "ArrowLeft":
        goToMonth(-1);
        break;
      case "ArrowRight":
        goToMonth(1);
        break;
      case "t":
      case "T":
        void navigate({ to: "/calendar", search: { m: today.slice(0, 7) } });
        break;
      case "n":
      case "N":
        addBlock();
        break;
      case "g":
      case "G":
        setDateSelectorOpen(true);
        break;
      default:
        return;
    }
    event.preventDefault();
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onShortcut(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  // What the grid and the header show: the category filter applied.
  const shown = useMemo(
    () => (categories.length ? tasks.filter((task) => categories.includes(task.category)) : tasks),
    [tasks, categories],
  );

  // The category breakdown is of the month on screen, before the filter, so every category stays pickable.
  const monthTasks = useMemo(() => tasks.filter((task) => isSameMonth(task.day, month)), [tasks, month]);

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
      monthMatrix(month).map((iso) => {
        const date = parseISODate(iso);
        const dayTasks = byDay.get(iso) ?? [];
        return {
          iso,
          dayNumber: date.getDate(),
          inMonth: isSameMonth(iso, month),
          isToday: iso === today,
          isPast: iso < today,
          isWeekend: date.getDay() === 0 || date.getDay() === 6,
          visible: dayTasks.slice(0, MAX_VISIBLE),
          hidden: Math.max(0, dayTasks.length - MAX_VISIBLE),
          total: dayTasks.length ? formatDuration(dayTasks.reduce((sum, task) => sum + task.durationMinutes, 0)) : "",
          done: dayTasks.filter((task) => task.completed).length,
          count: dayTasks.length,
          label: `${longDate(iso)}, ${dayTasks.length} ${dayTasks.length === 1 ? "block" : "blocks"}`,
        };
      }),
    [month, byDay, today],
  );

  const monthStats = useMemo(() => {
    const inMonth = shown.filter((task) => isSameMonth(task.day, month));
    return {
      blocks: inMonth.length,
      minutes: inMonth.reduce((sum, task) => sum + task.durationMinutes, 0),
      done: inMonth.filter((task) => task.completed).length,
    };
  }, [shown, month]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <MonthViewHeader
        month={month}
        today={today}
        isCurrentMonth={isCurrentMonth}
        isDateSelectorOpen={isDateSelectorOpen}
        monthStats={monthStats}
        filtered={categories.length > 0}
        onOpenSelector={() => setDateSelectorOpen(true)}
        onNewBlock={() => addBlock()}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <MonthGrid days={days} onAddBlock={addBlock} />
        <MonthSidebar
          today={today}
          monthTasks={monthTasks}
          categories={categories}
          onToggleCategory={toggleCategory}
          onClearCategories={clearCategories}
          onAddBlock={addBlock}
        />
      </div>

      <DatePickerModal
        open={isDateSelectorOpen}
        initial={month}
        activeMonth={month.slice(0, 7)}
        today={today}
        onClose={() => setDateSelectorOpen(false)}
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
    </div>
  );
}
