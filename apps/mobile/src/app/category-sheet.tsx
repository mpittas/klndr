import {
  COLOR_KEYS,
  FALLBACK_EMOJI,
  MAX_CATEGORY,
  canonicalColor,
  nextCategoryColor,
  withImplicitCategories,
  type ActivityTemplate,
  type Category,
} from "@klndr/core";
import {
  useCategories,
  useData,
  useEmojiFill,
  useEmojiSuggester,
  useLibraryActions,
  useRememberedEmoji,
  useTemplates,
} from "@klndr/data";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Alert, View } from "react-native";

import {
  Button,
  ColorSwatch,
  DeleteCard,
  Picker,
  Section,
  SegmentedControl,
  SheetLoading,
  SheetMessage,
  SheetScreen,
  Text,
  TitleCard,
} from "@/components/ui";

const GENERAL = "General";
const NO_CATEGORIES: Category[] = [];
const NO_TEMPLATES: ActivityTemplate[] = [];

/**
 * The sheet for a category: new, or opened from the library (`?id=…`; a name the activities use but nobody has
 * saved yet comes as `?name=…`). Rename it, recolour it, or delete it — its activities then go to another
 * category, or are deleted with it. Renaming and recolouring reach its activities and blocks through
 * `@klndr/data`, which relabels them in the same step.
 */
export default function CategorySheet() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  const categoriesQuery = useCategories();
  const templatesQuery = useTemplates();
  const categories = categoriesQuery.data ?? NO_CATEGORIES;
  const templates = templatesQuery.data ?? NO_TEMPLATES;
  const close = () => router.back();

  const saved = params.id ? categories.find((category) => category.id === params.id) : undefined;
  if (params.id && !saved) {
    return categoriesQuery.isPending ? (
      <SheetLoading />
    ) : (
      <SheetMessage
        actionLabel="Close"
        description="It may have been deleted on another device."
        onAction={close}
        title="This category is gone"
      />
    );
  }

  // A name the activities use that has no category saved under it: the colour it shows is its activities'.
  const unsavedName = !saved && params.name ? params.name : null;
  const unsavedColor = unsavedName
    ? (withImplicitCategories(categories, templates).find((entry) => entry.name === unsavedName)?.color ?? "slate")
    : null;

  return (
    <CategoryForm
      categories={categories}
      category={saved}
      key={saved?.id ?? unsavedName ?? "new"}
      onClose={close}
      templates={templates}
      unsaved={unsavedName ? { name: unsavedName, color: unsavedColor ?? "slate" } : null}
    />
  );
}

function CategoryForm({
  category,
  unsaved,
  categories,
  templates,
  onClose,
}: {
  category?: Category;
  unsaved: { name: string; color: string } | null;
  categories: Category[];
  templates: ActivityTemplate[];
  onClose: () => void;
}) {
  const { api } = useData();
  const library = useLibraryActions();
  const suggest = useEmojiSuggester();
  const remembered = useRememberedEmoji();
  const fillEmoji = useEmojiFill();

  const editing = Boolean(category);
  const initialName = category?.name ?? unsaved?.name ?? "";
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(() =>
    category || unsaved ? canonicalColor((category ?? unsaved)!.color) : nextCategoryColor(categories),
  );
  const [emoji, setEmoji] = useState(category?.emoji ?? FALLBACK_EMOJI.category);
  const [byHand, setByHand] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // ---- deleting ----
  const [deleting, setDeleting] = useState(false);
  const [mode, setMode] = useState<"move" | "delete">("move");
  const own = category ? templates.filter((template) => template.category === category.name) : [];
  const targets = useMemo(
    () =>
      withImplicitCategories(categories, templates)
        .filter((entry) => entry.name !== category?.name)
        .map((entry) => ({ label: entry.name, value: entry.name })),
    [categories, templates, category?.name],
  );
  const [moveTo, setMoveTo] = useState(() => (targets.find((target) => target.value === GENERAL) ?? targets[0])?.value ?? "");
  const deleteMode = own.length > 0 && targets.length === 0 ? "delete" : mode;

  const submit = async () => {
    if (submitting.current) return;
    const title = name.trim();
    if (!title) return setError("Give your category a name.");
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      // The emoji follows the name unless it was chosen by hand; a name seen before gets its emoji at once.
      const renamed = editing && title !== category?.name;
      const needsPick = !byHand && (!editing || renamed || !category?.emoji);
      const now = needsPick ? remembered(title, "category") : null;
      const chosen = byHand ? emoji : (now ?? category?.emoji ?? null);

      if (category) {
        await library.updateCategory({
          id: category.id,
          patch: { name: title, color, ...(chosen ? { emoji: chosen } : {}) },
        });
        if (needsPick && !now) void fillEmoji({ kind: "category", id: category.id }, category.emoji ?? null, suggest(title, "category"));
      } else {
        const stand = chosen ?? FALLBACK_EMOJI.category;
        const created = await library.createCategory({ draft: { name: title, color, emoji: stand } });
        if (needsPick && !now) void fillEmoji({ kind: "category", id: created.id }, stand, suggest(title, "category"));
      }
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save");
      submitting.current = false;
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!category) return;
    setBusy(true);
    setError(null);
    try {
      if (own.length === 0) {
        // The list here can be out of date, so ask the server before treating the category as empty.
        const fresh = (await api.getTemplates()).filter((template) => template.category === category.name).length;
        if (fresh > 0) {
          setError("This category has activities now. Choose what should happen to them.");
          setBusy(false);
          return;
        }
      }
      await library.deleteCategory({
        id: category.id,
        target: own.length === 0 ? undefined : deleteMode === "delete" ? { deleteActivities: true } : { moveTo },
      });
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not delete");
      setBusy(false);
    }
  };

  const askRemove = () => {
    if (own.length > 0 && deleteMode === "delete") {
      Alert.alert(
        `Delete “${category?.name}” and its activities?`,
        `${own.length === 1 ? "1 activity is" : `${own.length} activities are`} deleted for good. Blocks already on your timeline stay.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete both", style: "destructive", onPress: () => void remove() },
        ],
      );
    } else {
      void remove();
    }
  };

  return (
    <SheetScreen
      confirmDisabled={busy || !name.trim()}
      confirmLabel={editing ? "Save changes" : unsaved ? "Save category" : "Add category"}
      confirmLoading={busy && !deleting}
      error={error}
      onClose={onClose}
      onConfirm={() => void submit()}
      subtitle={category ? (own.length === 1 ? "1 activity" : `${own.length} activities`) : undefined}
      title={editing ? "Edit category" : unsaved ? "Save category" : "New category"}
    >
      <View className="gap-sm">
        <TitleCard
          autoCapitalize="words"
          editable={!unsaved}
          emoji={emoji}
          emojiLabel="Category emoji"
          maxLength={MAX_CATEGORY}
          onChangeText={setName}
          onEmojiChange={(picked) => {
            setEmoji(picked);
            setByHand(true);
          }}
          placeholder="Name, e.g. Health"
          value={name}
        />
        {unsaved ? (
          <Text className="px-md" tone="muted" variant="caption">
            Its activities already use this name. Save it to recolour it or rename it later.
          </Text>
        ) : null}
      </View>

      <Section title="Colour">
        <View accessibilityRole="radiogroup" className="flex-row flex-wrap justify-between px-sm py-xs">
          {COLOR_KEYS.map((key) => (
            <ColorSwatch color={key} key={key} onPress={() => setColor(key)} selected={color === key} />
          ))}
        </View>
      </Section>

      {category ? (
        deleting ? (
          <Section destructive title="Delete this category">
            <View className="gap-md p-md">
              {own.length > 0 ? (
                <>
                  <Text tone="muted" variant="callout">
                    {own.length === 1 ? "1 activity belongs" : `${own.length} activities belong`} to “{category.name}”. What should
                    happen to {own.length === 1 ? "it" : "them"}?
                  </Text>
                  {targets.length > 0 ? (
                    <SegmentedControl
                      label="What happens to its activities"
                      onChange={setMode}
                      options={[
                        { label: "Move them", value: "move" },
                        { label: "Delete them too", value: "delete" },
                      ]}
                      value={deleteMode}
                    />
                  ) : null}
                  {deleteMode === "move" ? (
                    <View className="flex-row items-center justify-between gap-md">
                      <Text variant="callout">Move them to</Text>
                      <Picker bare label="Move them to" onChange={setMoveTo} options={targets} value={moveTo} />
                    </View>
                  ) : null}
                </>
              ) : (
                <Text tone="muted" variant="callout">
                  It has no activities, so nothing else changes.
                </Text>
              )}
              <View className="flex-row gap-sm">
                <Button className="flex-1" disabled={busy} label="Keep it" onPress={() => setDeleting(false)} variant="secondary" />
                <Button
                  className="flex-1"
                  disabled={deleteMode === "move" && own.length > 0 && !moveTo}
                  label="Delete"
                  loading={busy}
                  onPress={askRemove}
                  variant="destructive"
                />
              </View>
            </View>
          </Section>
        ) : (
          <DeleteCard disabled={busy} label="Delete category…" onPress={() => setDeleting(true)} />
        )
      ) : null}
    </SheetScreen>
  );
}
