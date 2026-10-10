import {
  DURATION_CHOICES,
  DAY_MINUTES,
  MAX_TITLE,
  MAX_CATEGORY,
  MAX_NOTES,
  clampStart,
  formatDuration,
  formatTimeRange,
  mediumDate,
  parseISODate,
  toISODate,
  withImplicitCategories,
  type ActivityTemplate,
  type Category,
  type ScheduledTask,
  type TaskDraft,
} from "@klndr/core";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";

import {
  Button,
  Card,
  DateTimePicker,
  EmojiButton,
  FieldRow,
  IconTile,
  ListRow,
  Picker,
  SheetFooter,
  SheetHeader,
  Switch,
  Text,
  TextField,
} from "@/components/ui";
import { CalendarDays, CircleCheck, Clock, Hourglass, Tag, Trash } from "@/icons";
import { useThemeColors } from "@/theme/tokens";

const NEW_CATEGORY = "\u0000new";
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
 * (the date, the start and the length, with the native pickers) and which category it belongs to. The same
 * fields as the web's editor, in a sheet.
 */
export function TaskForm(props: TaskFormProps) {
  const { task, day, startMinutes, templates, categories, defaultDuration, onSave, onDelete, onClose } = props;
  const colors = useThemeColors();

  const [title, setTitle] = useState(task?.title ?? "");
  const [emoji, setEmoji] = useState(task ? task.emoji : DEFAULT_EMOJI);
  const [category, setCategory] = useState(task?.category ?? DEFAULT_CATEGORY);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [date, setDate] = useState(task?.day ?? day);
  const [start, setStart] = useState(clampStart(task?.startMinutes ?? startMinutes));
  const [duration, setDuration] = useState(durationAt(clampStart(task?.startMinutes ?? startMinutes), task?.durationMinutes ?? defaultDuration));
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [completed, setCompleted] = useState(task?.completed ?? false);
  const [templateId, setTemplateId] = useState<string | null>(task?.templateId ?? null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const editing = Boolean(task);
  const shownCategory = creating ? newName.trim() || DEFAULT_CATEGORY : category;

  const categoryOptions = useMemo(() => {
    const names = withImplicitCategories(categories, templates).map((entry) => entry.name);
    if (category && !names.some((name) => name.toLowerCase() === category.toLowerCase())) names.push(category);
    return [
      ...names.map((name) => ({ label: name, value: name })),
      { label: "New category…", value: NEW_CATEGORY },
    ];
  }, [categories, templates, category]);

  const durationOptions = useMemo(
    () =>
      [...new Set([...DURATION_CHOICES, duration])]
        .filter((minutes) => minutes <= DAY_MINUTES - start)
        .sort((a, b) => a - b)
        .map((minutes) => ({ label: formatDuration(minutes), value: minutes })),
    [duration, start],
  );

  /** Start from an activity: its name, emoji, category and length; notes only if there are none yet. */
  const applyTemplate = (template: ActivityTemplate | null) => {
    setTemplateId(template?.id ?? null);
    if (!template) return;
    setTitle(template.name);
    setEmoji(template.emoji);
    setCategory(template.category);
    setCreating(false);
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
          category: shownCategory,
          startMinutes: start,
          durationMinutes: duration,
          notes: notes.trim() || null,
          completed,
          templateId,
        },
        creating && newName.trim() ? newName.trim() : null,
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Something went wrong");
      submitting.current = false;
      setBusy(false);
    }
  };

  const timeRange = formatTimeRange(start, start + duration);

  return (
    <View className="flex-1 bg-canvas">
      <SheetHeader onClose={onClose} subtitle={`${mediumDate(date)} · ${timeRange}`} title={editing ? "Edit block" : "New block"} />

      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ gap: 20, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 }}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
      >
        <Card className="flex-row items-center gap-md p-sm">
          <EmojiButton emoji={emoji} label="Block emoji" onChange={setEmoji} size="large" />
          <TextField
            appearance="bare"
            autoCapitalize="sentences"
            className="flex-1"
            label="Name"
            maxLength={MAX_TITLE}
            onChangeText={setTitle}
            onSubmitEditing={() => void submit()}
            placeholder="What’s the plan?"
            prominent
            returnKeyType="done"
            value={title}
          />
        </Card>

        {!editing && templates.length > 0 ? (
          <View className="gap-sm">
            <Text className="px-md" tone="muted" variant="caption" weight={600}>
              Start from an activity
            </Text>
            <ScrollView
              contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -16 }}
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
          <FieldRow label="Date" leading={tile(<CalendarDays color={colors.foreground} size={15} strokeWidth={2.2} />)}>
            <DateTimePicker
              bare
              display="compact"
              label="Date"
              mode="date"
              onChange={(next) => setDate(toISODate(next))}
              value={parseISODate(date)}
            />
          </FieldRow>
          <FieldRow label="Starts" leading={tile(<Clock color={colors.foreground} size={15} strokeWidth={2.2} />)}>
            <DateTimePicker
              bare
              display="compact"
              label="Start time"
              mode="time"
              onChange={(next) => {
                const minute = clampStart(dateAsMinutes(next));
                setStart(minute);
                setDuration((current) => durationAt(minute, current));
              }}
              value={timeAsDate(start)}
            />
          </FieldRow>
          <FieldRow label="Duration" leading={tile(<Hourglass color={colors.foreground} size={15} strokeWidth={2.2} />)}>
            <Picker bare label="Duration" onChange={setDuration} options={durationOptions} value={duration} />
          </FieldRow>
          <FieldRow
            divider={creating}
            label="Category"
            leading={tile(<Tag color={colors.foreground} size={15} strokeWidth={2.2} />)}
          >
            <Picker
              bare
              label="Category"
              onChange={(next) => {
                if (next === NEW_CATEGORY) return setCreating(true);
                setCreating(false);
                setCategory(next);
              }}
              options={categoryOptions}
              value={creating ? NEW_CATEGORY : category}
            />
          </FieldRow>
          {creating ? (
            <View className="px-md pb-xs">
              <TextField
                appearance="bare"
                autoCapitalize="words"
                autoFocus
                label="New category name"
                maxLength={MAX_CATEGORY}
                onChangeText={setNewName}
                placeholder="New category name"
                returnKeyType="done"
                value={newName}
              />
            </View>
          ) : null}
        </Card>
        {creating ? (
          <Text className="-mt-sm px-md" tone="muted" variant="caption">
            A new category is created when you save.
          </Text>
        ) : null}

        <Card className="px-md">
          <TextField
            appearance="bare"
            autoCapitalize="sentences"
            label="Notes"
            maxLength={MAX_NOTES}
            multiline
            onChangeText={setNotes}
            placeholder="Notes, links, a reminder for yourself…"
            value={notes}
          />
        </Card>

        <Card>
          <FieldRow
            divider={false}
            label="Done"
            leading={tile(<CircleCheck color={colors.foreground} size={15} strokeWidth={2.2} />)}
          >
            <Switch bare label="Mark as completed" onValueChange={setCompleted} value={completed} />
          </FieldRow>
        </Card>

        {editing && onDelete ? (
          <Card>
            <ListRow
              chevron={false}
              destructive
              disabled={busy}
              divider={false}
              label="Delete block"
              leading={tile(<Trash color={colors.destructive} size={15} strokeWidth={2.2} />)}
              leadingWidth={28}
              onPress={onDelete}
            />
          </Card>
        ) : null}
      </ScrollView>

      {/* Pinned under the form, so the action and any problem are always in view. */}
      <SheetFooter error={error}>
        <Button className="flex-1" disabled={busy} label="Cancel" onPress={onClose} size="large" variant="surface" />
        <Button
          className="flex-[1.6]"
          label={editing ? "Save changes" : "Add block"}
          loading={busy}
          onPress={() => void submit()}
          size="large"
        />
      </SheetFooter>
    </View>
  );
}

/** A form row's small grey icon tile. */
const tile = (icon: ReactNode) => <IconTile size={28}>{icon}</IconTile>;
