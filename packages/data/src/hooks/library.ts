import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { libraryMutationOptions } from "../mutations/library";
import { useData } from "../provider";

/**
 * Changing the library: activities and categories. Saving, deleting and renaming throw the server's message
 * (the forms show it); dragging an activity to another category shows at once and reports through `notify`.
 */
export function useLibraryActions() {
  const { api, notify } = useData();
  const queryClient = useQueryClient();
  const options = useMemo(() => libraryMutationOptions({ api, queryClient, notify }), [api, queryClient, notify]);

  const saveTemplate = useMutation(options.saveTemplate);
  const deleteTemplate = useMutation(options.deleteTemplate);
  const moveTemplate = useMutation(options.moveTemplate);
  const createCategory = useMutation(options.createCategory);
  const updateCategory = useMutation(options.updateCategory);
  const deleteCategory = useMutation(options.deleteCategory);

  return {
    /** Create (`id: null`) or edit an activity. */
    saveTemplate: saveTemplate.mutateAsync,
    deleteTemplate: deleteTemplate.mutateAsync,
    /** Never throws: a failure is put back and reported. */
    moveTemplate: (template: Parameters<typeof moveTemplate.mutateAsync>[0]["template"], category: string) =>
      moveTemplate.mutateAsync({ template, category }).then(
        () => undefined,
        () => undefined,
      ),
    createCategory: createCategory.mutateAsync,
    /** Renaming also renames the category on its activities and blocks. */
    updateCategory: updateCategory.mutateAsync,
    deleteCategory: deleteCategory.mutateAsync,
    pending:
      saveTemplate.isPending ||
      deleteTemplate.isPending ||
      createCategory.isPending ||
      updateCategory.isPending ||
      deleteCategory.isPending,
  };
}
