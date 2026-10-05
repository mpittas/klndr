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
import { Trash2 } from "lucide-react";
import { useState } from "react";

import { CategorySelect } from "@/components/category/CategorySelect";
import { EmojiPicker } from "@/components/EmojiPicker";
import { Modal } from "@/components/Modal";
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
  "mt-1.5 flex h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:h-9";

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

  const [draft, setDraft] = useState(() => draftFrom(request));
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
  const subtitle = `${formatTime(fromTimeInput(draft.start))} · ${formatDuration(draft.duration)}`;

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
      title={isEdit ? "Edit time block" : "New time block"}
      subtitle={subtitle}
      onClose={onClose}
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
              <div className="flex w-full gap-2 sm:w-auto">
                <button
                  type="button"
                  className="h-10 flex-1 cursor-pointer rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground shadow-xs transition hover:bg-accent sm:h-8 sm:flex-none"
                  onClick={() => setConfirmingTemplateDelete(false)}
                >
                  Keep it
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="h-10 flex-1 cursor-pointer rounded-md bg-destructive px-3 text-xs font-medium text-destructive-foreground shadow-xs transition hover:bg-destructive/90 disabled:opacity-50 sm:h-8 sm:flex-none"
                  onClick={removeTemplate}
                >
                  {busy ? "Deleting…" : "Delete activity"}
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            {/* Icon-only on phones to leave room for the two main actions */}
            {sourceTemplate || isEdit ? (
              <button
                type="button"
                disabled={busy}
                aria-label={sourceTemplate ? "Delete activity" : "Delete block"}
                className="mr-auto inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 text-xs font-medium text-destructive shadow-xs transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50 sm:h-9 sm:w-auto sm:px-3"
                onClick={() => (sourceTemplate ? setConfirmingTemplateDelete((value) => !value) : removeBlock())}
              >
                <Trash2 className="h-5 w-5 sm:hidden" aria-hidden="true" />
                <span className="hidden sm:inline">{sourceTemplate ? "Delete activity" : "Delete block"}</span>
              </button>
            ) : null}
            <button
              type="button"
              className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center rounded-md border border-input bg-background px-3.5 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground sm:h-9 sm:flex-none sm:text-xs"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="task-editor-form"
              disabled={busy}
              className="inline-flex h-11 flex-[1.6] cursor-pointer items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 disabled:opacity-50 sm:h-9 sm:flex-none sm:text-xs"
            >
              {busy ? "Saving…" : isEdit ? "Save changes" : "Add to schedule"}
            </button>
          </div>
        </div>
      }
    >
      <form
        id="task-editor-form"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {/* Tap an activity to fill in the name, category and length; the time is set below */}
        {!isEdit && templates.length > 0 ? (
          <div>
            <span id="task-activity-label" className="text-xs font-medium text-foreground">
              Start from an activity
            </span>
            <div
              role="radiogroup"
              aria-labelledby="task-activity-label"
              className="mt-1.5 flex max-h-[7.5rem] flex-wrap gap-1.5 overflow-y-auto overscroll-contain"
            >
              {[null, ...templates].map((choice) => {
                const selected = draft.templateId === (choice?.id ?? null);
                return (
                  <button
                    key={choice?.id ?? "custom"}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={[
                      "inline-flex h-9 max-w-full cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:h-7 sm:px-2.5",
                      selected
                        ? "border-primary bg-primary text-primary-foreground shadow-xs"
                        : "border-input bg-background text-foreground hover:bg-accent",
                    ].join(" ")}
                    onClick={() => applyTemplate(choice?.id ?? null)}
                  >
                    {choice ? (
                      <>
                        <span aria-hidden="true">{choice.emoji}</span>
                        <span className="truncate">{choice.name}</span>
                      </>
                    ) : (
                      "Custom"
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div>
          <label htmlFor="task-title" className="text-xs font-medium text-foreground">
            Activity Name
          </label>
          <div className="mt-1.5 flex h-11 w-full items-center rounded-md border border-input bg-background shadow-xs transition-colors focus-within:ring-1 focus-within:ring-ring sm:h-10">
            <EmojiPicker
              value={emoji.emoji}
              busy={emoji.picking}
              automatic={emoji.automatic}
              autoDisabled={!draft.title.trim()}
              hint={emoji.hint}
              onChange={emoji.choose}
              onAuto={emoji.auto}
            />
            <span className="h-5 w-px shrink-0 bg-border" />
            <input
              id="task-title"
              value={draft.title}
              data-autofocus
              autoComplete="off"
              enterKeyHint="done"
              placeholder="e.g. Deep focus, Workout"
              className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none"
              onChange={(event) => patch({ title: event.target.value })}
              onBlur={emoji.settle}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block min-w-0">
            <span className="text-xs font-medium text-foreground">Date</span>
            <input
              value={draft.day}
              type="date"
              className={CONTROL_CLASS}
              onChange={(event) => patch({ day: event.target.value })}
            />
          </label>
          <label className="block min-w-0">
            <span className="text-xs font-medium text-foreground">Start Time</span>
            <input
              value={draft.start}
              type="time"
              step={900}
              className={CONTROL_CLASS}
              onChange={(event) => patch({ start: event.target.value })}
            />
          </label>
          <label className="block min-w-0">
            <span className="text-xs font-medium text-foreground">Duration</span>
            <select
              value={draft.duration}
              className={CONTROL_CLASS}
              onChange={(event) => patch({ duration: Number(event.target.value) })}
            >
              {durationOptions.map((value) => (
                <option key={value} value={value}>
                  {formatDuration(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0">
            <span className="text-xs font-medium text-foreground">Category</span>
            <CategorySelect
              value={draft.category}
              templates={templates}
              className="mt-1.5 w-full"
              onChange={(next) => patch({ category: next })}
            />
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-foreground">Notes</span>
          <textarea
            value={draft.notes}
            rows={2}
            placeholder="Any details, reminders, or goals…"
            className="mt-1.5 flex w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            onChange={(event) => patch({ notes: event.target.value })}
          />
        </label>

        <label className="-my-1 flex min-h-11 cursor-pointer items-center gap-3 text-xs font-medium text-foreground sm:min-h-0 sm:gap-2">
          <input
            type="checkbox"
            checked={draft.completed}
            className="h-5 w-5 rounded-xs border-input accent-primary sm:h-4 sm:w-4"
            onChange={(event) => patch({ completed: event.target.checked })}
          />
          <span className="text-sm sm:text-xs">Mark as completed</span>
        </label>
      </form>
    </Modal>
  );
}
