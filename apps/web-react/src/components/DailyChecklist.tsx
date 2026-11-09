import type { ChecklistItem, DayChecklistItem } from "@dayro/core";
import type { useChecklist } from "@dayro/data";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

import { ChecklistHeader } from "@/components/daily-checklist/ChecklistHeader";
import { ChecklistItemRow } from "@/components/daily-checklist/ChecklistItemRow";
import { ChecklistQuickAdd } from "@/components/daily-checklist/ChecklistQuickAdd";
import { EmojiPicker } from "@/components/EmojiPicker";
import { Modal } from "@/components/Modal";
import { useToast } from "@/toast";

/**
 * One day's checklist. The data — which routines apply, what is ticked, and what can be done to them —
 * comes from `@dayro/data`'s `useChecklist`, so the shelf beside the timeline and this panel (which is
 * also the phone's sheet) are showing and changing the same thing.
 */
export function DailyChecklist({ checklist }: { checklist: ReturnType<typeof useChecklist> }) {
  const { show } = useToast();
  const { items, skipped, stats, toggle, addRoutine, addForToday, editRoutine, deleteRoutine, skipForDay, removeOneOff } =
    checklist;

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ChecklistItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [saving, setSaving] = useState(false);
  // Only one row shows its actions at a time. (`DayPlanner` keys this component by day, so it starts clean.)
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleActions = (id: string) => setExpandedId((current) => (current === id ? null : id));
  const completed = new Set(checklist.completedIds);
  const allDone = stats.total > 0 && stats.done === stats.total;

  const messageOf = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

  const handleAddSubmitted = async (payload: { title: string; emoji: string; scope: "default" | "day" }) => {
    setAdding(true);
    try {
      if (payload.scope === "day") await addForToday({ title: payload.title, emoji: payload.emoji });
      else await addRoutine({ title: payload.title, emoji: payload.emoji });
    } catch (err) {
      show(messageOf(err, "Failed to add item"));
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (item: DayChecklistItem) => {
    setEditing(item);
    setEditTitle(item.title);
    setEditEmoji(item.emoji);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const title = editTitle.trim();
    if (!title) return;
    setSaving(true);
    try {
      await editRoutine(editing.id, { title, emoji: editEmoji });
      setEditing(null);
    } catch (err) {
      show(messageOf(err, "Failed to update item"));
    } finally {
      setSaving(false);
    }
  };

  const skip = async (item: ChecklistItem, hidden: boolean) => {
    try {
      await skipForDay(item, hidden);
    } catch (err) {
      show(messageOf(err, "Failed to update this day"));
    }
  };

  const removeExtra = async (item: DayChecklistItem) => {
    try {
      await removeOneOff({ id: item.id, title: item.title });
    } catch (err) {
      show(messageOf(err, "Failed to remove item"));
    }
  };

  const removeItem = async (item: DayChecklistItem) => {
    if (!window.confirm(`Delete "${item.title}" from your daily checklist?`)) return;
    try {
      await deleteRoutine({ id: item.id });
      if (editing?.id === item.id) setEditing(null);
    } catch (err) {
      show(messageOf(err, "Failed to delete item"));
    }
  };

  return (
    <div className="flex h-full flex-col">
      {stats.total > 0 && (
        <ChecklistHeader
          completedCount={stats.done}
          totalCount={stats.total}
          percentage={stats.percentage}
          allDone={allDone}
        />
      )}

      {/* Items list */}
      <div
        className={[
          "min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3",
          stats.total > 0 ? "pt-1" : "pt-4",
        ].join(" ")}
      >
        {items.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium text-foreground">
              {skipped.length === 0 ? "No checklist items yet" : "Everything is skipped on this day"}
            </p>
            {skipped.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Add small habits below, like pills, a protein shake or a shower.
              </p>
            )}
          </div>
        ) : (
          <ul className="space-y-px">
            {items.map((item) => (
              <li key={item.id}>
                <ChecklistItemRow
                  item={item}
                  completed={completed.has(item.id)}
                  expanded={expandedId === item.id}
                  onToggle={(id) => toggle(id, !completed.has(id))}
                  onToggleActions={toggleActions}
                  onEdit={startEdit}
                  onSkip={skip}
                  onRemove={(it) => (it.scope === "day" ? removeExtra(it) : removeItem(it))}
                />
              </li>
            ))}
          </ul>
        )}

        {/* Default items skipped on this day only */}
        {skipped.length > 0 && (
          <details className="group/skipped mt-3 border-t border-border/70 pt-1">
            <summary className="flex min-h-10 cursor-pointer list-none select-none items-center gap-1.5 px-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground touch:min-h-11 touch:text-sm [&::-webkit-details-marker]:hidden">
              <ChevronRight
                className="h-3.5 w-3.5 transition-transform group-open/skipped:rotate-90"
                aria-hidden="true"
              />
              Skipped on this day
              <span className="tabular-nums">{skipped.length}</span>
            </summary>
            <ul className="space-y-px">
              {skipped.map((item) => (
                <li
                  key={item.id}
                  className="flex min-h-11 items-center gap-2 rounded-lg py-1 pl-2 pr-1 text-sm text-muted-foreground"
                >
                  <span className="shrink-0 leading-snug opacity-50" aria-hidden="true">
                    {item.emoji}
                  </span>
                  <span className="min-w-0 flex-1 break-words leading-snug">{item.title}</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs text-foreground touch:h-11 touch:px-4 touch:text-sm"
                    onClick={() => void skip(item, false)}
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {/* Quick add footer */}
      <ChecklistQuickAdd adding={adding} onSubmit={handleAddSubmitted} />

      {/* Edit item (applies to every day) */}
      <Modal
        open={Boolean(editing)}
        title="Edit checklist item"
        subtitle="Changes apply across all days."
        onClose={() => setEditing(null)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="btn btn-soft btn-md h-11 px-5 sm:h-10"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="checklist-edit-form"
              disabled={!editTitle.trim() || saving}
              className="btn btn-primary btn-md h-11 px-5 sm:h-10"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        }
      >
        <form
          id="checklist-edit-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void saveEdit();
          }}
        >
          <div>
            <span className="field-label">Emoji</span>
            <div className="mt-1.5">
              <EmojiPicker
                value={editEmoji}
                onChange={setEditEmoji}
                label="Change emoji"
                className="field h-11 w-14 cursor-pointer items-center justify-center px-0 text-2xl sm:h-10 sm:w-12 sm:text-xl"
              />
            </div>
          </div>

          <div>
            <label htmlFor="checklist-edit-title" className="field-label">
              Title
            </label>
            <input
              id="checklist-edit-title"
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
              type="text"
              required
              maxLength={100}
              autoComplete="off"
              enterKeyHint="done"
              className="field mt-1.5 h-11 sm:h-10"
            />
          </div>
        </form>
      </Modal>

    </div>
  );
}

