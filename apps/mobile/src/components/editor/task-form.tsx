import {
  DURATION_CHOICES,
  DAY_MINUTES,
  MAX_TITLE,
  MAX_CATEGORY,
  MAX_NOTES,
  clampStart,
  formatDuration,
  formatTime,
  parseISODate,
  toISODate,
  withImplicitCategories,
  type ActivityTemplate,
  type Category,
  type ScheduledTask,
  type TaskDraft,
} from "@klndr/core";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Button, DateTimePicker, IconButton, Picker, Switch, Text, TextField } from "@/components/ui";
import { Trash } from "@/icons";
import { askForEmoji } from "@/lib/emoji";
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
  const router = useRouter();
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

  const chooseEmoji = () => {
    askForEmoji(setEmoji);
    router.push("/emoji-sheet");
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

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ gap: 16, padding: 16, paddingTop: 20 }}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
      >
        <View className="gap-xs">
          <Text accessibilityRole="header" variant="title">
            {editing ? "Edit time block" : "New time block"}
          </Text>
          <Text numeric tone="muted" variant="caption">
            {formatTime(start)} · {formatDuration(duration)}
          </Text>
        </View>

        {!editing && templates.length > 0 ? (
          <View className="gap-xs">
            <Text tone="muted" variant="caption">
              Start from an activity
            </Text>
            <ScrollView contentContainerStyle={{ gap: 6, paddingRight: 16 }} horizontal showsHorizontalScrollIndicator={false}>
              {[null, ...templates].map((choice) => {
                const selected = (templateId ?? null) === (choice?.id ?? null);
                return (
                  <Pressable
                    accessibilityLabel={choice ? choice.name : "Custom"}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    key={choice?.id ?? "custom"}
                    onPress={() => applyTemplate(choice)}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      minHeight: 40,
                      borderRadius: 9999,
                      borderWidth: 1,
                      borderColor: selected ? colors.primary : colors.input,
                      backgroundColor: selected ? colors.primary : colors.background,
                      opacity: pressed ? 0.7 : 1,
                      paddingHorizontal: 14,
                    })}
                  >
                    {choice ? <Text variant="caption">{choice.emoji}</Text> : null}
                    <Text numberOfLines={1} style={{ maxWidth: 180 }} tone={selected ? "primary-foreground" : "foreground"} variant="caption">
                      {choice ? choice.name : "Custom"}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <View className="flex-row items-end gap-sm">
          <Pressable
            accessibilityHint="Opens the emoji picker"
            accessibilityLabel={`Emoji, ${emoji || "none"}`}
            accessibilityRole="button"
            onPress={chooseEmoji}
            style={({ pressed }) => ({
              width: 56,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.input,
              backgroundColor: colors.card,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ fontSize: 24, lineHeight: 30 }}>{emoji || "＋"}</Text>
          </Pressable>
          <TextField
            autoCapitalize="sentences"
            className="flex-1"
            label="Activity name"
            maxLength={MAX_TITLE}
            onChangeText={setTitle}
            onSubmitEditing={() => void submit()}
            placeholder="e.g. Deep focus, Workout"
            returnKeyType="done"
            value={title}
          />
        </View>

        <View className="flex-row gap-md">
          <DateTimePicker
            className="flex-1"
            display="compact"
            label="Date"
            mode="date"
            onChange={(next) => setDate(toISODate(next))}
            value={parseISODate(date)}
          />
          <DateTimePicker
            className="flex-1"
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
        </View>

        <View className="flex-row gap-md">
          <Picker className="flex-1" label="Duration" onChange={setDuration} options={durationOptions} value={duration} />
          <Picker
            className="flex-1"
            label="Category"
            onChange={(next) => {
              if (next === NEW_CATEGORY) return setCreating(true);
              setCreating(false);
              setCategory(next);
            }}
            options={categoryOptions}
            value={creating ? NEW_CATEGORY : category}
          />
        </View>

        {creating ? (
          <TextField
            autoCapitalize="words"
            helper="A new category is created when you save."
            label="New category name"
            maxLength={MAX_CATEGORY}
            onChangeText={setNewName}
            returnKeyType="done"
            value={newName}
          />
        ) : null}

        <TextField
          autoCapitalize="sentences"
          label="Notes"
          maxLength={MAX_NOTES}
          multiline
          onChangeText={setNotes}
          placeholder="Any details, reminders, or goals…"
          value={notes}
        />

        <Switch label="Mark as completed" onValueChange={setCompleted} value={completed} />
      </ScrollView>

      {/* Pinned under the form, so the action and any problem are always in view. */}
      <View className="gap-sm border-t border-border bg-background px-md pb-lg pt-sm">
        {error ? (
          <Text accessibilityLiveRegion="polite" tone="destructive" variant="caption">
            {error}
          </Text>
        ) : null}
        <View className="flex-row items-center gap-sm">
          {editing && onDelete ? (
            <IconButton disabled={busy} label="Delete block" onPress={onDelete} variant="destructive">
              <Trash color={colors.destructive} size={20} />
            </IconButton>
          ) : null}
          <Button disabled={busy} className="flex-1" label="Cancel" onPress={onClose} variant="secondary" />
          <Button
            className="flex-[1.6]"
            label={editing ? "Save changes" : "Add to schedule"}
            loading={busy}
            onPress={() => void submit()}
          />
        </View>
      </View>
    </View>
  );
}
