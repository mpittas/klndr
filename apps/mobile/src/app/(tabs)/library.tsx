import { sortCategoriesByName, withImplicitCategories, type ActivityTemplate, type CategoryEntry } from "@klndr/core";
import { useCategories, useTemplates } from "@klndr/data";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CategoryCard } from "@/components/library/category-card";
import { Button, CircleButton, EmptyState, SearchField, Skeleton, Text } from "@/components/ui";
import { FolderPlus, Plus, Search } from "@/icons";
import { useTabBarInset } from "@/lib/insets";
import { useThemeColors } from "@/theme/tokens";

const GENERAL = "General";
const NONE: never[] = [];

type Group = { entry: CategoryEntry; items: ActivityTemplate[]; total: number };

/**
 * The library: every category and the activities in it, with a search, as the web's library panel shows them.
 * Activities and categories are made and changed in sheets (`activity-sheet`, `category-sheet`); what they do to
 * the timeline's blocks (a rename relabels them, a recolour repaints them) is `@klndr/data`'s doing.
 */
export default function LibraryTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarInset = useTabBarInset();
  const colors = useThemeColors();
  const templatesQuery = useTemplates();
  const categoriesQuery = useCategories();
  const templates = templatesQuery.data ?? NONE;
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const query = search.trim().toLowerCase();

  const categories = useMemo(() => sortCategoriesByName(categoriesQuery.data ?? []), [categoriesQuery.data]);
  const loading = (templatesQuery.isPending || categoriesQuery.isPending) && !templatesQuery.data && !categoriesQuery.data;
  const failed = (templatesQuery.isError || categoriesQuery.isError) && !templatesQuery.data && !categoriesQuery.data;

  // With a search, only categories that still have a match; otherwise every category, empty ones too.
  const groups = useMemo<Group[]>(() => {
    const byCategory = new Map<string, ActivityTemplate[]>();
    for (const template of templates) byCategory.set(template.category, [...(byCategory.get(template.category) ?? []), template]);
    return withImplicitCategories(categories, templates)
      .map((entry) => {
        const all = byCategory.get(entry.name) ?? [];
        const shown = query ? all.filter((template) => template.name.toLowerCase().includes(query)) : all;
        return { entry, items: [...shown].sort((a, b) => a.name.localeCompare(b.name)), total: all.length };
      })
      .filter((group) => !query || group.items.length > 0);
  }, [categories, templates, query]);

  const defaultCategory = (categories.find((category) => category.name === GENERAL) ?? categories[0])?.name ?? GENERAL;

  const addActivity = useCallback(
    (category: string) => router.push({ pathname: "/activity-sheet", params: { category } }),
    [router],
  );
  const openActivity = useCallback(
    (template: ActivityTemplate) => router.push({ pathname: "/activity-sheet", params: { id: template.id } }),
    [router],
  );
  const openCategory = useCallback(
    (entry: CategoryEntry) =>
      router.push({ pathname: "/category-sheet", params: entry.id ? { id: entry.id } : { name: entry.name } }),
    [router],
  );

  const refresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([templatesQuery.refetch(), categoriesQuery.refetch()]);
    setRefreshing(false);
  };

  const header = (
    <View className="gap-md pb-xs">
      <View className="flex-row items-center gap-sm">
        <Text accessibilityRole="header" className="flex-1" variant="largeTitle">
          Library
        </Text>
        <CircleButton label="New category" onPress={() => router.push("/category-sheet")} size={36}>
          <FolderPlus color={colors.foreground} size={18} strokeWidth={2.2} />
        </CircleButton>
        <CircleButton label="New activity" onPress={() => addActivity(defaultCategory)} size={36} variant="primary">
          <Plus color={colors["primary-foreground"]} size={20} strokeWidth={2.6} />
        </CircleButton>
      </View>
      <SearchField label="Search activities" onChangeText={setSearch} placeholder="Search activities" value={search} />
    </View>
  );

  return (
    <FlatList
      className="bg-canvas"
      contentContainerClassName="gap-lg px-md"
      contentContainerStyle={{ paddingBottom: tabBarInset + 24, paddingTop: insets.top + 4 }}
      data={loading || failed ? NONE : groups}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      keyExtractor={(group) => group.entry.id ?? `unsaved:${group.entry.name}`}
      ListEmptyComponent={
        loading ? (
          <View className="gap-md">
            <Skeleton height={140} />
            <Skeleton height={140} />
          </View>
        ) : failed ? (
          <EmptyState
            action={<Button label="Try again" onPress={() => void refresh()} variant="secondary" />}
            description="Check your connection and try again."
            title="Could not load your library"
          />
        ) : query ? (
          <EmptyState
            description={`Nothing matches “${search.trim()}”.`}
            icon={<Search color={colors["muted-foreground"]} size={22} />}
            title="No activities found"
          />
        ) : (
          <EmptyState
            action={<Button label="Add an activity" onPress={() => addActivity(defaultCategory)} />}
            description="Activities are the things you plan again and again. Group them into categories."
            icon={<Plus color={colors["muted-foreground"]} size={22} />}
            title="Your library is empty"
          />
        )
      }
      ListHeaderComponent={header}
      refreshControl={<RefreshControl onRefresh={() => void refresh()} refreshing={refreshing} />}
      renderItem={({ item }) => (
        <CategoryCard
          entry={item.entry}
          items={item.items}
          onAddActivity={() => addActivity(item.entry.name)}
          onOpenActivity={openActivity}
          onOpenCategory={() => openCategory(item.entry)}
          searching={query.length > 0}
          total={item.total}
        />
      )}
      scrollIndicatorInsets={{ bottom: tabBarInset }}
    />
  );
}
