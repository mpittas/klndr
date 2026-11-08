import { addDaysISO, nowMinutes, snapMinutes, todayISO, type ScheduledTask } from "@klndr/core";
import { useLibraryActions, useTaskActions, useTemplates } from "@klndr/data";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { DatePickerModal } from "@/components/DatePickerModal";
import { LibraryModal } from "@/components/LibraryModal";
import { CategoryFilter } from "@/components/planner/CategoryFilter";
import { PlannerLayout } from "@/components/planner/PlannerLayout";
import { PlannerSidebar } from "@/components/planner/PlannerSidebar";
import { PlannerToolbar } from "@/components/planner/PlannerToolbar";
import { nextFreeStart, scrollTimeline, scrollToColumn } from "@/components/planner/planning";
import { useActivityPlanning } from "@/components/planner/useActivityPlanning";
import { usePlannerShortcuts } from "@/components/planner/usePlannerShortcuts";
import { TaskEditor, type EditorRequest } from "@/components/TaskEditor";
import { WeekGrid } from "@/components/week-view/WeekGrid";
import { useHiddenCategories } from "@/hooks/useHiddenCategories";
import { useSidebarOpen } from "@/hooks/useSidebarOpen";
import { useMediaQuery } from "@/hooks/useViewport";
import { useWeekStartsOnMonday } from "@/hooks/useWeekStart";
import { useLibrary } from "@/lib/library";

const NO_TEMPLATES: never[] = [];

/**
 * The week page: seven days on one timeline, between the month (the overview) and the day (the detail), in the
 * planner's frame (`PlannerLayout`, `PlannerToolbar` and `PlannerSidebar`, as the month and the day): drag an
 * activity from the sidebar onto any slot to plan it there. It owns what the grid, the toolbar and the sidebar
 * share: the block editor, the date picker, the clock and the keys (`usePlannerShortcuts`).
 */
export function WeekView({ days, tasks, loading }: { days: string[]; tasks: ScheduledTask[]; loading: boolean }) {
  const navigate = useNavigate();
  const today = todayISO();
  const first = days[0];
  const last = days[days.length - 1];
  const isThisWeek = days.includes(today);
  const weekStartsOnMonday = useWeekStartsOnMonday();
  const isDesktop = useMediaQuery("(min-width: 64rem)");
  const sidebar = useSidebarOpen();
  const categoryFilter = useHiddenCategories();
  const hidden = categoryFilter.hidden;

  const templates = useTemplates().data ?? NO_TEMPLATES;
  const { saveTask, deleteTask, toggleComplete, changeTask } = useTaskActions();
  const library = useLibraryActions();
  const { open: libraryOpen, show: showLibrary } = useLibrary();

  const [editor, setEditor] = useState<EditorRequest | null>(null);
  const [picking, setPicking] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrolledFor = useRef<string | null>(null);

  // "Now", for today's column: one tick every 30 seconds, as on the day.
  const [clock, setClock] = useState(() => nowMinutes());
  useEffect(() => {
    const timer = window.setInterval(() => setClock(nowMinutes()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // The range query keeps the previous week on screen while the next loads; only this week's blocks count. The
  // Categories control's hours are of all of them; the grid and the toolbar's totals leave the hidden ones out.
  const weekTasks = useMemo(() => tasks.filter((task) => task.day >= first && task.day <= last), [tasks, first, last]);
  const shown = useMemo(
    () => (hidden.length ? weekTasks.filter((task) => !hidden.includes(task.category)) : weekTasks),
    [weekTasks, hidden],
  );
  const stats = useMemo(
    () => ({
      minutes: shown.reduce((sum, task) => sum + task.durationMinutes, 0),
      done: shown.filter((task) => task.completed).length,
      count: shown.length,
    }),
    [shown],
  );

  const planning = useActivityPlanning(weekTasks, today);

  // Where the timeline opens: this week opens on now (and, where the week scrolls sideways, on today's column);
  // another week opens on its first block. Paging from week to week keeps the hour you were looking at, as
  // calendars do, except that coming back to this week brings now back into view.
  useEffect(() => {
    const el = scrollRef.current;
    if (loading || !el || scrolledFor.current === first) return;
    const opening = scrolledFor.current === null;
    scrolledFor.current = first;
    if (!opening && !isThisWeek) return;
    scrollTimeline(el, { nowMinute: isThisWeek ? nowMinutes() : null, tasks: weekTasks });
    if (isThisWeek) scrollToColumn(el, days.indexOf(today), days.length);
  }, [loading, first, weekTasks, isThisWeek, days, today]);

  /** The day the week's actions aim at when none is chosen: today in this week, else its first day. */
  const focus = isThisWeek ? today : first;

  const newBlock = (day?: string, start?: number) => {
    const target = day ?? focus;
    setEditor({
      mode: "create",
      day: target,
      startMinutes: start ?? (target === today ? snapMinutes(nowMinutes(), 30) : 9 * 60),
      template: null,
    });
  };

  const goToWeek = (date: string) => void navigate({ to: "/week/$date", params: { date } });

  usePlannerShortcuts(
    {
      previous: () => goToWeek(addDaysISO(first, -7)),
      next: () => goToWeek(addDaysISO(first, 7)),
      today: () => goToWeek(today),
      create: () => newBlock(),
      goTo: () => setPicking(true),
      toggleSidebar: sidebar.toggle,
    },
    Boolean(editor || picking || libraryOpen),
  );

  return (
    <PlannerLayout
      sidebarLabel="Calendar and activities"
      sidebarOpen={sidebar.open}
      sidebar={
        isDesktop ? (
          <PlannerSidebar
            view="week"
            anchor={first}
            end={last}
            today={today}
            weekStartsOnMonday={weekStartsOnMonday}
            onPickDate={goToWeek}
            templates={templates}
            // Clicked, an activity opens in the editor on today (or the week's first day), after its last block.
            onPickActivity={(template) =>
              setEditor({
                mode: "create",
                day: focus,
                startMinutes: nextFreeStart(
                  weekTasks.filter((task) => task.day === focus),
                  focus,
                  today,
                  template.defaultDuration,
                ),
                template,
              })
            }
            onDragActivity={planning.startDrag}
            onDropActivityEnd={planning.endDrag}
            onMoveActivity={(template, category) => void library.moveTemplate(template, category)}
            onManage={() => showLibrary()}
          />
        ) : undefined
      }
      toolbar={
        <PlannerToolbar
          view="week"
          anchor={first}
          end={last}
          today={today}
          isCurrent={isThisWeek}
          stats={stats}
          filter={
            <CategoryFilter
              tasks={weekTasks}
              period="week"
              hidden={hidden}
              onToggle={categoryFilter.toggle}
              onOnly={categoryFilter.only}
              onShowAll={categoryFilter.showAll}
            />
          }
          pickerOpen={picking}
          onOpenPicker={() => setPicking(true)}
          onCreate={() => newBlock()}
          sidebar={isDesktop ? { open: sidebar.open, onToggle: sidebar.toggle } : undefined}
        />
      }
      dialogs={
        <>
          <DatePickerModal
            open={picking}
            initial={first}
            selected={first}
            today={today}
            title="Go to a week"
            subtitle="Pick any day of the week"
            weekStartsOnMonday={weekStartsOnMonday}
            onClose={() => setPicking(false)}
            onPick={goToWeek}
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
      <WeekGrid
        days={days}
        tasks={shown}
        today={today}
        nowMinute={isThisWeek ? clock : null}
        scrollRef={scrollRef}
        onCreate={(day, start) => newBlock(day, start)}
        onEdit={(task) => setEditor({ mode: "edit", day: task.day, startMinutes: task.startMinutes, task })}
        onToggle={(task) => void toggleComplete(task)}
        onMove={(task, day, start) =>
          void changeTask(task, day === task.day ? { startMinutes: start } : { day, startMinutes: start })
        }
        onResize={(task, durationMinutes) => void changeTask(task, { durationMinutes })}
        dropping={planning.dragging}
        onDropActivity={(day, start) => {
          if (planning.dragging) planning.place(planning.dragging, day, start);
        }}
      />
    </PlannerLayout>
  );
}
