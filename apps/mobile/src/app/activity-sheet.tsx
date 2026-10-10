import {
  DURATION_CHOICES,
  FALLBACK_EMOJI,
  MAX_CATEGORY,
  MAX_NOTES,
  MAX_TITLE,
  colorOfCategory,
  formatDuration,
  nextCategoryColor,
  withImplicitCategories,
  type ActivityTemplate,
  type Category,
} from "@klndr/core";
import {
  useCategories,
  useEmojiFill,
  useEmojiSuggester,
  useLibraryActions,
  useRememberedEmoji,
  useTemplates,
} from "@klndr/data";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";

import {
  Button,
  Card,
  EmojiButton,
  EmptyState,
  FieldRow,
  IconTile,
  ListRow,
  Picker,
  SheetFooter,
  SheetHeader,
  Skeleton,
  Text,
  TextField,
} from "@/components/ui";
import { Hourglass, Tag, Trash } from "@/icons";
import { useThemeColors } from "@/theme/tokens";

const NEW_CATEGORY = "\u0000new";
const DEFAULT_CATEGORY = "General";
const NO_CATEGORIES: Category[] = [];
const NO_TEMPLATES: ActivityTemplate[] = [];

/**
 * The sheet for an activity, new (`?category=…`) or existing (`?id=…`): its emoji and name, the category it
 * lives in, how long a block made from it lasts, and a note that comes with it. The emoji is picked for the
 * name by the server after saving, so saving never waits on it, unless it was chosen by hand.
 */
export default function ActivitySheet() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; category?: string }>();
  const templatesQuery = useTemplates();
  const categoriesQuery = useCategories();
  const templates = templatesQuery.data ?? NO_TEMPLATES;
  const categories = categoriesQuery.data ?? NO_CATEGORIES;
  const template = params.id ? templates.find((item) => item.id === params.id) : undefined;
  const close = () => router.back();

  if (params.id && !template) {
    return templatesQuery.isPending ? (
      <View className="flex-1 gap-sm bg-canvas p-md pt-lg">
        <Skeleton height={28} width="50%" />
        <Skeleton height={44} />
        <Skeleton height={44} />
      </View>
    ) : (
      <View className="flex-1 justify-center bg-canvas">
        <EmptyState
          action={<Button label="Close" onPress={close} variant="surface" />}
          description="It may have been deleted on another device."
          title="This activity is gone"
        />
      </View>
    );
  }

  return (
    <ActivityForm
      categories={categories}
      initialCategory={params.category || DEFAULT_CATEGORY}
      key={template?.id ?? "new"}
      onClose={close}
      template={template}
      templates={templates}
    />
  );
}

function ActivityForm({
  template,
  templates,
  categories,
  initialCategory,
  onClose,
}: {
  template?: ActivityTemplate;
  templates: ActivityTemplate[];
  categories: Category[];
  initialCategory: string;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const library = useLibraryActions();
  const suggest = useEmojiSuggester();
  const remembered = useRememberedEmoji();
  const fillEmoji = useEmojiFill();

  const editing = Boolean(template);
  const [name, setName] = useState(template?.name ?? "");
  const [emoji, setEmoji] = useState(template?.emoji ?? FALLBACK_EMOJI.activity);
  const [byHand, setByHand] = useState(false);
  const [category, setCategory] = useState(template?.category ?? initialCategory);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [duration, setDuration] = useState(template?.defaultDuration ?? 60);
  const [notes, setNotes] = useState(template?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const categoryOptions = useMemo(() => {
    const names = withImplicitCategories(categories, templates).map((entry) => entry.name);
    if (category && !names.some((entry) => entry.toLowerCase() === category.toLowerCase())) names.push(category);
    return [...names.map((entry) => ({ label: entry, value: entry })), { label: "New category…", value: NEW_CATEGORY }];
  }, [categories, templates, category]);

  const durationOptions = useMemo(
    () => [...new Set([...DURATION_CHOICES, duration])].sort((a, b) => a - b).map((minutes) => ({ label: formatDuration(minutes), value: minutes })),
    [duration],
  );

  const submit = async () => {
    if (submitting.current) return;
    const title = name.trim();
    if (!title) return setError("Give this activity a name.");
    const wantedCategory = creating ? newName.trim() : category;
    if (creating && !wantedCategory) return setError("Name the new category, or pick an existing one.");

    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      // A category typed here is made first, with the next free colour, so the activity can be painted with it.
      let color = colorOfCategory(categories, { category: wantedCategory });
      const known = withImplicitCategories(categories, templates).some(
        (entry) => entry.name.toLowerCase() === wantedCategory.toLowerCase(),
      );
      if (creating && !known) {
        color = (await library.createCategory({ draft: { name: wantedCategory, color: nextCategoryColor(categories) } })).color;
      }

      // The emoji follows the name unless it was chosen by hand; a name seen before gets its emoji at once,
      // and a new one is saved with a stand-in that is replaced when the server has picked.
      const needsPick = !byHand && (!editing || title !== template?.name);
      const now = needsPick ? remembered(title, "activity") : null;
      const saveEmoji = now ?? emoji;

      const saved = await library.saveTemplate({
        id: template?.id ?? null,
        draft: {
          name: title,
          emoji: saveEmoji,
          color,
          category: wantedCategory || DEFAULT_CATEGORY,
          defaultDuration: duration,
          notes: notes.trim() || null,
        },
      });
      if (needsPick && !now) void fillEmoji({ kind: "template", id: saved.id }, saveEmoji, suggest(title, "activity"));
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save");
      submitting.current = false;
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    if (!template) return;
    Alert.alert(`Delete “${template.name}”?`, "Blocks already on your timeline stay, as plain blocks.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          setBusy(true);
          library.deleteTemplate({ id: template.id }).then(onClose, (failure: unknown) => {
            setError(failure instanceof Error ? failure.message : "Could not delete");
            setBusy(false);
          });
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-canvas">
      <SheetHeader onClose={onClose} subtitle={editing ? template?.category : undefined} title={editing ? "Edit activity" : "New activity"} />

      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ gap: 20, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 }}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
      >
        <View className="gap-sm">
          <Card className="flex-row items-center gap-md p-sm">
            <EmojiButton
              emoji={emoji}
              label="Activity emoji"
              onChange={(picked) => {
                setEmoji(picked);
                setByHand(true);
              }}
              size="large"
            />
            <TextField
              appearance="bare"
              autoCapitalize="sentences"
              className="flex-1"
              label="Name"
              maxLength={MAX_TITLE}
              onChangeText={setName}
              placeholder="e.g. Deep focus, Workout"
              prominent
              returnKeyType="done"
              value={name}
            />
          </Card>
          {byHand || (editing && name.trim() === template?.name) ? null : (
            <Text className="px-md" tone="muted" variant="caption">
              The emoji is picked to match the name when you save. Tap it to choose your own.
            </Text>
          )}
        </View>

        <View className="gap-sm">
          <Card>
            <FieldRow
              divider
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
              <View className="px-md" style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
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
            <FieldRow
              divider={false}
              label="Default length"
              leading={tile(<Hourglass color={colors.foreground} size={15} strokeWidth={2.2} />)}
            >
              <Picker bare label="Default length" onChange={setDuration} options={durationOptions} value={duration} />
            </FieldRow>
          </Card>
          {creating ? (
            <Text className="px-md" tone="muted" variant="caption">
              A new category is created when you save.
            </Text>
          ) : null}
        </View>

        <View className="gap-sm">
          <Card className="px-md">
            <TextField
              appearance="bare"
              autoCapitalize="sentences"
              label="Notes"
              maxLength={MAX_NOTES}
              multiline
              onChangeText={setNotes}
              placeholder="Any details, reminders, or goals…"
              value={notes}
            />
          </Card>
          <Text className="px-md" tone="muted" variant="caption">
            Copied into each block you make from this activity.
          </Text>
        </View>

        {editing ? (
          <Card>
            <ListRow
              chevron={false}
              destructive
              disabled={busy}
              divider={false}
              label="Delete activity"
              leading={tile(<Trash color={colors.destructive} size={15} strokeWidth={2.2} />)}
              leadingWidth={28}
              onPress={confirmDelete}
            />
          </Card>
        ) : null}
      </ScrollView>

      <SheetFooter error={error}>
        <Button className="flex-1" disabled={busy} label="Cancel" onPress={onClose} size="large" variant="surface" />
        <Button
          className="flex-[1.6]"
          label={editing ? "Save changes" : "Add activity"}
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
