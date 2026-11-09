import {
  DAY_MINUTES,
  DURATION_CHOICES,
  formatDuration,
  formatTime,
  fromTimeInput,
  longDate,
  mediumDate,
  nowMinutes,
  timeInputValue,
  todayISO,
  type ActivityTemplate,
  type ScheduledTask,
  type TaskDraft,
} from "@dayro/core";
import { useCategoryColor, useCategoryField } from "@dayro/data";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  PanelLeft,
  SquareSquare,
  StickyNote,
  Timer,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useId, useMemo, useState, type ReactNode } from "react";

import { ActivityPicker } from "@/components/ActivityPicker";
import { CategoryChips } from "@/components/category/CategoryChips";
import { DatePickerModal } from "@/components/DatePickerModal";
import { EmojiPicker } from "@/components/EmojiPicker";
import { Modal } from "@/components/Modal";
import { NotesEditor } from "@/components/NotesEditor";
import { TimeSelect, type TimeOption } from "@/components/TimeSelect";
import { useDefaultEditorLayout } from "@/hooks/useEditorLayout";
import { useEmojiField } from "@/hooks/useEmojiField";

/** What the editor was opened for. */
export type EditorRequest = {
  mode: "create" | "edit";
  day: string;
  startMinutes: number;
  task?: ScheduledTask;
  template?: ActivityTemplate | null;
};

type TaskEditorProps = {
  /** The block to edit or create; `null` closes the dialog. */
  request: EditorRequest | null;
  templates: ActivityTemplate[];
  onClose: () => void;
  /** Waits for the server and throws its message, so the form can show it. */
  onSave: (vars: { id: string | null; payload: TaskDraft }) => Promise<ScheduledTask>;
  onDelete: (task: ScheduledTask) => Promise<unknown>;
  onDeleteTemplate: (id: string) => Promise<unknown>;
};

/** The step of the time lists. */
const SLOT = 15;

/** A small label with its icon, shared by every field so the form reads as one list. */
function FieldLabel({ icon: Icon, children, id }: { icon: LucideIcon; children: ReactNode; id?: string }) {
  return (
    <span id={id} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {children}
    </span>
  );
}

type Draft = {
  title: string;
  day: string;
  start: string;
  duration: number;
  notes: string;
  completed: boolean;
  templateId: string | null;
};

/** The form as a request first fills it in: from the block being edited, or from the activity it starts at. */
function draftFrom(request: EditorRequest): Draft {
  if (request.mode === "edit" && request.task) {
    const task = request.task;
    return {
      title: task.title,
      day: task.day,
      start: timeInputValue(task.startMinutes),
      duration: task.durationMinutes,
      notes: task.notes ?? "",
      completed: task.completed,
      templateId: task.templateId,
    };
  }
  const template = request.template ?? null;
  return {
    title: template?.name ?? "",
    day: request.day,
    start: timeInputValue(request.startMinutes),
    duration: template?.defaultDuration ?? 30,
    notes: template?.notes ?? "",
    completed: false,
    templateId: template?.id ?? null,
  };
}

/**
 * The dialog for a timeline block: the activity it starts from, its name, when and how long it runs, its
 * category and notes.
 *
 * Saving and deleting are handed back to `DayPlanner`, which owns the day's timeline mutations and their
 * undo history, so the editor only says what to save and shows what went wrong.
 *
 * This wrapper remembers the last request, so the dialog keeps its content while it animates out, and
 * gives every new request a fresh form (a new `key`) instead of copying the request into state later.
 */
export function TaskEditor({ request, ...rest }: TaskEditorProps) {
  const [session, setSession] = useState<{ id: number; request: EditorRequest } | null>(null);

  // Adjusting state while rendering: a new request starts a new session.
  if (request && request !== session?.request) {
    setSession({ id: (session?.id ?? 0) + 1, request });
  }

  if (!session) return null;
  return <TaskEditorDialog key={session.id} open={request !== null} request={session.request} {...rest} />;
}

function TaskEditorDialog({
  open,
  request,
  templates,
  onClose,
  onSave,
  onDelete,
  onDeleteTemplate,
}: Omit<TaskEditorProps, "request"> & { open: boolean; request: EditorRequest }) {
  const colorOf = useCategoryColor();
  const durationLabelId = useId();
  const [pickingDate, setPickingDate] = useState(false);
  // Opens in the default chosen under Profile & settings; the switch in the corner changes this editor only.
  const [defaultLayout] = useDefaultEditorLayout();
  const [layout, setLayout] = useState(defaultLayout);

  const [initial] = useState(() => draftFrom(request));
  const [draft, setDraft] = useState(initial);
  // A new block gets its emoji as its title is typed. One started from an activity has that activity's, and an
  // edited one keeps its own unless its title changes (see `useEmojiField`).
  const start = request.mode === "edit" ? request.task : null;
  const emoji = useEmojiField({
    kind: "activity",
    initial: start ? start.emoji : (request.template?.emoji ?? null),
    initialTitle: start ? start.title : (request.template?.name ?? ""),
    initialByHand: !start && !!request.template,
    title: draft.title,
    known: templates,
  });
  // The category is picked from the title as it is typed, unless the block has one of its own or an activity's
  // (see `useCategoryField`), so a block lands in the right color without a thought.
  const initialCategory = start ? start.category : (request.template?.category ?? null);
  const category = useCategoryField({
    initial: initialCategory,
    initialTitle: start ? start.title : (request.template?.name ?? ""),
    initialByHand: !start && !!request.template,
    title: draft.title,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingTemplateDelete, setConfirmingTemplateDelete] = useState(false);

  const patch = (changes: Partial<Draft>) => setDraft((current) => ({ ...current, ...changes }));

  const isEdit = request.mode === "edit";
  // When the dialog was opened from an activity in the library, that activity can be deleted here.
  const sourceTemplate = !isEdit ? (request.template ?? null) : null;

  const startMinutes = fromTimeInput(draft.start);
  const endMinutes = startMinutes + draft.duration;
  const today = todayISO();
  // The year only when it is not this one.
  const yearSuffix = draft.day.slice(0, 4) === today.slice(0, 4) ? "" : `, ${draft.day.slice(0, 4)}`;

  // Start times every quarter hour (plus the block's own, if it is off the grid), with "Now" on today's slot.
  const startOptions = useMemo<TimeOption[]>(() => {
    const now = draft.day === today ? Math.floor(nowMinutes() / SLOT) * SLOT : null;
    const values = new Set<number>([startMinutes]);
    for (let minute = 0; minute < DAY_MINUTES; minute += SLOT) values.add(minute);
    return [...values]
      .sort((a, b) => a - b)
      .map((value) => ({
        value,
        label: formatTime(value),
        hint: value === now ? "Now" : undefined,
        accent: value === now,
      }));
  }, [startMinutes, draft.day, today]);

  // End times from a quarter hour after the start to midnight, each with the length it gives.
  const endOptions = useMemo<TimeOption[]>(() => {
    const values = new Set<number>([endMinutes]);
    for (let end = startMinutes + SLOT; end <= DAY_MINUTES; end += SLOT) values.add(end);
    return [...values]
      .filter((end) => end > startMinutes)
      .sort((a, b) => a - b)
      .map((value) => ({ value, label: formatTime(value), hint: formatDuration(value - startMinutes) }));
  }, [startMinutes, endMinutes]);

  // A new start keeps the length, cut short where it would run past midnight.
  const changeStart = (minutes: number) =>
    patch({ start: timeInputValue(minutes), duration: Math.max(SLOT, Math.min(draft.duration, DAY_MINUTES - minutes)) });
  const changeEnd = (minutes: number) => patch({ duration: Math.max(SLOT, minutes - startMinutes) });

  const timeTrigger =
    "group -mx-1.5 flex cursor-pointer items-center gap-1 rounded-lg px-1.5 py-0.5 text-[1.375rem] font-semibold leading-tight tabular-nums tracking-[-0.025em] text-foreground transition-colors hover:bg-foreground/[0.06] aria-expanded:bg-foreground/[0.08] sm:text-[1.5rem]";

  const applyTemplate = (id: string | null) => {
    const template = templates.find((item) => item.id === id);
    if (!template) {
      patch({ templateId: id });
      return;
    }
    emoji.choose(template.emoji);
    category.choose(template.category);
    setDraft((current) => ({
      ...current,
      templateId: id,
      title: template.name,
      duration: template.defaultDuration,
      notes: current.notes || (template.notes ?? ""),
    }));
  };

  /** Runs a save or delete: shows the busy state, reports a failure, and closes the dialog on success. */
  const attempt = async (action: () => Promise<unknown>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onClose();
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : fallback);
      setConfirmingTemplateDelete(false);
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (!draft.title.trim()) {
      setError("Give this block a name.");
      return;
    }
    if (busy) return;
    const snapshot = draft;
    // Saving never waits for the emoji or the category: one still being picked is put on the block once it has
    // been saved.
    const picked = emoji.forSave();
    const filed = category.forSave();
    void attempt(async () => {
      const payload: TaskDraft = {
        title: snapshot.title.trim(),
        emoji: picked.emoji,
        // Blocks take their category's color; there is no separate color to pick.
        color: colorOf({ category: filed.category }),
        category: filed.category,
        day: snapshot.day,
        startMinutes: fromTimeInput(snapshot.start),
        durationMinutes: snapshot.duration,
        notes: snapshot.notes.trim() || null,
        completed: snapshot.completed,
        templateId: snapshot.templateId,
      };
      const saved = await onSave({ id: request.task?.id ?? null, payload });
      picked.fill?.({ kind: "task", id: saved.id });
      filed.fill?.(saved.id);
    }, "Something went wrong");
  };

  // Clicking off the dialog keeps what was typed: it saves a changed form (and says so if the name is missing),
  // and closes an untouched one. Escape and the close button still discard.
  const dismiss = () => {
    if (busy) return;
    const changed =
      (Object.keys(draft) as (keyof Draft)[]).some((key) => draft[key] !== initial[key]) ||
      category.value !== initialCategory;
    if (changed) submit();
    else onClose();
  };

  const removeBlock = () => {
    const { task } = request;
    if (task) void attempt(() => onDelete(task), "Could not delete");
  };

  const removeTemplate = () => {
    if (sourceTemplate) void attempt(() => onDeleteTemplate(sourceTemplate.id), "Could not delete");
  };

  return (
    <>
    <Modal
      open={open}
      title={isEdit ? "Edit block" : "New block"}
      compactHeader
      lg
      side={layout === "side"}
      actions={
        <div role="radiogroup" aria-label="Open the editor as" className="segmented hidden h-8 sm:inline-flex">
          <button
            type="button"
            role="radio"
            aria-checked={layout === "center"}
            aria-label="Dialog"
            title="Show as a dialog · change the default in Profile & settings"
            className="segmented-item w-8 flex-none px-0"
            onClick={() => setLayout("center")}
          >
            <SquareSquare className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={layout === "side"}
            aria-label="Side panel"
            title="Show as a side panel · change the default in Profile & settings"
            className="segmented-item w-8 flex-none px-0"
            onClick={() => setLayout("side")}
          >
            <PanelLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      }
      onClose={onClose}
      onBackdropClick={dismiss}
      footer={
        <div className="space-y-3">
          {error ? (
            <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/[0.06] px-3 py-2.5 text-[13px] font-medium text-destructive">
              {error}
            </p>
          ) : null}

          {confirmingTemplateDelete && sourceTemplate ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/20 bg-destructive/[0.05] px-3 py-2.5">
              <p className="text-xs text-foreground">
                Delete the activity “{sourceTemplate.name}”? Blocks already on your calendar stay.
              </p>
              <div className="flex w-full justify-end gap-2 sm:w-auto">
                <button
                  type="button"
                  className="btn btn-soft btn-sm h-10 sm:h-8"
                  onClick={() => setConfirmingTemplateDelete(false)}
                >
                  Keep it
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="btn btn-danger btn-sm h-10 sm:h-8"
                  onClick={removeTemplate}
                >
                  {busy ? "Deleting…" : "Delete activity"}
                </button>
              </div>
            </div>
          ) : null}

          {/* One button style: same height and side padding, as wide as its label. Delete sits apart on the left. */}
          <div className="flex items-center justify-end gap-2">
            {sourceTemplate || isEdit ? (
              <button
                type="button"
                disabled={busy}
                aria-label={sourceTemplate ? "Delete activity" : "Delete block"}
                className="btn btn-danger-soft btn-md mr-auto h-11 px-4 sm:h-10"
                onClick={() => (sourceTemplate ? setConfirmingTemplateDelete((value) => !value) : removeBlock())}
              >
                <Trash2 aria-hidden="true" />
                <span className="truncate">Delete</span>
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-soft btn-md h-11 px-5 sm:h-10"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="task-editor-form"
              disabled={busy}
              className="btn btn-primary btn-md h-11 px-5 sm:h-10"
            >
              {busy ? "Saving…" : isEdit ? "Save" : "Add block"}
            </button>
          </div>
        </div>
      }
    >
      <form
        id="task-editor-form"
        className="space-y-5 pb-1"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {/* The block's identity: its emoji on a plain tile, and the name as a headline */}
        <div className="flex items-center gap-3">
          <EmojiPicker
            value={emoji.emoji}
            busy={emoji.picking}
            automatic={emoji.automatic}
            autoDisabled={!draft.title.trim()}
            hint={emoji.hint}
            onChange={emoji.choose}
            onAuto={emoji.auto}
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border bg-muted/60 text-2xl transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-foreground/[0.05] dark:hover:bg-foreground/[0.09]"
          />
          <div className="min-w-0 flex-1 border-b border-border transition-colors focus-within:border-ring">
            <label htmlFor="task-title" className="sr-only">
              Name
            </label>
            <input
              id="task-title"
              value={draft.title}
              data-autofocus
              autoComplete="off"
              enterKeyHint="done"
              placeholder="Name this block"
              className="h-11 w-full min-w-0 bg-transparent text-xl font-semibold tracking-[-0.02em] placeholder:font-medium placeholder:text-muted-foreground/55 focus-visible:outline-none"
              onChange={(event) => patch({ title: event.target.value })}
              onBlur={() => {
                emoji.settle();
                category.settle();
              }}
            />
          </div>
        </div>

        {/* Right under the name, as one tap: the app fills it in from the name, and a wrong guess shows at once */}
        <CategoryChips
          value={category.value}
          suggested={category.suggested}
          guessing={category.guessing}
          ranked={category.ranked}
          named={draft.title.trim() !== ""}
          templates={templates}
          onChange={category.choose}
        />

        {/* When, as one statement on a slightly lifted band: the day (opens the calendar), then the span (each end
            opens a list of times). The length presets follow. */}
        <section className="card overflow-hidden">
          <div className="border-b border-border bg-muted/60 px-4 pb-3.5 pt-2.5 dark:bg-foreground/[0.045]">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                aria-haspopup="dialog"
                aria-label={`Date: ${longDate(draft.day)}${yearSuffix}. Change the date`}
                className="group -ml-2 inline-flex h-9 min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/[0.06] sm:h-8"
                onClick={() => setPickingDate(true)}
              >
                <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 truncate">
                  <span className="sm:hidden">{mediumDate(draft.day)}</span>
                  <span className="hidden sm:inline">{longDate(draft.day)}</span>
                  {yearSuffix}
                </span>
                <ChevronDown
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                  aria-hidden="true"
                />
              </button>
              {draft.day === today ? (
                <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">Today</span>
              ) : null}
            </div>

            <div className="mt-2 flex items-end gap-3">
              <div className="min-w-0">
                <span className="block text-xs font-medium text-muted-foreground">Starts</span>
                <TimeSelect value={startMinutes} options={startOptions} onChange={changeStart} label="Start time" className={timeTrigger}>
                  {formatTime(startMinutes)}
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" aria-hidden="true" />
                </TimeSelect>
              </div>

              {/* The length, on the line between the two ends */}
              <div className="mb-[0.7rem] flex min-w-6 flex-1 items-center text-muted-foreground" aria-hidden="true">
                <span className="h-px flex-1 bg-border" />
                <span className="mx-1.5 shrink-0 rounded-full bg-card px-2 py-0.5 text-[11px] font-semibold tabular-nums text-foreground ring-1 ring-inset ring-border">
                  {formatDuration(draft.duration)}
                </span>
                <span className="h-px flex-1 bg-border" />
                <ArrowRight className="-ml-1 h-3.5 w-3.5 shrink-0 opacity-60" />
              </div>

              <div className="min-w-0 text-right">
                <span className="block text-xs font-medium text-muted-foreground">Ends</span>
                <TimeSelect value={endMinutes} options={endOptions} onChange={changeEnd} label="End time" align="end" className={timeTrigger}>
                  {formatTime(endMinutes)}
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" aria-hidden="true" />
                </TimeSelect>
              </div>
            </div>
          </div>

          <div className="p-4">
            <div>
              <FieldLabel icon={Timer} id={durationLabelId}>
                Duration
              </FieldLabel>
              <div role="radiogroup" aria-labelledby={durationLabelId} className="segmented mt-1.5 grid w-full grid-cols-4">
                {DURATION_CHOICES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={value === draft.duration}
                    disabled={startMinutes + value > DAY_MINUTES}
                    className="segmented-item h-8 px-1 text-xs font-semibold tabular-nums disabled:cursor-not-allowed disabled:opacity-35 touch:h-10"
                    onClick={() => patch({ duration: value })}
                  >
                    {formatDuration(value)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Or fill in the name, category and length from an activity; the day and start above stay as they are */}
        {!isEdit && templates.length > 0 ? (
          <ActivityPicker value={draft.templateId} templates={templates} onChange={applyTemplate} />
        ) : null}

        <div className="block">
          <FieldLabel icon={StickyNote}>Notes</FieldLabel>
          <NotesEditor
            value={draft.notes}
            placeholder="Details, or type / for a list…"
            touchPlaceholder="Tap to write. Add a to-do list, bullets or a title…"
            context={draft.title.trim() || undefined}
            onChange={(notes) => patch({ notes })}
          />
        </div>

        {/* A switch rather than a checkbox: it reads as a state of the block, not a form option */}
        <label className="card flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/40">
          <span className="flex items-center gap-2.5">
            <CheckCircle2
              className={`h-4.5 w-4.5 transition-colors ${draft.completed ? "text-success" : "text-muted-foreground"}`}
              aria-hidden="true"
            />
            Mark as completed
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={draft.completed}
            className="peer sr-only"
            onChange={(event) => patch({ completed: event.target.checked })}
          />
          <span
            aria-hidden="true"
            className="relative h-6 w-10 shrink-0 rounded-full bg-foreground/15 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-success peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background"
          />
        </label>
      </form>
    </Modal>

    {/* Beside the dialog, not in it, so its keys and focus stay its own. */}
    <DatePickerModal
      open={pickingDate}
      initial={draft.day}
      selected={draft.day}
      today={today}
      title="Choose a date"
      subtitle="The day this block happens on"
      onClose={() => setPickingDate(false)}
      onPick={(day) => patch({ day })}
    />
    </>
  );
}
