import type { ActivityTemplate, ScheduledTask } from "@klndr/core";
import { draftFromTemplate, useCategoryColor, useTaskActions } from "@klndr/data";
import { useCallback, useState } from "react";

import { nextFreeStart } from "@/components/planner/planning";

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
  const [dragging, setDragging] = useState<ActivityTemplate | null>(null);

  const place = useCallback(
    (template: ActivityTemplate, day: string, start?: number) => {
      setDragging(null);
      const dayTasks = tasks.filter((task) => task.day === day);
      const at = start ?? nextFreeStart(dayTasks, day, today, template.defaultDuration);
      // Shown at once; a failure is taken back off and reported by the data layer.
      saveTask({ id: null, payload: draftFromTemplate(day, template, at, colorOf(template)) }).catch(() => undefined);
    },
    [tasks, today, colorOf, saveTask],
  );

  return {
    dragging,
    startDrag: setDragging,
    endDrag: useCallback(() => setDragging(null), []),
    place,
  };
}
