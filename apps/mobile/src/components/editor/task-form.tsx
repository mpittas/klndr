import {
  DAY_MINUTES,
  MAX_TITLE,
  MAX_NOTES,
  SNAP_MINUTES,
  clampStart,
  formatTimeRange,
  mediumDate,
  parseISODate,
  toISODate,
  type ActivityTemplate,
  type Category,
  type ScheduledTask,
  type TaskDraft,
} from "@klndr/core";
import { useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import {
  Card,
  DateTimeRow,
  DeleteCard,
  FieldRow,
  NotesCard,
  SheetScreen,
  SHEET_SIDE,
  Switch,
  Text,
  TitleCard,
} from "@/components/ui";
import { CategoryRows, useCategoryChoice } from "./category-rows";

const DEFAULT_EMOJI = "📌";
const DEFAULT_CATEGORY = "General";

const durationAt = (start: number, duration: number) => Math.min(duration, DAY_MINUTES - start);

export type TaskFormProps = {
  /** The block being edited; none when making a new one. */
  task?: ScheduledTask;
  day: string;
  /** Where a new block starts. */
  startMinutes: number;
  templates: ActivityTemplate[];
  categories: Category[];
  defaultDuration: number;
  /** Saves and closes; rejects with a message the form shows. */
  onSave: (payload: Omit<TaskDraft, "color">, newCategory: string | null) => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
};

/** `minutes` as a Date on a fixed day, for the native time picker, and back. */
const timeAsDate = (minutes: number) => new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60);
const dateAsMinutes = (date: Date) => date.getHours() * 60 + date.getMinutes();

/**
 * The form for a block, new or existing: what it is (an emoji and a name, or one of the activities), when
 * (the date, the start and the length) and which category it belongs to. The same fields as the web's editor,
 * in a sheet.
 */
export function TaskForm(props: TaskFormProps) {
  const { task, day, startMinutes, templates, categories, defaultDuration, onSave, onDelete, onClose } = props;

  const [title, setTitle] = useState(task?.title ?? "");
  const [emoji, setEmoji] = useState(task ? task.emoji : DEFAULT_EMOJI);
  const category = useCategoryChoice(categories, templates, task?.category ?? DEFAULT_CATEGORY);
  const [date, setDate] = useState(task?.day ?? day);
  const [start, setStart] = useState(clampStart(task?.startMinutes ?? startMinutes));
  const [duration, setDuration] = useState(durationAt(clampStart(task?.startMinutes ?? startMinutes), task?.durationMinutes ?? defaultDuration));
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [completed, setCompleted] = useState(task?.completed ?? false);
  const [templateId, setTemplateId] = useState<string | null>(task?.templateId ?? null);
  // Which picker is unfolded under its row: a form keeps one open at a time.
  const [unfolded, setUnfolded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const editing = Boolean(task);

  const end = start + duration;
  /** Moving the end changes the length; the end never goes before the start, nor past midnight. */
  const moveEnd = (next: Date) => {
    const minute = dateAsMinutes(next) || DAY_MINUTES;
    setDuration(Math.min(DAY_MINUTES - start, Math.max(SNAP_MINUTES, minute - start)));
  };

  /** Start from an activity: its name, emoji, category and length; notes only if there are none yet. */
  const applyTemplate = (template: ActivityTemplate | null) => {
    setTemplateId(template?.id ?? null);
    if (!template) return;
    setTitle(template.name);
    setEmoji(template.emoji);
    category.use(template.category);
    setDuration(durationAt(start, template.defaultDuration));
    if (!notes) setNotes(template.notes ?? "");
  };

  const submit = async () => {
    if (submitting.current) return;
    if (!title.trim()) {
      setError("Give this block a name.");
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      await onSave(
        {
          day: date,
          title: title.trim(),
          emoji,
          category: category.wanted || DEFAULT_CATEGORY,
          startMinutes: start,
          durationMinutes: duration,
          notes: notes.trim() || null,
          completed,
          templateId,
        },
        category.creating && category.wanted ? category.wanted : null,
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Something went wrong");
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <SheetScreen
      confirmDisabled={busy || !title.trim()}
      confirmLabel={editing ? "Save changes" : "Add block"}
      confirmLoading={busy}
      error={error}
      onClose={onClose}
      onConfirm={() => void submit()}
      subtitle={`${mediumDate(date)} · ${formatTimeRange(start, end)}`}
      title={editing ? "Edit block" : "New block"}
    >
      <TitleCard
        emoji={emoji}
        emojiLabel="Block emoji"
        maxLength={MAX_TITLE}
        onChangeText={setTitle}
        onEmojiChange={setEmoji}
        onSubmitEditing={() => void submit()}
        placeholder="Title"
        value={title}
      />

      {!editing && templates.length > 0 ? (
        <View className="gap-sm">
          <Text className="px-md" tone="muted" variant="caption" weight={600}>
            Start from an activity
          </Text>
          <ScrollView
            contentContainerStyle={{ gap: 8, paddingHorizontal: SHEET_SIDE }}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -SHEET_SIDE }}
          >
            {[null, ...templates].map((choice) => {
              const selected = (templateId ?? null) === (choice?.id ?? null);
              return (
                <Pressable
                  accessibilityLabel={choice ? choice.name : "Custom"}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  className={["flex-row items-center rounded-full", selected ? "bg-primary" : "bg-card"].join(" ")}
                  key={choice?.id ?? "custom"}
                  onPress={() => applyTemplate(choice)}
                  style={({ pressed }) => ({ gap: 6, minHeight: 38, paddingHorizontal: 14, opacity: pressed ? 0.6 : 1 })}
                >
                  {choice ? <Text style={{ fontSize: 15, lineHeight: 19 }}>{choice.emoji}</Text> : null}
                  <Text
                    numberOfLines={1}
                    style={{ maxWidth: 180 }}
                    tone={selected ? "primary-foreground" : "foreground"}
                    variant="caption"
                    weight={600}
                  >
                    {choice ? choice.name : "Custom"}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <Card>
        <DateTimeRow
          fields={[
            { id: "startDate", label: "Start date", mode: "date", value: parseISODate(date), onChange: (next) => setDate(toISODate(next)) },
            {
              id: "startTime",
              label: "Start time",
              mode: "time",
              value: timeAsDate(start),
              onChange: (next) => {
                const minute = clampStart(dateAsMinutes(next));
                setStart(minute);
                setDuration((current) => durationAt(minute, current));
              },
            },
          ]}
          label="Starts"
          onOpenChange={setUnfolded}
          open={unfolded}
        />
        <DateTimeRow
          divider={false}
          fields={[{ id: "endTime", label: "End time", mode: "time", value: timeAsDate(end), onChange: moveEnd }]}
          label="Ends"
          onOpenChange={setUnfolded}
          open={unfolded}
        />
      </Card>

      <View className="gap-sm">
        <Card>
          <CategoryRows choice={category} />
        </Card>
        {category.creating ? (
          <Text className="px-md" tone="muted" variant="caption">
            A new category is created when you save.
          </Text>
        ) : null}
      </View>

      <NotesCard
        maxLength={MAX_NOTES}
        onChangeText={setNotes}
        placeholder="Notes, links, a reminder for yourself…"
        value={notes}
      />

      <Card>
        <FieldRow divider={false} label="Done">
          <Switch bare label="Mark as completed" onValueChange={setCompleted} value={completed} />
        </FieldRow>
      </Card>

      {editing && onDelete ? <DeleteCard disabled={busy} label="Delete block" onPress={onDelete} /> : null}
    </SheetScreen>
  );
}
