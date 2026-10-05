import {
  GRID_HEIGHT,
  boxOf,
  initialScrollOffset,
  layoutDay,
  longDate,
  nowMinutes,
  slotAt,
  snapMinutes,
  todayISO,
  type ActivityTemplate,
} from "@klndr/core";
import {
  dayStats,
  useCategoryColor,
  useChecklist,
  useDayTimeline,
  useLibraryActions,
  useNotesEditor,
  useTemplates,
} from "@klndr/data";
import { useEffect, useEffectEvent, useMemo, useRef, useState, type DragEvent } from "react";

import { DailyChecklist } from "@/components/DailyChecklist";
import { DayNotes } from "@/components/DayNotes";
import { ActivityPalette } from "@/components/day-planner/ActivityPalette";
import { DayMobileNav } from "@/components/day-planner/DayMobileNav";
import { DayPlannerHeader } from "@/components/day-planner/DayPlannerHeader";
import { DayRoutinesShelf } from "@/components/day-planner/DayRoutinesShelf";
import { DayTimelineGrid } from "@/components/day-planner/DayTimelineGrid";
import { SidebarTabs, type SidebarTab } from "@/components/day-planner/SidebarTabs";
import { useBlockResize } from "@/components/day-planner/useBlockResize";
import { LibraryModal } from "@/components/LibraryModal";
import { Modal } from "@/components/Modal";
import { TaskEditor, type EditorRequest } from "@/components/TaskEditor";
import { useLibrary } from "@/lib/library";

const NO_TEMPLATES: ActivityTemplate[] = [];

type MobileSheet = "checklist" | "notes";
type Preview = { start: number; duration: number; color: string; label: string; emoji: string };

/**
 * One day, side by side: the activities, the checklist and the notes in the sidebar (a full-height sheet's
 * worth of them on a phone) and the timeline with its hour gutter, routines shelf and mobile bar.
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
  const { open: libraryOpen, show: showLibrary } = useLibrary();

  const templates = templatesQuery.data ?? NO_TEMPLATES;

  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>("activities");
  const [mobileSheet, setMobileSheet] = useState<MobileSheet | null>(null);
  const [editor, setEditor] = useState<EditorRequest | null>(null);
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

  // The timeline as it should look right now, including a resize still in flight.
  const tasks = useMemo(
    () =>
      resize.override
        ? timeline.tasks.map((task) =>
            task.id === resize.override?.id ? { ...task, durationMinutes: resize.override.duration } : task,
          )
        : timeline.tasks,
    [timeline.tasks, resize.override],
  );

  // Blocks that share time sit side by side; a block moved by hand keeps its column (see core's layout).
  const layout = useMemo(() => {
    const boxes = new Map<string, { left: number; width: number }>();
    for (const [id, placement] of layoutDay(tasks)) boxes.set(id, boxOf(placement));
    return boxes;
  }, [tasks]);

  const stats = useMemo(() => dayStats(tasks), [tasks]);

  // Land on a useful hour rather than midnight, once the day's blocks are known.
  useEffect(() => {
    if (scrolledForDay.current === day || !timeline.query.isSuccess) return;
    scrolledForDay.current = day;
    const el = scrollRef.current;
    if (el) el.scrollTop = initialScrollOffset(tasks);
  }, [day, timeline.query.isSuccess, tasks]);

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

  const openChecklistManager = () => {
    setActiveSidebarTab("checklist");
    setMobileSheet("checklist");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background lg:flex-row">
      {/* Desktop Sidebar (Activities, Checklist & Notes) */}
      <aside className="hidden border-r border-border bg-card lg:flex lg:w-80 lg:shrink-0 lg:flex-col">
        <SidebarTabs
          active={activeSidebarTab}
          onChange={setActiveSidebarTab}
          activityCount={templates.length}
          checklist={checklist.stats}
          hasNotes={notes.text.trim().length > 0}
        />

        {activeSidebarTab === "notes" ? (
          <DayNotes key={day} notes={notes} />
        ) : activeSidebarTab === "checklist" ? (
          <DailyChecklist key={day} checklist={checklist} />
        ) : (
          <ActivityPalette
            templates={templates}
            onPick={(template) => void timeline.createFromTemplate(template, snapMinutes(nowMinutes(), 30))}
            onDragStart={(template) => setDragSource(template)}
            onDragEnd={() => {
              setDragSource(null);
              setPreview(null);
            }}
            onMove={(template, category) => void library.moveTemplate(template, category)}
            onManage={() => showLibrary()}
          />
        )}
      </aside>

      {/* Timeline section */}
      <section className="flex min-h-0 flex-1 flex-col bg-background">
        <DayPlannerHeader
          day={day}
          isToday={isToday}
          today={today}
          stats={stats}
          onCreateBlock={() => setEditor(createBlockRequest())}
        />

        <div
          ref={scrollRef}
          className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain bg-background scroll-pt-6"
        >
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
          />
        </div>

        <DayMobileNav
          checklistStats={{ total: checklist.stats.total, done: checklist.stats.done }}
          hasNotes={notes.text.trim().length > 0}
          onOpenSheet={(sheet) => setMobileSheet(sheet)}
          onCustomize={() => showLibrary()}
          onCreateBlock={() => setEditor(createBlockRequest())}
        />
      </section>

      {/* Modals & Sheets */}
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
    </div>
  );
}
