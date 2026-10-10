import {
  DURATION_CHOICES,
  FALLBACK_EMOJI,
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
import { useMemo, useRef, useState } from "react";
import { Alert, View } from "react-native";

import { CategoryRows, useCategoryChoice } from "@/components/editor/category-rows";
import {
  Card,
  DeleteCard,
  FieldRow,
  FormFooter,
  NameCard,
  NotesCard,
  Picker,
  RowIcon,
  SheetLoading,
  SheetMessage,
  SheetScreen,
  Text,
} from "@/components/ui";
import { Hourglass } from "@/icons";

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
      <SheetLoading />
    ) : (
      <SheetMessage
        actionLabel="Close"
        description="It may have been deleted on another device."
        onAction={close}
        title="This activity is gone"
      />
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
  const library = useLibraryActions();
  const suggest = useEmojiSuggester();
  const remembered = useRememberedEmoji();
  const fillEmoji = useEmojiFill();

  const editing = Boolean(template);
  const [name, setName] = useState(template?.name ?? "");
  const [emoji, setEmoji] = useState(template?.emoji ?? FALLBACK_EMOJI.activity);
  const [byHand, setByHand] = useState(false);
  const category = useCategoryChoice(categories, templates, template?.category ?? initialCategory);
  const [duration, setDuration] = useState(template?.defaultDuration ?? 60);
  const [notes, setNotes] = useState(template?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const durationOptions = useMemo(
    () => [...new Set([...DURATION_CHOICES, duration])].sort((a, b) => a - b).map((minutes) => ({ label: formatDuration(minutes), value: minutes })),
    [duration],
  );

  const submit = async () => {
    if (submitting.current) return;
    const title = name.trim();
    if (!title) return setError("Give this activity a name.");
    const wantedCategory = category.wanted;
    if (category.creating && !wantedCategory) return setError("Name the new category, or pick an existing one.");

    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      // A category typed here is made first, with the next free colour, so the activity can be painted with it.
      let color = colorOfCategory(categories, { category: wantedCategory });
      const known = withImplicitCategories(categories, templates).some(
        (entry) => entry.name.toLowerCase() === wantedCategory.toLowerCase(),
      );
      if (category.creating && !known) {
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
    <SheetScreen
      footer={
        <FormFooter
          busy={busy}
          error={error}
          onCancel={onClose}
          onSubmit={() => void submit()}
          submitLabel={editing ? "Save changes" : "Add activity"}
        />
      }
      onClose={onClose}
      subtitle={editing ? template?.category : undefined}
      title={editing ? "Edit activity" : "New activity"}
    >
      <View className="gap-sm">
        <NameCard
          emoji={emoji}
          emojiLabel="Activity emoji"
          maxLength={MAX_TITLE}
          onChangeText={setName}
          onEmojiChange={(picked) => {
            setEmoji(picked);
            setByHand(true);
          }}
          placeholder="e.g. Deep focus, Workout"
          value={name}
        />
        {byHand || (editing && name.trim() === template?.name) ? null : (
          <Text className="px-md" tone="muted" variant="caption">
            The emoji is picked to match the name when you save. Tap it to choose your own.
          </Text>
        )}
      </View>

      <View className="gap-sm">
        <Card>
          <CategoryRows choice={category} last={false} />
          <FieldRow divider={false} label="Default length" leading={<RowIcon icon={Hourglass} />}>
            <Picker bare label="Default length" onChange={setDuration} options={durationOptions} value={duration} />
          </FieldRow>
        </Card>
        {category.creating ? (
          <Text className="px-md" tone="muted" variant="caption">
            A new category is created when you save.
          </Text>
        ) : null}
      </View>

      <View className="gap-sm">
        <NotesCard
          maxLength={MAX_NOTES}
          onChangeText={setNotes}
          placeholder="Any details, reminders, or goals…"
          value={notes}
        />
        <Text className="px-md" tone="muted" variant="caption">
          Copied into each block you make from this activity.
        </Text>
      </View>

      {editing ? <DeleteCard disabled={busy} label="Delete activity" onPress={confirmDelete} /> : null}
    </SheetScreen>
  );
}
