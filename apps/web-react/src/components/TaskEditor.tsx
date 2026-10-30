import {
  DURATION_CHOICES,
  formatDuration,
  formatTime,
  fromTimeInput,
  timeInputValue,
  type ActivityTemplate,
  type ScheduledTask,
  type TaskDraft,
} from "@klndr/core";
import { useCategoryColor } from "@klndr/data";
import { ArrowRight, CalendarDays, CheckCircle2, Clock, Folder, StickyNote, Timer, Trash2, type LucideIcon } from "lucide-react";
import { useId, useState, type CSSProperties, type ReactNode } from "react";

import { ActivityPicker } from "@/components/ActivityPicker";
import { CategorySelect } from "@/components/category/CategorySelect";
import { EmojiPicker } from "@/components/EmojiPicker";
import { Modal } from "@/components/Modal";
import { NotesEditor } from "@/components/NotesEditor";
import { TimePicker } from "@/components/TimePicker";
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

const GENERAL = "General";

const CONTROL_CLASS =
  "mt-1.5 flex h-11 w-full min-w-0 rounded-xl border border-transparent bg-muted/60 px-3 py-1 text-sm transition-colors hover:bg-muted focus-visible:border-ring focus-visible:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 sm:h-10";

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
  category: string;
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
      category: task.category,
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
    category: template?.category ?? GENERAL,
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
  const startLabelId = useId();
  const durationLabelId = useId();

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingTemplateDelete, setConfirmingTemplateDelete] = useState(false);

  const patch = (changes: Partial<Draft>) => setDraft((current) => ({ ...current, ...changes }));

  const isEdit = request.mode === "edit";
  // When the dialog was opened from an activity in the library, that activity can be deleted here.
  const sourceTemplate = !isEdit ? (request.template ?? null) : null;

  const category = draft.category.trim() || GENERAL;
  // Blocks take their category's color; there is no separate color to pick.
  const color = colorOf({ category });

  const durationOptions = [...new Set([...DURATION_CHOICES, draft.duration])].sort((a, b) => a - b);
  const startMinutes = fromTimeInput(draft.start);
  const endLabel = formatTime(startMinutes + draft.duration);
  const startLabel = formatTime(startMinutes);

  const applyTemplate = (id: string | null) => {
    const template = templates.find((item) => item.id === id);
    if (!template) {
      patch({ templateId: id });
      return;
    }
    emoji.choose(template.emoji);
    setDraft((current) => ({
      ...current,
      templateId: id,
      title: template.name,
      category: template.category,
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
    // Saving never waits for the emoji: one still being picked is put on the block once it has been saved.
    const picked = emoji.forSave();
    void attempt(async () => {
      const payload: TaskDraft = {
        title: snapshot.title.trim(),
        emoji: picked.emoji,
        color,
        category,
        day: snapshot.day,
        startMinutes: fromTimeInput(snapshot.start),
        durationMinutes: snapshot.duration,
        notes: snapshot.notes.trim() || null,
        completed: snapshot.completed,
        templateId: snapshot.templateId,
      };
      const saved = await onSave({ id: request.task?.id ?? null, payload });
      picked.fill?.({ kind: "task", id: saved.id });
    }, "Something went wrong");
  };

  // Clicking off the dialog keeps what was typed: it saves a changed form (and says so if the name is missing),
  // and closes an untouched one. Escape and the close button still discard.
  const dismiss = () => {
    if (busy) return;
    const changed = (Object.keys(draft) as (keyof Draft)[]).some((key) => draft[key] !== initial[key]);
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
    <Modal
      open={open}
      title={isEdit ? "Edit block" : "New block"}
      hideTitle
      accent={color}
      onClose={onClose}
      onBackdropClick={dismiss}
      footer={
        <div className="space-y-3">
          {error ? (
            <p role="alert" className="rounded-md border border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive">
              {error}
            </p>
          ) : null}

          {confirmingTemplateDelete && sourceTemplate ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5">
              <p className="text-xs text-foreground">
                Delete the activity “{sourceTemplate.name}”? Blocks already on your calendar stay.
              </p>
              <div className="flex w-full justify-end gap-2 sm:w-auto">
                <button
                  type="button"
                  className="h-10 cursor-pointer rounded-lg bg-foreground/5 px-4 text-xs font-medium text-foreground transition hover:bg-foreground/10 sm:h-8"
                  onClick={() => setConfirmingTemplateDelete(false)}
                >
                  Keep it
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="h-10 cursor-pointer rounded-lg bg-destructive px-4 text-xs font-medium text-destructive-foreground transition hover:bg-destructive/90 disabled:opacity-50 sm:h-8"
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
                className="mr-auto inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-destructive/10 px-4 text-sm font-medium text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50 sm:h-10"
                onClick={() => (sourceTemplate ? setConfirmingTemplateDelete((value) => !value) : removeBlock())}
              >
                <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">Delete</span>
              </button>
            ) : null}
            <button
              type="button"
              className="inline-flex h-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-foreground/5 px-5 text-sm font-medium text-foreground transition-colors hover:bg-foreground/10 sm:h-10"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="task-editor-form"
              disabled={busy}
              className="inline-flex h-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 sm:h-10"
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
        style={{ "--cat": color } as CSSProperties}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {/* The block's identity: a big emoji tile in its category color, and the name as a headline */}
        <div className="flex items-center gap-3.5 pr-9">
          <EmojiPicker
            value={emoji.emoji}
            busy={emoji.picking}
            automatic={emoji.automatic}
            autoDisabled={!draft.title.trim()}
            hint={emoji.hint}
            onChange={emoji.choose}
            onAuto={emoji.auto}
            className="flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-[color-mix(in_oklab,var(--cat)_22%,var(--background))] text-3xl ring-1 ring-inset ring-[color-mix(in_oklab,var(--cat)_35%,transparent)] transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
          />
          <div className="min-w-0 flex-1 border-b-2 border-transparent transition-colors focus-within:border-[color-mix(in_oklab,var(--cat)_70%,transparent)]">
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
              className="h-12 w-full min-w-0 bg-transparent text-xl font-semibold tracking-tight placeholder:font-medium placeholder:text-muted-foreground/60 focus-visible:outline-none"
              onChange={(event) => patch({ title: event.target.value })}
              onBlur={emoji.settle}
            />
          </div>
        </div>

        {/* Or fill in the name, category and length from an activity; the time is set below */}
        {!isEdit && templates.length > 0 ? (
          <ActivityPicker value={draft.templateId} templates={templates} onChange={applyTemplate} />
        ) : null}

        {/* When: the span it covers up front, then the date and start, then the length as one-tap chips */}
        <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xs">
          <div className="flex items-center justify-between gap-3 bg-[color-mix(in_oklab,var(--cat)_10%,transparent)] px-4 py-3.5">
            <div className="flex min-w-0 items-center gap-2 text-xl font-semibold tabular-nums tracking-tight text-foreground">
              <span>{startLabel}</span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="text-muted-foreground">{endLabel}</span>
            </div>
            <span className="shrink-0 rounded-full bg-background/80 px-2.5 py-1 text-xs font-semibold tabular-nums text-foreground ring-1 ring-inset ring-border/70">
              {formatDuration(draft.duration)}
            </span>
          </div>

          <div className="space-y-4 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <label className="block min-w-0">
                <FieldLabel icon={CalendarDays}>Date</FieldLabel>
                <input
                  value={draft.day}
                  type="date"
                  className={CONTROL_CLASS}
                  onChange={(event) => patch({ day: event.target.value })}
                />
              </label>
              <div className="block min-w-0">
                <FieldLabel icon={Clock} id={startLabelId}>
                  Starts
                </FieldLabel>
                <div className="mt-1.5">
                  <TimePicker
                    value={draft.start}
                    labelledBy={startLabelId}
                    className={CONTROL_CLASS.replace("mt-1.5 ", "").replace("px-3", "px-1.5 sm:px-2")}
                    onChange={(start) => patch({ start })}
                  />
                </div>
              </div>
            </div>

            <div>
              <FieldLabel icon={Timer} id={durationLabelId}>
                Duration
              </FieldLabel>
              <div role="radiogroup" aria-labelledby={durationLabelId} className="mt-2 grid grid-cols-4 gap-1.5">
                {durationOptions.map((value) => {
                  const selected = value === draft.duration;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`h-9 min-w-0 cursor-pointer rounded-full px-2 text-xs font-semibold tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring touch:h-11 ${
                        selected
                          ? "bg-foreground text-background shadow-sm"
                          : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                      onClick={() => patch({ duration: value })}
                    >
                      {formatDuration(value)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <div className="block">
          <FieldLabel icon={Folder}>Category</FieldLabel>
          <CategorySelect
            value={draft.category}
            templates={templates}
            className="mt-1.5 w-full"
            onChange={(next) => patch({ category: next })}
          />
        </div>

        <div className="block">
          <FieldLabel icon={StickyNote}>Notes</FieldLabel>
          <NotesEditor
            value={draft.notes}
            placeholder="Details, or type / for a list…"
            onChange={(notes) => patch({ notes })}
          />
        </div>

        {/* A switch rather than a checkbox: it reads as a state of the block, not a form option */}
        <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card px-4 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-muted/40">
          <span className="flex items-center gap-2.5">
            <CheckCircle2
              className={`h-4.5 w-4.5 transition-colors ${draft.completed ? "text-emerald-500" : "text-muted-foreground"}`}
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
            className="relative h-6 w-10 shrink-0 rounded-full bg-border transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-background after:shadow-xs after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2"
          />
        </label>
      </form>
    </Modal>
  );
}
