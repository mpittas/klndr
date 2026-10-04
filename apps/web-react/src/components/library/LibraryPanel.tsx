import {
  formatDuration,
  nextCategoryColor,
  sortCategoriesByName,
  withImplicitCategories,
  type ActivityTemplate,
  type CategoryEntry,
} from "@klndr/core";
import { useCategories, useCategoryColor, useData, useLibraryActions } from "@klndr/data";
import { Clock, FolderPlus, Palette, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import { ActivityForm, type ActivityDraft } from "@/components/activity/ActivityForm";
import { ColorSwatches } from "@/components/category/ColorSwatches";
import type { LibraryFocus } from "@/lib/library";
import { paletteOf } from "@/lib/colors";

const GENERAL = "General";

/**
 * Every activity and category in one place, with a search, an activity form that opens in place and a
 * category that can be renamed, recolored or deleted (its activities moved elsewhere or deleted with it).
 *
 * `@klndr/data`'s library mutations write the server's answer into the cache, and relabel the activities
 * and blocks of a renamed category in the same step, so the parent's `templates` prop follows on its own.
 *
 * The dialog drops this panel when it closes, and starts a new one (a new `key`) for every request to open
 * it, so each starts with no half-filled forms and on whatever `focus` asks for.
 */
export function LibraryPanel({ focus, templates }: { focus: LibraryFocus; templates: ActivityTemplate[] }) {
  const categoriesQuery = useCategories();
  const { refetch: refetchCategories } = categoriesQuery;
  const colorOf = useCategoryColor();
  const { api } = useData();
  const { createCategory, updateCategory, deleteCategory, saveTemplate, deleteTemplate } = useLibraryActions();

  // By name; the query hands them over unsorted.
  const categories = useMemo(() => sortCategoriesByName(categoriesQuery.data ?? []), [categoriesQuery.data]);
  const loaded = !categoriesQuery.isLoading;
  // A 403 means the database rules don't know about categories yet (firestore.rules not deployed).
  const loadError = categoriesQuery.error
    ? categoriesQuery.error.message === "Not allowed"
      ? "the database rules don't allow categories yet. Deploy firestore.rules"
      : categoriesQuery.error.message
    : null;

  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entries = useMemo(() => withImplicitCategories(categories, templates), [categories, templates]);
  const keyOf = (entry: CategoryEntry) => entry.id ?? `unsaved:${entry.name}`;

  // With a search, only categories that still have a match; otherwise every category, empty ones too.
  const groups = useMemo(() => {
    const byCategory = new Map<string, ActivityTemplate[]>();
    for (const t of templates) {
      if (query && !t.name.toLowerCase().includes(query)) continue;
      byCategory.set(t.category, [...(byCategory.get(t.category) ?? []), t]);
    }
    return entries
      .map((entry) => ({
        entry,
        items: (byCategory.get(entry.name) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .filter((group) => !query || group.items.length > 0);
  }, [entries, templates, query]);

  const countLabel = (n: number) => (n === 0 ? "Empty" : n === 1 ? "1 activity" : `${n} activities`);
  const totalOf = (entry: CategoryEntry) => templates.filter((t) => t.category === entry.name).length;

  const defaultCategory = () => (categories.find((c) => c.name === GENERAL) ?? categories[0])?.name ?? GENERAL;

  // ----- activities: one form at a time, shown in place -----
  type ActivityFormState = { kind: "create"; category: string } | { kind: "edit"; id: string };
  const [activityForm, setActivityForm] = useState<ActivityFormState | null>(() =>
    focus?.kind === "edit"
      ? { kind: "edit", id: focus.id }
      : focus?.kind === "new-activity"
        ? { kind: "create", category: defaultCategory() }
        : null,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ----- a new category -----
  const [newCategoryOpen, setNewCategoryOpen] = useState(focus?.kind === "new-category");
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(() => (focus?.kind === "new-category" ? nextCategoryColor(categories) : "indigo"));
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const nameInput = useRef<HTMLInputElement | null>(null);
  const justAddedTimer = useRef<number | null>(null);

  // ----- existing categories: rename, recolor, delete -----
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string | null>>({});
  const [colorOpen, setColorOpen] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState("");
  // What happens to the activities of a category that is being deleted.
  const [deleteMode, setDeleteMode] = useState<"move" | "delete">("move");
  const [removing, setRemoving] = useState(false);

  const draftFor = (form: ActivityFormState): ActivityDraft => {
    if (form.kind === "create") {
      return { name: "", emoji: "📌", category: form.category, defaultDuration: 60, notes: "" };
    }
    const t = templates.find((item) => item.id === form.id);
    return {
      name: t?.name ?? "",
      emoji: t?.emoji ?? "📌",
      category: t?.category ?? GENERAL,
      defaultDuration: t?.defaultDuration ?? 60,
      notes: t?.notes ?? "",
    };
  };

  // A frame later, once the thing to scroll to has rendered.
  const scrollTo = (selector: string) => {
    requestAnimationFrame(() => {
      document.querySelector(selector)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  };

  const startCreate = (category: string = defaultCategory()) => {
    setError(null);
    setDeletingId(null);
    setNewCategoryOpen(false);
    setActivityForm({ kind: "create", category });
    scrollTo("[data-activity-form]");
  };

  const startEdit = (id: string) => {
    setError(null);
    setDeletingId(null);
    setNewCategoryOpen(false);
    setActivityForm({ kind: "edit", id });
    scrollTo("[data-activity-form]");
  };

  const closeForm = () => {
    setError(null);
    setActivityForm(null);
  };

  const submitActivity = async (draft: ActivityDraft) => {
    const form = activityForm;
    if (!form) return;
    const category = draft.category.trim() || GENERAL;
    const body = {
      name: draft.name.trim(),
      emoji: draft.emoji,
      color: colorOf({ category }),
      category,
      defaultDuration: draft.defaultDuration,
      notes: draft.notes.trim() || null,
    };
    setBusy(true);
    setError(null);
    try {
      await saveTemplate({ id: form.kind === "edit" ? form.id : null, draft: body });
      setActivityForm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteActivity = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await deleteTemplate({ id });
      setDeletingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setBusy(false);
    }
  };

  // ----- a new category -----
  const focusNewCategoryField = () => {
    requestAnimationFrame(() => {
      nameInput.current?.focus();
      nameInput.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  };

  const startNewCategory = () => {
    setActivityForm(null);
    setNewColor(nextCategoryColor(categories));
    setNewCategoryOpen(true);
    focusNewCategoryField();
  };

  const addCategory = async () => {
    const name = newName.trim();
    if (!name) {
      setAddError("Give your category a name.");
      nameInput.current?.focus();
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const created = await createCategory({ draft: { name, color: newColor } });
      setNewName("");
      setNewCategoryOpen(false);
      setJustAdded(created.id);
      if (justAddedTimer.current !== null) window.clearTimeout(justAddedTimer.current);
      justAddedTimer.current = window.setTimeout(() => setJustAdded(null), 1600);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Could not add category");
    } finally {
      setAdding(false);
    }
  };

  // ----- existing categories: rename, recolor, delete -----
  const setRowError = (key: string, message: string | null) =>
    setRowErrors((current) => ({ ...current, [key]: message }));

  const patchCategory = async (entry: CategoryEntry, patch: { name?: string; color?: string }) => {
    if (!entry.id) return;
    setRowError(keyOf(entry), null);
    try {
      // Renaming relabels this category's activities and blocks in the cache, in the same step (see
      // `@klndr/data`'s updateCategory).
      await updateCategory({ id: entry.id, patch });
    } catch (err) {
      setRowError(keyOf(entry), err instanceof Error ? err.message : "Could not save");
    }
  };

  const nameOf = (entry: CategoryEntry) => nameDrafts[keyOf(entry)] ?? entry.name;

  const clearDraft = (key: string) =>
    setNameDrafts((current) => {
      const { [key]: _discarded, ...rest } = current;
      return rest;
    });

  const commitName = async (entry: CategoryEntry) => {
    const key = keyOf(entry);
    const draft = nameDrafts[key];
    if (draft === undefined) return;
    const name = draft.trim();
    if (!name || name === entry.name) {
      clearDraft(key);
      return;
    }
    // Keep showing the typed name while it saves, so the field doesn't flip back to the old one.
    await patchCategory(entry, { name });
    clearDraft(key);
  };

  const revertName = (entry: CategoryEntry) => clearDraft(keyOf(entry));

  const saveUnsaved = async (entry: CategoryEntry) => {
    const key = keyOf(entry);
    setRowError(key, null);
    try {
      await createCategory({ draft: { name: entry.name, color: entry.color } });
    } catch (err) {
      setRowError(key, err instanceof Error ? err.message : "Could not save");
    }
  };

  const moveTargets = (entry: CategoryEntry) => entries.filter((e) => e.name !== entry.name);

  const askDeleteCategory = (entry: CategoryEntry) => {
    setColorOpen(null);
    if (deleting === keyOf(entry)) {
      setDeleting(null);
      return;
    }
    setDeleting(keyOf(entry));
    const targets = moveTargets(entry);
    setMoveTo((targets.find((t) => t.name === GENERAL) ?? targets[0])?.name ?? "");
    setDeleteMode(targets.length ? "move" : "delete");
  };

  const confirmDeleteCategory = async (entry: CategoryEntry) => {
    if (!entry.id) return;
    const key = keyOf(entry);
    const n = totalOf(entry);
    setRemoving(true);
    setRowError(key, null);
    try {
      if (n === 0) {
        // The list here can be out of date (it isn't shared across days), so ask the server before
        // treating the category as empty.
        const fresh = (await api.getTemplates()).filter((t) => t.category === entry.name).length;
        if (fresh > 0) {
          setRowError(key, "This category has activities now. Choose what should happen to them.");
          return;
        }
      }
      await deleteCategory({
        id: entry.id,
        target: n === 0 ? undefined : deleteMode === "delete" ? { deleteActivities: true } : { moveTo },
      });
      setDeleting(null);
    } catch (err) {
      setRowError(key, err instanceof Error ? err.message : "Could not delete");
    } finally {
      setRemoving(false);
    }
  };

  const toggleColors = (entry: CategoryEntry) => {
    setDeleting(null);
    setColorOpen((current) => (current === keyOf(entry) ? null : keyOf(entry)));
  };

  // ----- opening -----
  // The state above already starts on whatever was asked for; this brings it into view. The list of
  // categories can be out of date (it isn't shared across days), so every opening fetches it again.
  const reveal = useEffectEvent(() => {
    if (focus?.kind === "new-category") focusNewCategoryField();
    else if (activityForm) scrollTo("[data-activity-form]");
  });

  useEffect(() => {
    void refetchCategories();
    reveal();
  }, [refetchCategories]);

  useEffect(
    () => () => {
      if (justAddedTimer.current !== null) window.clearTimeout(justAddedTimer.current);
    },
    [],
  );

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-auto sm:min-w-40 sm:flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            value={search}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder="Search activities"
            aria-label="Search activities"
            className="h-11 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:h-9"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <button
          type="button"
          className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3.5 text-sm font-medium text-foreground shadow-xs transition hover:bg-accent sm:h-9 sm:flex-none"
          onClick={() => startNewCategory()}
        >
          <FolderPlus className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Category
        </button>
        <button
          type="button"
          className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90 sm:h-9 sm:flex-none"
          onClick={() => startCreate()}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Activity
        </button>
      </div>

      {/* New category */}
      {newCategoryOpen ? (
        <form
          className="rounded-xl border border-border bg-muted/40 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void addCategory();
          }}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            event.preventDefault();
            setNewCategoryOpen(false);
          }}
        >
          <label htmlFor="new-category-name" className="text-xs font-medium text-foreground">
            New category
          </label>
          <div className="mt-2 flex items-stretch gap-2">
            <input
              id="new-category-name"
              ref={nameInput}
              value={newName}
              type="text"
              maxLength={40}
              autoComplete="off"
              placeholder="e.g. Fitness, Side project…"
              className="h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:h-9"
              onChange={(event) => {
                setAddError(null);
                setNewName(event.target.value);
              }}
            />
            <button
              type="button"
              className="h-11 shrink-0 cursor-pointer rounded-md px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground sm:h-9"
              onClick={() => setNewCategoryOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={adding || !newName.trim()}
              className="h-11 shrink-0 cursor-pointer rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 sm:h-9"
            >
              Add
            </button>
          </div>
          <div className="mt-3">
            <ColorSwatches value={newColor} onChange={setNewColor} />
          </div>
          {addError ? (
            <p className="mt-2 text-xs font-medium text-destructive" role="alert">
              {addError}
            </p>
          ) : null}
        </form>
      ) : null}

      {/* New activity */}
      {activityForm?.kind === "create" ? (
        <div data-activity-form className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <h3 className="mb-4 text-sm font-semibold tracking-tight text-foreground">New activity</h3>
          <ActivityForm
            key={`new-${activityForm.category}`}
            initial={draftFor(activityForm)}
            templates={templates}
            submitLabel="Add activity"
            busy={busy}
            error={error}
            onSubmit={(draft) => void submitActivity(draft)}
            onCancel={closeForm}
          />
        </div>
      ) : error ? (
        <p
          className="rounded-md border border-destructive/20 bg-destructive/10 p-2.5 text-xs font-medium text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {loadError ? (
        <p
          className="rounded-lg border border-rose-200/80 bg-rose-50/80 p-3 text-xs font-medium text-rose-800 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-200"
          role="alert"
        >
          Couldn't load your saved categories: {loadError}. Showing the ones your activities use.
        </p>
      ) : null}

      {!loaded && !entries.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
          <p className="text-sm font-medium text-foreground">
            {templates.length === 0 && !query ? "Nothing here yet" : `No matches for “${search.trim()}”`}
          </p>
          {templates.length === 0 && !query ? (
            <button
              type="button"
              className="mt-3 inline-flex h-11 cursor-pointer items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90 sm:h-9"
              onClick={() => startCreate()}
            >
              Create your first activity
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Categories, each a card with its activities */}
      <div className="space-y-4">
        {groups.map(({ entry, items }) => (
          <section
            key={keyOf(entry)}
            className={[
              "relative overflow-hidden rounded-xl border border-border bg-card shadow-2xs transition-shadow duration-500",
              justAdded !== null && justAdded === entry.id ? "ring-2 ring-ring/40" : "",
            ].join(" ")}
          >
            <span
              className={["absolute inset-y-0 left-0 w-1", paletteOf(entry.color).accent].join(" ")}
              aria-hidden="true"
            />

            {/* Category header: color, name, count, actions */}
            <div className="flex items-center gap-1.5 border-b border-border bg-muted/40 py-2 pl-3.5 pr-2">
              <span
                className={["h-2 w-2 shrink-0 rounded-full", paletteOf(entry.color).dot].join(" ")}
                aria-hidden="true"
              />

              {entry.id ? (
                <input
                  value={nameOf(entry)}
                  type="text"
                  maxLength={40}
                  aria-label={`Rename ${entry.name}`}
                  title="Click to rename"
                  className="h-8 min-w-0 flex-1 truncate rounded-md border border-transparent bg-transparent px-1.5 text-sm font-semibold tracking-tight text-foreground transition hover:bg-background/70 focus:border-input focus:bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  onChange={(event) =>
                    setNameDrafts((current) => ({ ...current, [keyOf(entry)]: event.target.value }))
                  }
                  onBlur={() => void commitName(entry)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.currentTarget.blur();
                    } else if (event.key === "Escape") {
                      event.stopPropagation();
                      event.preventDefault();
                      revertName(entry);
                      event.currentTarget.blur();
                    }
                  }}
                />
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-2 px-1.5">
                  <span className="truncate text-sm font-semibold tracking-tight text-foreground">{entry.name}</span>
                  <span className="shrink-0 rounded-full border border-dashed border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Not saved
                  </span>
                </div>
              )}

              <span className="hidden shrink-0 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground sm:inline">
                {countLabel(totalOf(entry))}
              </span>
              <span className="shrink-0 rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums text-muted-foreground sm:hidden">
                {totalOf(entry)}
              </span>

              {entry.id ? (
                <>
                  <button
                    type="button"
                    aria-label={`Change color of ${entry.name}`}
                    aria-expanded={colorOpen === keyOf(entry)}
                    title="Change color"
                    className={[
                      "flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring touch:h-9 touch:w-9",
                      colorOpen === keyOf(entry) ? "bg-background text-foreground shadow-xs" : "",
                    ].join(" ")}
                    onClick={() => toggleColors(entry)}
                  >
                    <Palette className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete category ${entry.name}`}
                    title="Delete category"
                    className={[
                      "flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring touch:h-9 touch:w-9",
                      deleting === keyOf(entry) ? "bg-destructive/10 text-destructive" : "",
                    ].join(" ")}
                    onClick={() => askDeleteCategory(entry)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="h-8 shrink-0 cursor-pointer rounded-md border border-input bg-background px-2.5 text-xs font-medium text-foreground shadow-xs transition hover:bg-accent"
                  onClick={() => void saveUnsaved(entry)}
                >
                  Save
                </button>
              )}
            </div>

            {colorOpen === keyOf(entry) ? (
              <div className="border-b border-border bg-muted/20 py-3 pl-4 pr-3">
                <ColorSwatches value={entry.color} onChange={(color) => void patchCategory(entry, { color })} />
              </div>
            ) : null}

            {deleting === keyOf(entry) ? (
              <div className="space-y-3 border-b border-destructive/15 bg-destructive/5 py-3 pl-4 pr-3">
                {totalOf(entry) > 0 ? (
                  <fieldset className="space-y-2.5">
                    <legend className="mb-2 text-xs text-foreground">
                      What should happen to its{" "}
                      <span className="font-semibold">{countLabel(totalOf(entry)).toLowerCase()}</span>?
                    </legend>
                    <label
                      className={[
                        "flex items-start gap-2.5",
                        moveTargets(entry).length ? "cursor-pointer" : "cursor-not-allowed opacity-60",
                      ].join(" ")}
                    >
                      <input
                        type="radio"
                        name={`delete-mode-${keyOf(entry)}`}
                        checked={deleteMode === "move"}
                        disabled={!moveTargets(entry).length}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                        onChange={() => setDeleteMode("move")}
                      />
                      <span className="min-w-0 flex-1 space-y-2">
                        <span className="block text-sm text-foreground">Move them to another category</span>
                        {moveTargets(entry).length ? (
                          <select
                            value={moveTo}
                            disabled={deleteMode !== "move"}
                            aria-label="Move activities to"
                            className="h-11 w-full cursor-pointer rounded-md border border-input bg-background px-2.5 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:h-9"
                            onChange={(event) => setMoveTo(event.target.value)}
                            onFocus={() => setDeleteMode("move")}
                          >
                            {moveTargets(entry).map((target) => (
                              <option key={target.name} value={target.name}>
                                {target.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="block text-xs text-muted-foreground">
                            Add another category first to move them.
                          </span>
                        )}
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2.5">
                      <input
                        type="radio"
                        name={`delete-mode-${keyOf(entry)}`}
                        checked={deleteMode === "delete"}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-destructive"
                        onChange={() => setDeleteMode("delete")}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-foreground">Delete them too</span>
                        <span className="block text-xs text-muted-foreground">
                          Blocks already on your calendar stay.
                        </span>
                      </span>
                    </label>
                  </fieldset>
                ) : (
                  <p className="text-xs text-foreground">This category is empty. Delete it?</p>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="h-11 flex-1 cursor-pointer rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-xs transition hover:bg-accent sm:h-8 sm:flex-none sm:text-xs"
                    onClick={() => setDeleting(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={removing || (totalOf(entry) > 0 && deleteMode === "move" && !moveTo)}
                    className="h-11 flex-1 cursor-pointer rounded-md bg-destructive px-3 text-sm font-medium text-destructive-foreground shadow-xs transition hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50 sm:h-8 sm:flex-none sm:text-xs"
                    onClick={() => void confirmDeleteCategory(entry)}
                  >
                    {removing
                      ? "Deleting…"
                      : totalOf(entry) > 0 && deleteMode === "delete"
                        ? "Delete all"
                        : "Delete category"}
                  </button>
                </div>
              </div>
            ) : null}

            {rowErrors[keyOf(entry)] ? (
              <p className="border-b border-border py-2 pl-4 pr-3 text-xs font-medium text-destructive" role="alert">
                {rowErrors[keyOf(entry)]}
              </p>
            ) : null}

            {/* Activities */}
            <ul className="divide-y divide-border/70 py-1 pl-1">
              {items.map((template) => (
                <li key={template.id} id={`library-activity-${template.id}`}>
                  {/* Editing, in place */}
                  {activityForm?.kind === "edit" && activityForm.id === template.id ? (
                    <div
                      data-activity-form
                      className="m-2 rounded-lg border border-border bg-background p-4 shadow-xs sm:p-3"
                    >
                      <h3 className="mb-3 text-sm font-semibold tracking-tight text-foreground">Edit activity</h3>
                      <ActivityForm
                        key={template.id}
                        initial={draftFor(activityForm)}
                        templates={templates}
                        submitLabel="Save changes"
                        busy={busy}
                        error={error}
                        onSubmit={(draft) => void submitActivity(draft)}
                        onCancel={closeForm}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2.5 py-2 pl-2.5 pr-1.5 transition-colors hover:bg-muted/50 sm:gap-3 sm:pr-2">
                        <span
                          className={[
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm leading-none sm:h-7 sm:w-7 sm:text-base",
                            paletteOf(entry.color).icon,
                          ].join(" ")}
                          aria-hidden="true"
                        >
                          {template.emoji}
                        </span>
                        <button
                          type="button"
                          className="min-w-0 flex-1 cursor-pointer text-left focus-visible:outline-none"
                          aria-label={`Edit ${template.name}`}
                          onClick={() => startEdit(template.id)}
                        >
                          <span className="block truncate text-sm font-medium text-foreground">{template.name}</span>
                          {/* On phones the duration moves under the name, so the name keeps its room. */}
                          <span
                            className={[
                              "block truncate text-xs text-muted-foreground",
                              template.notes ? "" : "sm:hidden",
                            ].join(" ")}
                          >
                            <span className="font-mono tabular-nums sm:hidden">
                              {formatDuration(template.defaultDuration)}
                              {template.notes ? " · " : null}
                            </span>
                            {template.notes}
                          </span>
                        </button>
                        <span className="hidden shrink-0 items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-muted-foreground sm:inline-flex">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {formatDuration(template.defaultDuration)}
                        </span>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            aria-label={`Edit ${template.name}`}
                            title="Edit"
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition hover:bg-background hover:text-foreground hover:shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring touch:h-9 touch:w-9"
                            onClick={() => startEdit(template.id)}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${template.name}`}
                            title="Delete"
                            className={[
                              "flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring touch:h-9 touch:w-9",
                              deletingId === template.id ? "bg-destructive/10 text-destructive" : "",
                            ].join(" ")}
                            onClick={() =>
                              setDeletingId((current) => (current === template.id ? null : template.id))
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      {deletingId === template.id ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 bg-destructive/5 py-2.5 pl-3 pr-2">
                          <p className="text-xs text-foreground">
                            Delete “{template.name}”? Blocks already on your calendar stay.
                          </p>
                          <div className="flex w-full gap-2 sm:w-auto">
                            <button
                              type="button"
                              className="h-11 flex-1 cursor-pointer rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-xs transition hover:bg-accent sm:h-8 sm:flex-none sm:text-xs"
                              onClick={() => setDeletingId(null)}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              className="h-11 flex-1 cursor-pointer rounded-md bg-destructive px-3 text-sm font-medium text-destructive-foreground shadow-xs transition hover:bg-destructive/90 disabled:opacity-50 sm:h-8 sm:flex-none sm:text-xs"
                              onClick={() => void confirmDeleteActivity(template.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </li>
              ))}

              {!query ? (
                <li>
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center gap-2.5 py-2 pl-2.5 pr-2 text-sm text-muted-foreground transition hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring sm:gap-3"
                    onClick={() => startCreate(entry.name)}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-dashed border-border sm:h-9 sm:w-9">
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </span>
                    Add activity{items.length === 0 ? ` to ${entry.name}` : ""}
                  </button>
                </li>
              ) : null}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
