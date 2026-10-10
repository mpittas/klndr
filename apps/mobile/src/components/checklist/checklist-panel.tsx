import type { DayChecklistItem } from "@klndr/core";
import type { useChecklist } from "@klndr/data";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";

import { Button, Card, Chip, CircleButton, EmojiButton, EmptyState, SegmentedControl, Text, TextField, useToast } from "@/components/ui";
import { Check, ChevronDown, ChevronRight, Ellipsis, ListChecks, Plus } from "@/icons";
import { PALETTE } from "@klndr/tokens";
import { useThemeColors, useThemeScheme } from "@/theme/tokens";

/** The emojis a new habit is given in turn, so adding several in a row needs no picking. */
const HABIT_EMOJIS = ["💊", "🥤", "🚿", "💧", "🧘", "🏋️", "🏃", "🥗", "🍳", "📚", "🧹", "☀️", "🌙", "🦷", "🛌", "🚶", "☕", "✨"];

const MAX_TITLE = 100;

const messageOf = (failure: unknown, fallback: string) => (failure instanceof Error && failure.message ? failure.message : fallback);

type Scope = "default" | "day";

/**
 * One day's checklist, as the web's panel: the count and bar, each routine (tap to tick; the "…" opens its
 * actions), the ones skipped for this day (with a way to bring them back), and a row to add another. The data
 * and what can be done to it come from `@klndr/data`'s `useChecklist`, so the shelf above the timeline and this
 * panel show and change the same thing.
 */
export function ChecklistPanel({ checklist }: { checklist: ReturnType<typeof useChecklist> }) {
  const toast = useToast();
  const colors = useThemeColors();
  const { items, skipped, stats, completedIds } = checklist;
  const completed = new Set(completedIds);
  const allDone = stats.total > 0 && stats.done === stats.total;

  // Only one row shows its actions or its editor at a time.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showSkipped, setShowSkipped] = useState(false);

  const run = async (task: () => Promise<unknown>, fallback: string) => {
    try {
      await task();
    } catch (failure) {
      toast.show({ message: messageOf(failure, fallback) });
    }
  };

  const confirmDelete = (item: DayChecklistItem) =>
    Alert.alert(`Delete “${item.title}”?`, "It is removed from your daily checklist, on every day.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void run(() => checklist.deleteRoutine({ id: item.id }), "Failed to delete item") },
    ]);

  return (
    <View className="gap-md">
      <QuickAdd checklist={checklist} />

      {stats.total > 0 ? <Progress allDone={allDone} done={stats.done} percentage={stats.percentage} total={stats.total} /> : null}

      {items.length === 0 ? (
        <EmptyState
          description={skipped.length === 0 ? "Add small habits above, like pills, a protein shake or a shower." : undefined}
          icon={<ListChecks color={colors["muted-foreground"]} size={22} />}
          title={skipped.length === 0 ? "No routines yet" : "Everything is skipped on this day"}
        />
      ) : (
        <Card>
          {items.map((item, index) => (
            <Row
              completed={completed.has(item.id)}
              divider={index < items.length - 1}
              editing={editingId === item.id}
              expanded={expandedId === item.id}
              item={item}
              key={item.id}
              onCancelEdit={() => setEditingId(null)}
              onDelete={() => (item.scope === "day" ? void run(() => checklist.removeOneOff({ id: item.id, title: item.title }), "Failed to remove item") : confirmDelete(item))}
              onEdit={() => {
                setExpandedId(null);
                setEditingId(item.id);
              }}
              onSave={async (patch) => {
                try {
                  await checklist.editRoutine(item.id, patch);
                  setEditingId(null);
                } catch (failure) {
                  toast.show({ message: messageOf(failure, "Failed to update item") });
                }
              }}
              onSkip={() => {
                setExpandedId(null);
                void run(() => checklist.skipForDay(item, true), "Failed to update this day");
              }}
              onToggle={() => checklist.toggle(item.id, !completed.has(item.id))}
              onToggleActions={() => setExpandedId((current) => (current === item.id ? null : item.id))}
            />
          ))}
        </Card>
      )}

      {skipped.length > 0 ? (
        <View className="gap-xs">
          <Pressable
            accessibilityLabel={`Skipped on this day, ${skipped.length}`}
            accessibilityRole="button"
            accessibilityState={{ expanded: showSkipped }}
            className="flex-row items-center gap-xs px-xs"
            onPress={() => setShowSkipped((value) => !value)}
            style={{ minHeight: 44 }}
          >
            {showSkipped ? <ChevronDown color={colors["muted-foreground"]} size={16} /> : <ChevronRight color={colors["muted-foreground"]} size={16} />}
            <Text tone="muted" variant="caption">
              Skipped on this day · {skipped.length}
            </Text>
          </Pressable>
          {showSkipped ? (
            <Card>
              {skipped.map((item, index) => (
                <View
                  className="flex-row items-center gap-sm px-md"
                  key={item.id}
                  style={{
                    minHeight: 52,
                    borderBottomWidth: index < skipped.length - 1 ? StyleSheet.hairlineWidth : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Text style={{ opacity: 0.5 }}>{item.emoji}</Text>
                  <Text className="flex-1" numberOfLines={1} tone="muted" variant="callout">
                    {item.title}
                  </Text>
                  <Button
                    label="Restore"
                    onPress={() => void run(() => checklist.skipForDay(item, false), "Failed to update this day")}
                    variant="secondary"
                  />
                </View>
              ))}
            </Card>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Progress({ done, total, percentage, allDone }: { done: number; total: number; percentage: number; allDone: boolean }) {
  const colors = useThemeColors();
  const scheme = useThemeScheme();
  const green = PALETTE.emerald[scheme].accent.background ?? colors.foreground;
  return (
    <View className="gap-xs px-xs">
      <Text numeric variant="callout" weight={600}>
        {allDone ? "All done for today" : `${done} `}
        {allDone ? null : (
          <Text numeric tone="muted" variant="callout">
            of {total} done
          </Text>
        )}
      </Text>
      <View
        accessibilityLabel="Checklist progress"
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: percentage }}
        className="h-1.5 overflow-hidden rounded-full bg-card"
      >
        <View style={{ height: "100%", width: `${percentage}%`, borderRadius: 9999, backgroundColor: allDone ? green : colors.foreground }} />
      </View>
    </View>
  );
}

type RowProps = {
  item: DayChecklistItem;
  completed: boolean;
  divider: boolean;
  expanded: boolean;
  editing: boolean;
  onToggle: () => void;
  onToggleActions: () => void;
  onEdit: () => void;
  onSkip: () => void;
  onDelete: () => void;
  onCancelEdit: () => void;
  onSave: (patch: { title: string; emoji: string }) => Promise<void>;
};

/** One routine: a tick circle with its emoji and title, a "…" for its actions, and its editor when it is being changed. */
function Row({ item, completed, divider, expanded, editing, onToggle, onToggleActions, onEdit, onSkip, onDelete, onCancelEdit, onSave }: RowProps) {
  const colors = useThemeColors();
  const scheme = useThemeScheme();
  const green = PALETTE.emerald[scheme].accent.background ?? colors.foreground;
  const [title, setTitle] = useState(item.title);
  const [emoji, setEmoji] = useState(item.emoji);
  const [saving, setSaving] = useState(false);

  // Each time the editor opens it starts from what the routine is now (it may have changed on another device).
  useEffect(() => {
    if (!editing) return;
    setTitle(item.title);
    setEmoji(item.emoji);
  }, [editing, item.title, item.emoji]);

  if (editing) {
    return (
      <View className="gap-sm bg-card p-md" style={divider ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border } : undefined}>
        <View className="flex-row items-center gap-sm">
          <EmojiButton emoji={emoji} label="Routine emoji" onChange={setEmoji} />
          <TextField className="flex-1" label="Title" maxLength={MAX_TITLE} onChangeText={setTitle} returnKeyType="done" value={title} />
        </View>
        <Text tone="muted" variant="caption">
          Changes apply across all days.
        </Text>
        <View className="flex-row gap-sm">
          <Button className="flex-1" disabled={saving} label="Cancel" onPress={onCancelEdit} variant="secondary" />
          <Button
            className="flex-1"
            disabled={!title.trim()}
            label="Save"
            loading={saving}
            onPress={() => {
              setSaving(true);
              void onSave({ title: title.trim(), emoji }).finally(() => setSaving(false));
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <View className="bg-card">
      <View className="flex-row items-center">
        <Pressable
          accessibilityLabel={`${item.title}${item.scope === "day" ? ", this day only" : ""}, ${completed ? "done" : "not done"}`}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: completed }}
          className="min-w-0 flex-1 flex-row items-center gap-md pl-md"
          onPress={onToggle}
          style={({ pressed }) => ({ minHeight: 54, opacity: pressed ? 0.6 : 1 })}
        >
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              borderWidth: completed ? 0 : 1.5,
              borderColor: colors["muted-foreground"],
              backgroundColor: completed ? green : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {completed ? <Check color="#ffffff" size={14} strokeWidth={3.5} /> : null}
          </View>
          <Text style={{ fontSize: 18, lineHeight: 22, opacity: completed ? 0.5 : 1 }}>{item.emoji}</Text>
          <View className="min-w-0 flex-1">
            <Text
              numberOfLines={2}
              style={{ textDecorationLine: completed ? "line-through" : "none" }}
              tone={completed ? "muted" : "foreground"}
              variant="callout"
            >
              {item.title}
            </Text>
            {item.scope === "day" ? (
              <Text tone="muted" variant="caption">
                This day only
              </Text>
            ) : null}
          </View>
        </Pressable>

        <Pressable
          accessibilityLabel={`Actions for ${item.title}`}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          className="items-center justify-center"
          onPress={onToggleActions}
          style={({ pressed }) => ({ width: 52, minHeight: 54, opacity: pressed ? 0.6 : 1 })}
        >
          <Ellipsis color={colors["muted-foreground"]} size={20} />
        </Pressable>
      </View>

      {expanded ? (
        <View className="flex-row flex-wrap gap-sm pb-md" style={{ paddingLeft: 56 }}>
          {item.scope === "default" ? (
            <>
              <Chip compact label="Edit" onPress={onEdit} />
              <Chip compact label="Skip this day" onPress={onSkip} />
            </>
          ) : null}
          <Chip compact label={item.scope === "day" ? "Remove" : "Delete"} onPress={onDelete} />
        </View>
      ) : null}

      {divider ? (
        <View
          pointerEvents="none"
          style={{ position: "absolute", bottom: 0, right: 0, left: 56, height: StyleSheet.hairlineWidth, backgroundColor: colors.border }}
        />
      ) : null}
    </View>
  );
}

/** The "add a habit" card: an emoji, a title, and whether it is for every day or only this one. */
function QuickAdd({ checklist }: { checklist: ReturnType<typeof useChecklist> }) {
  const toast = useToast();
  const colors = useThemeColors();
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState(HABIT_EMOJIS[0]);
  const [scope, setScope] = useState<Scope>("default");
  const [adding, setAdding] = useState(false);

  const submit = async () => {
    const trimmed = title.trim();
    if (!trimmed || adding) return;
    setAdding(true);
    try {
      if (scope === "day") await checklist.addForToday({ title: trimmed, emoji });
      else await checklist.addRoutine({ title: trimmed, emoji });
      setTitle("");
      const at = HABIT_EMOJIS.indexOf(emoji);
      if (at >= 0 && at < HABIT_EMOJIS.length - 1) setEmoji(HABIT_EMOJIS[at + 1]);
    } catch (failure) {
      toast.show({ message: messageOf(failure, "Failed to add item") });
    } finally {
      setAdding(false);
    }
  };

  return (
    <Card className="gap-sm p-sm">
      <View className="flex-row items-center gap-sm">
        <EmojiButton emoji={emoji} label="Routine emoji" onChange={setEmoji} />
        <TextField
          appearance="bare"
          autoCapitalize="sentences"
          className="flex-1"
          label="Add a habit"
          maxLength={MAX_TITLE}
          onChangeText={setTitle}
          onSubmitEditing={() => void submit()}
          placeholder="Add a habit, e.g. Take vitamins"
          returnKeyType="done"
          value={title}
        />
        <CircleButton disabled={!title.trim() || adding} label="Add" onPress={() => void submit()} size={36} variant="primary">
          <Plus color={colors["primary-foreground"]} size={20} strokeWidth={2.6} />
        </CircleButton>
      </View>
      <SegmentedControl
        label="Where to add the item"
        onChange={setScope}
        options={[
          { label: "Every day", value: "default" },
          { label: "This day only", value: "day" },
        ]}
        value={scope}
      />
    </Card>
  );
}
