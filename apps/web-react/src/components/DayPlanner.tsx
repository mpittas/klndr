import {
  DAY_MINUTES,
  GRID_HEIGHT,
  addDaysISO,
  boxOf,
  layoutDay,
  longDate,
  nowMinutes,
  slotAt,
  snapMinutes,
  todayISO,
  type ActivityTemplate,
  type Category,
  type ScheduledTask,
  type TaskDraft,
} from "@klndr/core";
import {
  dayStats,
  useCategories,
  useCategoryColor,
  useChecklist,
  useDayTimeline,
  useLibraryActions,
  useNotesEditor,
  useTemplates,
} from "@klndr/data";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useEffectEvent, useMemo, useRef, useState, type DragEvent } from "react";

import { DailyChecklist } from "@/components/DailyChecklist";
import { DatePickerModal } from "@/components/DatePickerModal";
import { DayNotes } from "@/components/DayNotes";
import type { BlockMenuActions } from "@/components/day-planner/BlockContextMenu";
import { DayMobileNav } from "@/components/day-planner/DayMobileNav";
import { DayPanel, type DayPanelTab } from "@/components/day-planner/DayPanel";
import { DayRoutinesShelf } from "@/components/day-planner/DayRoutinesShelf";
import { DayTimelineGrid } from "@/components/day-planner/DayTimelineGrid";
import { useBlockResize } from "@/components/day-planner/useBlockResize";
import { LibraryModal } from "@/components/LibraryModal";
import { Modal } from "@/components/Modal";
import { CategoryFilter } from "@/components/planner/CategoryFilter";
import { PlannerLayout } from "@/components/planner/PlannerLayout";
import { PlannerSidebar } from "@/components/planner/PlannerSidebar";
import { PlannerToolbar } from "@/components/planner/PlannerToolbar";
import { scrollTimeline } from "@/components/planner/planning";
import { usePlannerShortcuts } from "@/components/planner/usePlannerShortcuts";
import { TaskEditor, type EditorRequest } from "@/components/TaskEditor";
import { useHiddenCategories } from "@/hooks/useHiddenCategories";
import { useSidebarOpen } from "@/hooks/useSidebarOpen";
import { useMediaQuery } from "@/hooks/useViewport";
import { useWeekStartsOnMonday } from "@/hooks/useWeekStart";
import { useLibrary } from "@/lib/library";

const NO_TEMPLATES: ActivityTemplate[] = [];
const NO_CATEGORIES: Category[] = [];
/** A quarter hour, the shortest block: what a split's halves are rounded to. */
const SPLIT_STEP = 15;

/** A block as a draft, to make a copy of it or save a changed version. */
const draftOf = (task: ScheduledTask): TaskDraft => ({
  day: task.day,
  title: task.title,
  emoji: task.emoji,
  color: task.color,
  category: task.category,
  startMinutes: task.startMinutes,
  durationMinutes: task.durationMinutes,
  notes: task.notes,
  completed: task.completed,
  templateId: task.templateId,
});

type MobileSheet = "checklist" | "notes";
type Preview = { start: number; duration: number; color: string; label: string; emoji: string };

/**
 * One day, in the planner's frame (`PlannerLayout` + `PlannerToolbar`, as the month and the week): the
 * activities, the checklist and the notes in the sidebar (a full-height sheet's worth of them on a phone) and
 * the timeline with its hour gutter, routines shelf and mobile bar.
 *
 * The data is `@klndr/data`'s: `useDayTimeline` for the blocks and their undo history, `useChecklist` for
 * the routines, `useNotesEditor` for the notes and `useLibraryActions` for the activities and categories.
 * The planner keeps only what is genuinely its own: which panel is open, the drag in progress, and (via
 * `useBlockResize`) the block being resized.
 */
export function DayPlanner({ day }: { day: string }) {
  const timeline = useDayTimeline(day);
  const checklist = useChecklist(day);
  const notes = useNotesEditor(day);
  const templatesQuery = useTemplates();
  const library = useLibraryActions();
  const colorOf = useCategoryColor();
  const categories = useCategories().data ?? NO_CATEGORIES;
  const { open: libraryOpen, show: showLibrary } = useLibrary();
  const navigate = useNavigate();
  const sidebar = useSidebarOpen();
  const weekStartsOnMonday = useWeekStartsOnMonday();

  const templates = templatesQuery.data ?? NO_TEMPLATES;

  const [panelTab, setPanelTab] = useState<DayPanelTab>("checklist");
  const categoryFilter = useHiddenCategories();
  const hasPanel = useMediaQuery("(min-width: 80rem)");
  const [mobileSheet, setMobileSheet] = useState<MobileSheet | null>(null);
  const [editor, setEditor] = useState<EditorRequest | null>(null);
  const [picking, setPicking] = useState(false);
  /** The activity picked up in the palette, waiting to be dropped on the timeline. */
  const [dragSource, setDragSource] = useState<ActivityTemplate | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const resize = useBlockResize((task, duration) => void timeline.resizeTask(task, duration));
  const { resizing } = resize;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrolledForDay = useRef<string | null>(null);

  // The clock only exists for "is it today, and where is now": one tick every 30 seconds, as before.
  const [clock, setClock] = useState(() => nowMinutes());
  useEffect(() => {
    const timer = window.setInterval(() => setClock(nowMinutes()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const today = todayISO();
  const isToday = day === today;
  const nowMinute = isToday ? clock : null;

  // The timeline as it should look right now, including a resize still in flight; then without the categories
  // hidden from the toolbar (the same setting as on the week and the month).
  const allTasks = useMemo(
    () =>
      resize.override
        ? timeline.tasks.map((task) =>
            task.id === resize.override?.id ? { ...task, durationMinutes: resize.override.duration } : task,
          )
        : timeline.tasks,
    [timeline.tasks, resize.override],
  );
  const hiddenCategories = categoryFilter.hidden;
  const tasks = useMemo(
    () => (hiddenCategories.length ? allTasks.filter((task) => !hiddenCategories.includes(task.category)) : allTasks),
    [allTasks, hiddenCategories],
  );

  // Blocks that share time sit side by side; a block moved by hand keeps its column (see core's layout).
  const layout = useMemo(() => {
    const boxes = new Map<string, { left: number; width: number }>();
    for (const [id, placement] of layoutDay(tasks)) boxes.set(id, boxOf(placement));
    return boxes;
  }, [tasks]);

  const stats = useMemo(() => dayStats(tasks), [tasks]);

  // Land on a useful hour rather than midnight, once the day's blocks are known: today on now (as the week does),
  // any other day on its first block.
  useEffect(() => {
    if (scrolledForDay.current === day || !timeline.query.isSuccess) return;
    scrolledForDay.current = day;
    const el = scrollRef.current;
    if (el) scrollTimeline(el, { nowMinute: isToday ? nowMinutes() : null, tasks });
  }, [day, timeline.query.isSuccess, tasks, isToday]);

  // Ctrl+Z undoes; Ctrl+Shift+Z or Ctrl+Y redoes (Cmd on a Mac). Left alone while typing or in a dialog.
  // An Effect Event reads the current timeline and dialogs without re-attaching the listener every render.
  const onShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    // By letter where the layout has Latin letters, otherwise by key position (e.g. a Greek layout).
    const key = /^[a-z]$/i.test(event.key) ? event.key.toLowerCase() : event.code.replace(/^Key/, "").toLowerCase();
    const undo = key === "z" && !event.shiftKey;
    const redo = (key === "z" && event.shiftKey) || (key === "y" && !event.shiftKey);
    if (!undo && !redo) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])")) return;
    if (editor || mobileSheet || libraryOpen || resizing) return;
    event.preventDefault();
    if (undo) void timeline.undo();
    else void timeline.redo();
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onShortcut(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  // The keys every planner view answers to (← → days, T today, N a new block, G go to a day, \ the sidebar).
  const goToDay = (date: string) => void navigate({ to: "/day/$date", params: { date } });
  usePlannerShortcuts(
    {
      previous: () => goToDay(addDaysISO(day, -1)),
      next: () => goToDay(addDaysISO(day, 1)),
      today: () => goToDay(today),
      create: () => setEditor(createBlockRequest()),
      goTo: () => setPicking(true),
      toggleSidebar: sidebar.toggle,
    },
    Boolean(editor || picking || mobileSheet || libraryOpen || resizing || dragSource),
  );

  const minutesFromEvent = (container: HTMLDivElement | null, clientY: number) => {
    if (!container) return 0;
    return slotAt(clientY - container.getBoundingClientRect().top);
  };

  const createBlockRequest = (): EditorRequest => ({
    mode: "create",
    day,
    startMinutes: snapMinutes(nowMinutes(), 30),
    template: null,
  });

  // ---- The right-click menu on a block ----
  const nowStart = isToday ? snapMinutes(nowMinutes(), SPLIT_STEP) : null;

  const menuActions: BlockMenuActions = {
    edit: (task) => setEditor({ mode: "edit", day, startMinutes: task.startMinutes, task }),
    toggleComplete: (task) => void timeline.toggleComplete(task),
    duplicate: (task) =>
      void timeline.addTask({
        ...draftOf(task),
        completed: false,
        // Straight after the block, or as late as the day allows.
        startMinutes: Math.min(task.startMinutes + task.durationMinutes, DAY_MINUTES - task.durationMinutes),
      }),
    copyToDay: (task, days) =>
      void timeline.addTask({ ...draftOf(task), completed: false, day: addDaysISO(task.day, days) }),
    moveToDay: (task, days) =>
      void timeline.changeTask(task, { day: addDaysISO(task.day, days) }, `${task.title} → tomorrow`),
    startNow: (task) => {
      if (nowStart !== null) void timeline.moveTask(task, Math.min(nowStart, DAY_MINUTES - task.durationMinutes));
    },
    split: (task) => {
      const first = Math.floor(task.durationMinutes / 2 / SPLIT_STEP) * SPLIT_STEP;
      if (first < SPLIT_STEP) return;
      void timeline.resizeTask(task, first);
      void timeline.addTask({
        ...draftOf(task),
        completed: false,
        startMinutes: task.startMinutes + first,
        durationMinutes: task.durationMinutes - first,
      });
    },
    resize: (task, minutes) => void timeline.resizeTask(task, minutes),
    setCategory: (task, category) =>
      void timeline.changeTask(task, {
        category,
        color: categories.find((item) => item.name === category)?.color ?? task.color,
      }),
    remove: (task) => void timeline.deleteTask(task),
  };

  // ---- Dragging an activity from the palette onto the timeline ----
  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    const start = minutesFromEvent(event.currentTarget, event.clientY);
    const template = dragSource;
    setPreview({
      start,
      duration: template?.defaultDuration ?? 60,
      color: template ? colorOf(template) : "indigo",
      label: template?.name ?? "New block",
      emoji: template?.emoji ?? "",
    });
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const start = minutesFromEvent(event.currentTarget, event.clientY);
    setPreview(null);
    const template = dragSource;
    setDragSource(null);
    if (template) void timeline.createFromTemplate(template, start);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPreview(null);
  };

  // The checklist is the day panel's on wide screens, a sheet below that.
  const openChecklistManager = () => {
    if (hasPanel) setPanelTab("checklist");
    else setMobileSheet("checklist");
  };

  return (
    <PlannerLayout
      sidebarLabel="Calendar and activities"
      sidebarOpen={sidebar.open}
      sidebar={
        <PlannerSidebar
          view="day"
          anchor={day}
          today={today}
          weekStartsOnMonday={weekStartsOnMonday}
          onPickDate={goToDay}
          templates={templates}
          onPickActivity={(template) => void timeline.createFromTemplate(template, snapMinutes(nowMinutes(), 30))}
          onDragActivity={(template) => setDragSource(template)}
          onDropActivityEnd={() => {
            setDragSource(null);
            setPreview(null);
          }}
          onMoveActivity={(template, category) => void library.moveTemplate(template, category)}
          onManage={() => showLibrary()}
        />
      }
      panelLabel="The day's checklist and notes"
      panel={<DayPanel day={day} active={panelTab} onChange={setPanelTab} checklist={checklist} notes={notes} />}
      toolbar={
        <PlannerToolbar
          view="day"
          anchor={day}
          today={today}
          isCurrent={isToday}
          stats={{ minutes: stats.scheduled, done: stats.done, count: stats.count }}
          filter={
            <CategoryFilter
              tasks={allTasks}
              period="day"
              hidden={categoryFilter.hidden}
              onToggle={categoryFilter.toggle}
              onOnly={categoryFilter.only}
              onShowAll={categoryFilter.showAll}
            />
          }
          pickerOpen={picking}
          onOpenPicker={() => setPicking(true)}
          onCreate={() => setEditor(createBlockRequest())}
          sidebar={{ open: sidebar.open, onToggle: sidebar.toggle }}
        />
      }
      footer={
        <DayMobileNav
          checklistStats={{ total: checklist.stats.total, done: checklist.stats.done }}
          hasNotes={notes.text.trim().length > 0}
          onOpenSheet={(sheet) => setMobileSheet(sheet)}
          onCustomize={() => showLibrary()}
        />
      }
      dialogs={
        <>
          <DatePickerModal
            open={picking}
            initial={day}
            selected={day}
            today={today}
            weekStartsOnMonday={weekStartsOnMonday}
            onClose={() => setPicking(false)}
          />

          <TaskEditor
            request={editor}
            templates={templates}
            onClose={() => setEditor(null)}
            onSave={(vars) => timeline.saveTask(vars)}
            onDelete={(task) => timeline.deleteTask(task)}
            onDeleteTemplate={(id) => library.deleteTemplate({ id })}
          />

          {/* After the editors so it opens on top of them (e.g. from a category picker). */}
          <LibraryModal templates={templates} />

          <Modal
            open={mobileSheet === "notes"}
            title="Notes"
            subtitle={longDate(day)}
            flush
            onClose={() => setMobileSheet(null)}
          >
            <div className="flex h-[min(60dvh,32rem)] flex-col">
              <DayNotes key={day} notes={notes} />
            </div>
          </Modal>

          <Modal
            open={mobileSheet === "checklist"}
            title="Checklist"
            subtitle={longDate(day)}
            flush
            onClose={() => setMobileSheet(null)}
          >
            <div className="flex h-[min(70dvh,36rem)] flex-col">
              <DailyChecklist key={day} checklist={checklist} />
            </div>
          </Modal>
        </>
      }
    >
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain bg-background scroll-pt-6">
        {checklist.hasChecklist ? (
          <DayRoutinesShelf
            items={checklist.items}
            completedIds={checklist.completedIds}
            onToggle={(id, completed) => checklist.toggle(id, completed)}
            onOpenManager={openChecklistManager}
          />
        ) : null}

        <DayTimelineGrid
          tasks={tasks}
          nowMinute={nowMinute}
          resizing={resizing}
          preview={preview}
          layout={layout}
          gridHeight={GRID_HEIGHT}
          onTaskClick={(task) => {
            if (resize.justResized()) return;
            setEditor({ mode: "edit", day, startMinutes: task.startMinutes, task });
          }}
          onGridClick={(event) => {
            if (resize.justResized()) return;
            setEditor({
              mode: "create",
              day,
              startMinutes: minutesFromEvent(event.currentTarget, event.clientY),
              template: null,
            });
          }}
          onToggleComplete={(task) => void timeline.toggleComplete(task)}
          onDeleteTask={(task) => void timeline.deleteTask(task)}
          onStartResize={resize.startResize}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onMoveTask={(task, start, lanes) => void timeline.moveTask(task, start, lanes)}
          isToday={isToday}
          nowStart={nowStart}
          menuActions={menuActions}
        />
      </div>
    </PlannerLayout>
  );
}
