import {
  colorOfCategory,
  clampStart,
  isValidISODate,
  nextCategoryColor,
  nowMinutes,
  snapMinutes,
  todayISO,
  withImplicitCategories,
} from "@klndr/core";
import { useCategories, useDayTimeline, useLibraryActions, useTemplates } from "@klndr/data";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";

import { useAuth } from "@/auth";
import { TaskForm } from "@/components/editor/task-form";
import { Button, EmptyState, Skeleton, useToast } from "@/components/ui";

/** What a block made with no other say starts as: half an hour, until the profile's default length is read. */
const DEFAULT_DURATION = 30;

/**
 * The editor sheet: one route for both making a block (`?day=…&start=…`) and changing one (`?day=…&taskId=…`).
 * It goes through the same `useDayTimeline` as the Day tab, and so shares its undo history: saving or deleting
 * here is undone from the Day tab's header.
 */
export default function TaskEditor() {
  const router = useRouter();
  const toast = useToast();
  const { state } = useAuth();
  const params = useLocalSearchParams<{ day?: string; taskId?: string; start?: string }>();
  const day = isValidISODate(params.day) ? params.day : todayISO();
  const timeline = useDayTimeline(day);
  const templates = useTemplates().data ?? [];
  const categories = useCategories().data ?? [];
  const library = useLibraryActions();

  const close = () => router.back();
  const task = params.taskId ? timeline.tasks.find((item) => item.id === params.taskId) : undefined;

  if (params.taskId && !task) {
    if (timeline.query.isError) return (
      <View className="flex-1 justify-center bg-background">
        <EmptyState
          title="Could not load this block"
          description="Check your connection and try again."
          action={<Button label="Try again" onPress={() => void timeline.query.refetch()} variant="secondary" />}
        />
      </View>
    );
    // Still loading, or deleted somewhere else in the meantime.
    return timeline.query.isPending ? (
      <View className="flex-1 gap-sm bg-background p-md pt-lg">
        <Skeleton height={28} width="50%" />
        <Skeleton height={44} />
        <Skeleton height={44} />
      </View>
    ) : (
      <View className="flex-1 justify-center bg-background">
        <EmptyState
          action={<Button label="Close" onPress={close} variant="secondary" />}
          description="It may have been deleted on another device."
          title="This block is gone"
        />
      </View>
    );
  }

  const start = Number.parseInt(params.start ?? "", 10);

  return (
    <TaskForm
      categories={categories}
      day={day}
      defaultDuration={state.status === "signed-in" ? state.profile?.defaultTaskDuration ?? DEFAULT_DURATION : DEFAULT_DURATION}
      key={task?.id ?? "new"}
      onClose={close}
      onDelete={
        task
          ? () => {
              close();
              void timeline.deleteTask(task).then((deleted) => {
                if (deleted) {
                  toast.show({ message: `Deleted ${task.title}`, actionLabel: "Undo", onAction: () => void timeline.undo() });
                }
              });
            }
          : undefined
      }
      onSave={async (draft, newCategory) => {
        // A category typed here is made first, with the next free colour, so the block can be painted with it.
        let color = colorOfCategory(categories, { category: draft.category });
        const known = withImplicitCategories(categories, templates).some(
          (entry) => entry.name.toLowerCase() === draft.category.toLowerCase(),
        );
        if (newCategory && !known) {
          color = (await library.createCategory({ draft: { name: newCategory, color: nextCategoryColor(categories) } })).color;
        }
        await timeline.saveTask({ id: task?.id ?? null, payload: { ...draft, color } });
        close();
      }}
      startMinutes={clampStart(Number.isFinite(start) ? start : snapMinutes(nowMinutes(), 30))}
      task={task}
      templates={templates}
    />
  );
}
