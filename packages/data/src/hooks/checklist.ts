import type { ChecklistItem } from "@klndr/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { buildDayChecklist, emptyDayChecklist } from "../derive";
import { checklistMutationOptions } from "../mutations/checklist";
import { useData } from "../provider";
import { useChecklistItems, useDayChecklist } from "./queries";

/**
 * One day's checklist: the routines for that day with what was ticked, and what can be done to them.
 * Ticking shows at once and is put back if it fails; the rest throws the server's message.
 */
export function useChecklist(day: string) {
  const { api, notify } = useData();
  const queryClient = useQueryClient();
  const itemsQuery = useChecklistItems();
  const dayQuery = useDayChecklist(day);

  const view = useMemo(
    () => buildDayChecklist(itemsQuery.data ?? [], dayQuery.data ?? emptyDayChecklist(day)),
    [itemsQuery.data, dayQuery.data, day],
  );

  const options = useMemo(() => checklistMutationOptions({ api, queryClient, notify }), [api, queryClient, notify]);
  const { mutate: toggleItem } = useMutation(options.toggle);
  const { mutateAsync: create } = useMutation(options.create);
  const { mutateAsync: update } = useMutation(options.update);
  const { mutateAsync: remove } = useMutation(options.remove);
  const { mutateAsync: hide } = useMutation(options.hide);
  const { mutateAsync: addExtra } = useMutation(options.addExtra);
  const { mutateAsync: removeExtra } = useMutation(options.removeExtra);

  const routineCount = itemsQuery.data?.length ?? 0;

  return {
    ...view,
    isLoading: itemsQuery.isLoading || dayQuery.isLoading,
    isError: itemsQuery.isError || dayQuery.isError,
    refetch: useCallback(() => Promise.all([itemsQuery.refetch(), dayQuery.refetch()]), [itemsQuery, dayQuery]),

    /** Tick or untick; never throws, a failure is put back and reported. */
    toggle: useCallback((itemId: string, completed: boolean) => toggleItem({ day, itemId, completed }), [toggleItem, day]),
    /** A routine for every day, placed after the existing ones. */
    addRoutine: useCallback(
      (draft: { title: string; emoji: string }) => create({ ...draft, order: routineCount + 1 }),
      [create, routineCount],
    ),
    /** A one-off that exists only on this day. */
    addForToday: useCallback((draft: { title: string; emoji: string }) => addExtra({ day, ...draft }), [addExtra, day]),
    editRoutine: useCallback(
      (id: string, patch: { title?: string; emoji?: string }) => update({ id, patch }),
      [update],
    ),
    deleteRoutine: useCallback((item: Pick<ChecklistItem, "id">) => remove({ id: item.id }), [remove]),
    /** Skip a routine on this day, or bring it back. */
    skipForDay: useCallback(
      (item: Pick<ChecklistItem, "id" | "title">, hidden: boolean) => hide({ day, item, hidden }),
      [hide, day],
    ),
    removeOneOff: useCallback((item: { id: string; title: string }) => removeExtra({ day, item }), [removeExtra, day]),
  };
}
