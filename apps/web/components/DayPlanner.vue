<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import {
  GRID_HEIGHT,
  boxOf,
  initialScrollOffset,
  layoutDay,
  formatTime,
  longDate,
  nowMinutes,
  resizedDuration,
  slotAt,
  snapMinutes,
  todayISO,
  type ActivityTemplate,
  type ScheduledTask,
  type ChecklistItem,
  type DayChecklist,
  type DayChecklistItem,
  type DayExtraItem,
  type DayNotes,
} from "@klndr/core";
import { paletteOf } from "~/lib/colors";
import { api } from "~/lib/api";
import type { EditorRequest } from "~/components/TaskEditor.vue";
import DayPlannerHeader from "~/components/day-planner/DayPlannerHeader.vue";
import DayRoutinesShelf from "~/components/day-planner/DayRoutinesShelf.vue";
import DayTimelineGrid from "~/components/day-planner/DayTimelineGrid.vue";
import DayMobileNav from "~/components/day-planner/DayMobileNav.vue";

const props = defineProps<{
  day: string;
  initialTasks: ScheduledTask[];
  initialTemplates: ActivityTemplate[];
  initialChecklistItems?: ChecklistItem[];
  initialDayChecklist?: DayChecklist;
  initialNotesText?: string;
  notesState?: "loading" | "ready" | "error";
}>();

const emit = defineEmits<{
  (e: "retry-notes"): void;
}>();

const tasks = ref<ScheduledTask[]>([...props.initialTasks]);
const templates = ref<ActivityTemplate[]>([...props.initialTemplates]);
const checklistItems = ref<ChecklistItem[]>([...(props.initialChecklistItems ?? [])]);
const completedChecklistIds = ref<string[]>([...(props.initialDayChecklist?.completedItemIds ?? [])]);
const hiddenChecklistIds = ref<string[]>([...(props.initialDayChecklist?.hiddenItemIds ?? [])]);
const dayExtraItems = ref<DayExtraItem[]>([...(props.initialDayChecklist?.extraItems ?? [])]);
const notesText = ref(props.initialNotesText ?? "");
const activeSidebarTab = ref<"activities" | "checklist" | "notes">("activities");
const mobileSheet = ref<"checklist" | "notes" | null>(null);
const editor = ref<EditorRequest | null>(null);
const { show: showLibrary, open: libraryOpen } = useLibrary();
const preview = ref<{ start: number; duration: number; color: string; label: string; emoji: string } | null>(null);
const resizing = ref<string | null>(null);
const flash = ref<string | null>(null);

const scrollRef = ref<HTMLDivElement | null>(null);

type DragSource = { kind: "template"; template: ActivityTemplate };

const dragSource = ref<DragSource | null>(null);
let resizedJustHappened = false;
let flashTimer: number | null = null;

const clock = ref(nowMinutes());
const today = computed(() => {
  clock.value;
  return todayISO();
});
const isToday = computed(() => props.day === today.value);
const nowMinute = computed(() => (isToday.value ? clock.value : null));
let clockTimer: number | null = null;

watch(
  () => props.initialTasks,
  (val) => { tasks.value = [...val]; },
  { deep: true },
);

watch(
  () => props.initialTemplates,
  (val) => { templates.value = [...val]; },
  { deep: true },
);

watch(
  () => props.initialChecklistItems,
  (val) => { if (val) checklistItems.value = [...val]; },
  { deep: true },
);

watch(
  () => props.initialNotesText,
  (val) => { notesText.value = val ?? ""; },
);

watch(
  () => props.initialDayChecklist,
  (val) => { if (val) applyDayChecklist(val); },
  { deep: true },
);

const onNotesSaved = (saved: DayNotes) => {
  if (saved.day === props.day) notesText.value = saved.text;
};

const applyDayChecklist = (val: DayChecklist) => {
  completedChecklistIds.value = [...val.completedItemIds];
  hiddenChecklistIds.value = [...val.hiddenItemIds];
  dayExtraItems.value = [...val.extraItems];
};

const notify = (message: string) => {
  flash.value = message;
  if (flashTimer) window.clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => {
    flash.value = null;
  }, 2200);
};

const scrollToUsefulPosition = () => {
  const el = scrollRef.value;
  if (!el) return;
  el.scrollTop = initialScrollOffset(tasks.value);
};

const { load: loadCategories, colorOf } = useCategories();

onMounted(() => {
  loadCategories();
  scrollToUsefulPosition();
  clockTimer = window.setInterval(() => {
    clock.value = nowMinutes();
  }, 30_000);
});

onUnmounted(() => {
  if (clockTimer) window.clearInterval(clockTimer);
  if (flashTimer) window.clearTimeout(flashTimer);
});

watch(
  () => props.day,
  () => {
    scrollToUsefulPosition();
    history.clear(); // undo only reaches back over the day on screen
  },
);

// ---- Undo / redo of timeline changes ----
const history = useTimelineHistory({ tasks, day: () => props.day, notify });

// Ctrl+Z undoes; Ctrl+Shift+Z or Ctrl+Y redoes (Cmd on a Mac). Left alone while typing or in a dialog.
const onUndoKeys = (event: KeyboardEvent) => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
  // By letter where the layout has Latin letters, otherwise by key position (e.g. a Greek layout).
  const key = /^[a-z]$/i.test(event.key) ? event.key.toLowerCase() : event.code.replace(/^Key/, "").toLowerCase();
  const undo = key === "z" && !event.shiftKey;
  const redo = (key === "z" && event.shiftKey) || (key === "y" && !event.shiftKey);
  if (!undo && !redo) return;
  const target = event.target as HTMLElement | null;
  if (target?.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])")) return;
  if (editor.value || mobileSheet.value || libraryOpen.value || resizing.value) return;
  event.preventDefault();
  if (undo) history.undo();
  else history.redo();
};

onMounted(() => window.addEventListener("keydown", onUndoKeys));
onUnmounted(() => window.removeEventListener("keydown", onUndoKeys));

// Blocks that share time sit side by side; a block moved by hand keeps its column (see lib/layout.ts).
const layout = computed(() => {
  const boxes = new Map<string, { left: number; width: number }>();
  for (const [id, placement] of layoutDay(tasks.value)) boxes.set(id, boxOf(placement));
  return boxes;
});

const stats = computed(() => {
  const scheduled = tasks.value.reduce((sum, task) => sum + task.durationMinutes, 0);
  const count = tasks.value.length;
  const done = tasks.value.filter((t) => t.completed).length;

  const catMap = new Map<string, number>();
  for (const t of tasks.value) {
    catMap.set(t.category, (catMap.get(t.category) ?? 0) + t.durationMinutes);
  }
  const categories = [...catMap.entries()].sort((a, b) => b[1] - a[1]);

  return { scheduled, count, done, categories };
});

const categoryColor = (cat: string) => {
  const map: Record<string, string> = {
    Work: "indigo",
    Personal: "emerald",
    Health: "rose",
    DeepWork: "violet",
    Study: "amber",
  };
  return map[cat] ?? "slate";
};

const minutesFromEvent = (container: HTMLDivElement | null, clientY: number) => {
  if (!container) return 0;
  return slotAt(clientY - container.getBoundingClientRect().top);
};

const handleDragOver = (event: DragEvent) => {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  const start = minutesFromEvent(event.currentTarget as HTMLDivElement, event.clientY);
  const template = dragSource.value?.template;
  preview.value = {
    start,
    duration: template?.defaultDuration ?? 60,
    color: template ? colorOf(template) : "indigo",
    label: template?.name ?? "New Block",
    emoji: template?.emoji ?? "",
  };
};

const handleDrop = async (event: DragEvent) => {
  event.preventDefault();
  const start = minutesFromEvent(event.currentTarget as HTMLDivElement, event.clientY);
  preview.value = null;

  const template = dragSource.value?.template;
  dragSource.value = null;
  if (template) await createFromTemplate(template, start);
};

// Shown at once under a temporary id, then swapped for the saved block (or removed if saving fails).
const createFromTemplate = async (template: ActivityTemplate, startMinutes: number) => {
  const draft = {
    day: props.day,
    templateId: template.id,
    title: template.name,
    category: template.category,
    color: colorOf(template),
    emoji: template.emoji,
    startMinutes,
    durationMinutes: template.defaultDuration,
    notes: template.notes ?? "",
    completed: false,
  };
  const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const bySlot = (a: ScheduledTask, b: ScheduledTask) => a.startMinutes - b.startMinutes;
  tasks.value = [...tasks.value, { ...draft, id: tempId }].sort(bySlot);
  try {
    const created = await api.createTask(draft);
    tasks.value = tasks.value.map((item) => (item.id === tempId ? created : item)).sort(bySlot);
    history.record(`Add ${created.title}`, [[null, created]]);
    notify(`Added ${template.name}`);
  } catch {
    tasks.value = tasks.value.filter((item) => item.id !== tempId);
    notify("Could not save that block");
  }
};

// `lanes` is set when the move also put the block in another column, which can shift its neighbours.
const moveTask = async (task: ScheduledTask, start: number, lanes?: Map<string, number>) => {
  const before = tasks.value;
  const changes = new Map<string, { startMinutes?: number; lane?: number }>();
  if (start !== task.startMinutes) changes.set(task.id, { startMinutes: start });
  for (const [id, lane] of lanes ?? []) {
    if (before.find((item) => item.id === id)?.lane !== lane) changes.set(id, { ...changes.get(id), lane });
  }
  if (!changes.size) return;
  const after = before.map((item) => (changes.has(item.id) ? { ...item, ...changes.get(item.id) } : item));
  tasks.value = after;
  try {
    await Promise.all([...changes].map(([id, patch]) => api.updateTask(id, patch)));
    const pick = (list: ScheduledTask[], id: string) => list.find((item) => item.id === id);
    history.record(`Move ${task.title}`, [...changes.keys()].map((id) => [pick(before, id), pick(after, id)]));
    notify(start !== task.startMinutes ? `${task.title} → ${formatTime(start)}` : `Moved ${task.title}`);
  } catch {
    // Some of the changes may have saved, so show what the server has rather than guessing.
    notify("Could not move that block");
    try {
      tasks.value = await api.getTasksForDay(props.day);
    } catch {
      tasks.value = before;
    }
  }
};

const startResize = (task: ScheduledTask, event: PointerEvent) => {
  event.preventDefault();
  event.stopPropagation();
  const startY = event.clientY;
  const startDuration = task.durationMinutes;
  resizedJustHappened = false;
  resizing.value = task.id;
  const snapDuration = (deltaPx: number) => resizedDuration(task.startMinutes, startDuration, deltaPx);

  const onMove = (moveEvent: PointerEvent) => {
    resizedJustHappened = true;
    const next = snapDuration(moveEvent.clientY - startY);
    tasks.value = tasks.value.map((item) =>
      item.id === task.id ? { ...item, durationMinutes: next } : item,
    );
  };

  const cancel = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", cancel);
    resizing.value = null;
    tasks.value = tasks.value.map((item) =>
      item.id === task.id ? { ...item, durationMinutes: startDuration } : item,
    );
    resizedJustHappened = false;
  };

  const finish = async (upEvent: PointerEvent) => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", cancel);
    resizing.value = null;
    const next = snapDuration(upEvent.clientY - startY);
    if (next === startDuration) {
      resizedJustHappened = false;
      return;
    }
    try {
      await api.updateTask(task.id, { durationMinutes: next });
      const now = tasks.value.find((item) => item.id === task.id);
      if (now) history.record(`Resize ${task.title}`, [[{ ...now, durationMinutes: startDuration }, now]]);
    } catch {
      tasks.value = tasks.value.map((item) =>
        item.id === task.id ? { ...item, durationMinutes: startDuration } : item,
      );
    }
    window.setTimeout(() => {
      resizedJustHappened = false;
    }, 120);
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", finish);
  // The browser took the gesture over (e.g. started scrolling): put the block back as it was.
  window.addEventListener("pointercancel", cancel);
};

const toggleComplete = async (task: ScheduledTask) => {
  const next = !task.completed;
  tasks.value = tasks.value.map((item) => (item.id === task.id ? { ...item, completed: next } : item));
  try {
    await api.updateTask(task.id, { completed: next });
    history.record(`${next ? "Complete" : "Reopen"} ${task.title}`, [[task, { ...task, completed: next }]]);
  } catch {
    tasks.value = tasks.value.map((item) => (item.id === task.id ? { ...item, completed: !next } : item));
  }
};

const deleteTask = async (task: ScheduledTask) => {
  const previous = tasks.value;
  tasks.value = tasks.value.filter((item) => item.id !== task.id);
  try {
    await api.deleteTask(task.id);
    history.record(`Delete ${task.title}`, [[task, null]]);
    notify(`Deleted ${task.title}`);
  } catch {
    tasks.value = previous;
    notify("Could not delete that block");
  }
};

const onTaskDeleted = (id: string) => {
  const task = tasks.value.find((item) => item.id === id);
  if (task) history.record(`Delete ${task.title}`, [[task, null]]);
  tasks.value = tasks.value.filter((item) => item.id !== id);
};

const onTemplateSaved = (template: ActivityTemplate) => {
  const prev = templates.value.find((item) => item.id === template.id);
  // The server recolors every block made from this activity; mirror it here so nothing lags behind.
  if (prev && prev.color !== template.color) {
    tasks.value = tasks.value.map((task) =>
      task.templateId === prev.id || (!task.templateId && task.title === prev.name && task.category === prev.category)
        ? { ...task, color: template.color }
        : task,
    );
  }
  const exists = templates.value.some((item) => item.id === template.id);
  const next = exists
    ? templates.value.map((item) => (item.id === template.id ? template : item))
    : [...templates.value, template];
  templates.value = next.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
};

// Dragging an activity onto another category in the sidebar. Shown at once, undone if saving fails.
const moveTemplate = async (template: ActivityTemplate, category: string) => {
  onTemplateSaved({ ...template, category });
  try {
    onTemplateSaved(await api.updateTemplate(template.id, { category }));
    notify(`Moved ${template.name} to ${category}`);
  } catch {
    onTemplateSaved(template);
    notify("Could not move that activity");
  }
};

const onTaskSaved = (task: ScheduledTask) => {
  const previous = tasks.value.find((item) => item.id === task.id);
  history.record(`${previous ? "Edit" : "Add"} ${task.title}`, [[previous, task]]);
  const exists = Boolean(previous);
  if (exists && task.day !== props.day) {
    tasks.value = tasks.value.filter((item) => item.id !== task.id);
    return;
  }
  const next = exists
    ? tasks.value.map((item) => (item.id === task.id ? task : item))
    : [...tasks.value, task];
  tasks.value = next.sort((a, b) => a.startMinutes - b.startMinutes);
};

// Renaming or deleting a category rewrites its activities and blocks on the server.
let categoriesRefresh = 0;
const onCategoriesChanged = async () => {
  const run = ++categoriesRefresh;
  try {
    const [nextTemplates, nextTasks] = await Promise.all([api.getTemplates(), api.getTasksForDay(props.day)]);
    // Two quick renames: an older reload finishing last must not bring the old names back.
    if (run !== categoriesRefresh) return;
    templates.value = nextTemplates;
    tasks.value = nextTasks;
  } catch {
    notify("Could not refresh activities");
  }
};

const refreshDay = async () => {
  try {
    tasks.value = await api.getTasksForDay(props.day);
    notify("Updated");
  } catch {
    notify("Could not refresh");
  }
};

const dayChecklistItems = computed<DayChecklistItem[]>(() => {
  const hidden = new Set(hiddenChecklistIds.value);
  const defaults = checklistItems.value
    .filter((item) => !hidden.has(item.id))
    .map((item) => ({ ...item, scope: "default" as const }));
  const extras = dayExtraItems.value.map((item, index) => ({
    ...item,
    order: Number.MAX_SAFE_INTEGER - dayExtraItems.value.length + index,
    archived: false,
    scope: "day" as const,
  }));
  return [...defaults, ...extras];
});

const skippedChecklistItems = computed(() => {
  const hidden = new Set(hiddenChecklistIds.value);
  return checklistItems.value.filter((item) => hidden.has(item.id));
});

const hasChecklist = computed(() => checklistItems.value.length > 0 || dayExtraItems.value.length > 0);

const checklistStats = computed(() => {
  const total = dayChecklistItems.value.length;
  const set = new Set(completedChecklistIds.value);
  const done = dayChecklistItems.value.filter((item) => set.has(item.id)).length;
  return {
    total,
    done,
    percentage: total === 0 ? 0 : Math.round((done / total) * 100),
  };
});

const toggleChecklistItem = async (itemId: string, completed: boolean) => {
  if (completed) {
    if (!completedChecklistIds.value.includes(itemId)) {
      completedChecklistIds.value.push(itemId);
    }
  } else {
    completedChecklistIds.value = completedChecklistIds.value.filter((id) => id !== itemId);
  }
  try {
    await api.toggleChecklistItem(props.day, itemId, completed);
  } catch {
    notify("Could not update checklist item");
  }
};

const onChecklistCreated = (item: ChecklistItem) => {
  checklistItems.value = [...checklistItems.value, item].sort((a, b) => a.order - b.order);
};

const onChecklistUpdated = (item: ChecklistItem) => {
  checklistItems.value = checklistItems.value.map((t) => (t.id === item.id ? item : t));
};

const onChecklistDeleted = (id: string) => {
  checklistItems.value = checklistItems.value.filter((item) => item.id !== id);
  completedChecklistIds.value = completedChecklistIds.value.filter((item) => item !== id);
};

const onDayChecklistChanged = (updated: DayChecklist) => {
  applyDayChecklist(updated);
};

const openChecklistManager = () => {
  activeSidebarTab.value = "checklist";
  mobileSheet.value = "checklist";
};
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-background lg:flex-row">
    <!-- Desktop Sidebar (Activities & Checklist) -->
    <aside class="hidden lg:flex lg:w-80 lg:shrink-0 lg:flex-col lg:border-r border-border bg-card">
      <div class="flex items-center justify-between gap-2 border-b border-border px-3 pb-2.5 pt-3 bg-card">
        <div class="inline-flex h-9 w-full items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
          <button
            type="button"
            @click="activeSidebarTab = 'activities'"
            class="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-all cursor-pointer"
            :class="activeSidebarTab === 'activities' ? 'bg-background text-foreground shadow-xs font-semibold' : 'hover:text-foreground'"
          >
            <span>Activities</span>
            <span class="rounded-full bg-muted-foreground/15 px-1.5 py-0.2 font-mono text-[10px]">
              {{ templates.length }}
            </span>
          </button>

          <button
            type="button"
            @click="activeSidebarTab = 'checklist'"
            class="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-all cursor-pointer"
            :class="activeSidebarTab === 'checklist' ? 'bg-background text-foreground shadow-xs font-semibold' : 'hover:text-foreground'"
          >
            <span>Checklist</span>
            <span
              class="rounded-full px-1.5 py-0.2 font-mono text-[10px] font-bold"
              :class="checklistStats.total > 0 && checklistStats.done === checklistStats.total
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                : 'bg-muted-foreground/15 text-foreground'"
            >
              {{ checklistStats.done }}/{{ checklistStats.total }}
            </span>
          </button>

          <button
            type="button"
            @click="activeSidebarTab = 'notes'"
            class="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-all cursor-pointer"
            :class="activeSidebarTab === 'notes' ? 'bg-background text-foreground shadow-xs font-semibold' : 'hover:text-foreground'"
          >
            <span>Notes</span>
            <span v-if="notesText.trim()" class="h-1.5 w-1.5 rounded-full bg-primary" aria-label="Has notes" />
          </button>
        </div>
      </div>

      <DayNotes
        v-if="activeSidebarTab === 'notes'"
        :day="day"
        :text="notesText"
        :state="notesState ?? 'ready'"
        @saved="onNotesSaved"
        @retry="emit('retry-notes')"
      />

      <DailyChecklist
        v-else-if="activeSidebarTab === 'checklist'"
        :day="day"
        :items="dayChecklistItems"
        :skipped-items="skippedChecklistItems"
        :completed-ids="completedChecklistIds"
        @toggle="toggleChecklistItem"
        @created="onChecklistCreated"
        @updated="onChecklistUpdated"
        @deleted="onChecklistDeleted"
        @day-changed="onDayChecklistChanged"
      />

      <ActivityPalette
        v-else
        :templates="templates"
        @pick="(template) => createFromTemplate(template, snapMinutes(nowMinutes(), 30))"
        @drag-start="(template) => { dragSource = { kind: 'template', template }; }"
        @drag-end="() => { dragSource = null; preview = null; }"
        @manage="showLibrary()"
        @move="moveTemplate"
        @saved="onTemplateSaved"
      />
    </aside>

    <!-- Timeline section -->
    <section class="flex min-h-0 flex-1 flex-col bg-background">
      <DayPlannerHeader
        :day="day"
        :is-today="isToday"
        :today="today"
        :stats="stats"
        :flash="flash"
        @create-block="editor = { mode: 'create', day, startMinutes: snapMinutes(nowMinutes(), 30), template: null }"
      />

      <div ref="scrollRef" class="relative min-h-0 flex-1 overflow-y-auto overscroll-contain bg-background scroll-pt-6">
        <DayRoutinesShelf
          v-if="hasChecklist"
          :items="dayChecklistItems"
          :completed-ids="completedChecklistIds"
          @toggle="toggleChecklistItem"
          @open-manager="openChecklistManager"
        />

        <DayTimelineGrid
          :day="day"
          :tasks="tasks"
          :now-minute="nowMinute"
          :resizing="resizing"
          :preview="preview"
          :layout="layout"
          :grid-height="GRID_HEIGHT"
          @task-click="(task) => { if (!resizedJustHappened) editor = { mode: 'edit', day, startMinutes: task.startMinutes, task }; }"
          @grid-click="(event) => {
            if (resizedJustHappened) return;
            editor = { mode: 'create', day, startMinutes: minutesFromEvent(event.currentTarget as HTMLDivElement, event.clientY), template: null };
          }"
          @toggle-complete="toggleComplete"
          @delete-task="deleteTask"
          @start-resize="startResize"
          @drag-over="handleDragOver"
          @drag-leave="(event) => { if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) preview = null; }"
          @drop="handleDrop"
          @move-task="moveTask"
          @refresh="refreshDay"
        />
      </div>

      <DayMobileNav
        :checklist-stats="checklistStats"
        :has-notes="notesText.trim().length > 0"
        @open-sheet="(sheet) => { mobileSheet = sheet; }"
        @customize="showLibrary()"
        @create-block="editor = { mode: 'create', day, startMinutes: snapMinutes(nowMinutes(), 30), template: null }"
      />
    </section>

    <!-- Modals & Sheets -->
    <TaskEditor
      :request="editor"
      :templates="templates"
      @close="editor = null"
      @saved="onTaskSaved"
      @deleted="onTaskDeleted"
      @template-deleted="(id) => { templates = templates.filter((item) => item.id !== id); notify('Activity deleted'); }"
    />

    <!-- After the editors so it opens on top of them (e.g. from a category picker). -->
    <LibraryModal
      :templates="templates"
      @saved="onTemplateSaved"
      @deleted="(id) => { templates = templates.filter((item) => item.id !== id) }"
      @categories-changed="onCategoriesChanged"
    />

    <Modal
      :open="mobileSheet === 'notes'"
      title="Notes"
      :subtitle="longDate(day)"
      flush
      @close="mobileSheet = null"
    >
      <div class="flex h-[min(60dvh,32rem)] flex-col">
        <DayNotes
          :day="day"
          :text="notesText"
          :state="notesState ?? 'ready'"
          @saved="onNotesSaved"
          @retry="emit('retry-notes')"
        />
      </div>
    </Modal>

    <Modal
      :open="mobileSheet === 'checklist'"
      title="Checklist"
      :subtitle="longDate(day)"
      flush
      @close="mobileSheet = null"
    >
      <div class="flex h-[min(70dvh,36rem)] flex-col">
        <DailyChecklist
          :day="day"
          :items="dayChecklistItems"
          :skipped-items="skippedChecklistItems"
          :completed-ids="completedChecklistIds"
          @toggle="toggleChecklistItem"
          @created="onChecklistCreated"
          @updated="onChecklistUpdated"
          @deleted="onChecklistDeleted"
          @day-changed="onDayChecklistChanged"
        />
      </div>
    </Modal>
  </div>
</template>
