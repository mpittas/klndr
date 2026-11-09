import type { ActivityTemplate, ScheduledTask } from "@dayro/core";
import { draftFromTemplate, useCategoryColor, useTaskActions } from "@dayro/data";
import { useCallback, useState } from "react";

import { nextFreeStart } from "@/components/planner/planning";
import { useToast } from "@/toast";

/**
 * Planning with activities on the week and the month: the activity being dragged out of the sidebar (so the grid
 * can show where it would land), and `place`, which adds a block made from an activity to a day, at the time it
 * was dropped on or else after the day's last block (`nextFreeStart`).
 *
 * `tasks` are the period's blocks before the category filter, so a block never lands on top of a hidden one.
 */
export function useActivityPlanning(tasks: ScheduledTask[], today: string) {
  const colorOf = useCategoryColor();
  const { saveTask } = useTaskActions();
  const toast = useToast();
  const [dragging, setDragging] = useState<ActivityTemplate | null>(null);

  const place = useCallback(
    (template: ActivityTemplate, day: string, start?: number) => {
      setDragging(null);
      const dayTasks = tasks.filter((task) => task.day === day);
      const at = start ?? nextFreeStart(dayTasks, day, today, template.defaultDuration);
      saveTask({ id: null, payload: draftFromTemplate(day, template, at, colorOf(template)) }).then(
        () => undefined,
        () => toast.show(`Couldn't add ${template.name}. Try again.`),
      );
    },
    [tasks, today, colorOf, saveTask, toast],
  );

  return {
    dragging,
    startDrag: setDragging,
    endDrag: useCallback(() => setDragging(null), []),
    place,
  };
}
