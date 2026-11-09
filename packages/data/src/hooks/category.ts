import {
  categoryOptions,
  colorOfCategory,
  guessCategoryFromHistory,
  isCatchAllCategory,
  normalizeEmojiTitle,
  rankCategories,
  UNSORTED_CATEGORY,
  withImplicitCategories,
  type ActivityTemplate,
  type Category,
  type CategoryOption,
  type FiledItem,
  type ScheduledTask,
} from "@klndr/core";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useEffectEvent, useMemo, useReducer, useRef, useState } from "react";
import { findTask, patchTask } from "../cache";
import { queryKeys } from "../keys";
import type { MutationDeps } from "../mutations/types";
import { useData } from "../provider";
import { useCategories, useTemplates } from "./queries";

/** Past this the caller stops waiting and leaves the block unsorted. */
export const CATEGORY_TIMEOUT_MS = 5000;
/** How long typing has to stop before the title is taken as meant: the same pause the emoji waits for. */
export const CATEGORY_TYPING_PAUSE_MS = 600;
const CACHE_LIMIT = 200;

const NO_CATEGORIES: Category[] = [];
const NO_TEMPLATES: ActivityTemplate[] = [];

// The categories are part of the key: a new category can be the better answer for a title asked about before.
const cacheKey = (title: string, options: readonly CategoryOption[]) =>
  `${normalizeEmojiTitle(title)}\u0000${options.map((option) => option.name.toLowerCase()).join("\u0001")}`;

const onOffer = (name: string | null | undefined, options: readonly CategoryOption[]) =>
  (name && options.find((option) => option.name.toLowerCase() === name.toLowerCase())?.name) || null;

/**
 * Asking the server which of the person's categories a title belongs in. It answers `null` when none fits and
 * for anything that goes wrong (no model set up, an error, too slow), so a caller only has to decide what to use
 * instead.
 *
 * Remembers the server's answers for the session, "none" included, so the same title is asked about once.
 * A failure or a timeout is not remembered: a later try may do better.
 */
export function useCategorySuggester(): (text: string, options: CategoryOption[]) => Promise<string | null> {
  const { api, categoryCache } = useData();

  return useCallback(
    async (text, options) => {
      const title = text.trim();
      if (!title || !options.length) return null;

      const key = cacheKey(title, options);
      if (categoryCache.has(key)) return categoryCache.get(key) ?? null;

      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const answer = await Promise.race([
          api.suggestCategory(title, options),
          new Promise<undefined>((resolve) => {
            timer = setTimeout(() => resolve(undefined), CATEGORY_TIMEOUT_MS);
          }),
        ]);
        if (answer === undefined) return null;
        const category = onOffer(answer, options);
        categoryCache.set(key, category);
        // Oldest first: a Map remembers the order things were added in.
        if (categoryCache.size > CACHE_LIMIT) categoryCache.delete(categoryCache.keys().next().value as string);
        return category;
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    },
    [api, categoryCache],
  );
}

/** Every block in the cache once, oldest first, as what it was filed under. */
function filedBlocks(qc: QueryClient): FiledItem[] {
  const byId = new Map<string, ScheduledTask>();
  for (const [, list] of qc.getQueriesData<ScheduledTask[]>({ queryKey: queryKeys.tasks.all })) {
    for (const task of list ?? []) byId.set(task.id, task);
  }
  return [...byId.values()]
    .sort((a, b) => a.day.localeCompare(b.day) || a.startMinutes - b.startMinutes)
    .map((task) => ({ title: task.title, category: task.category }));
}

/**
 * Files a block that was saved before its category was known under the one picked for it, once it is. `saved`
 * is the category it was saved with, and `later` the pick still on its way.
 *
 * Nothing changes when the pick brings nothing, or when the block has been moved to another category in the
 * meantime: the person's choice wins. Quiet like `fillEmoji`: no message and no step to undo. Never throws.
 */
export async function fillCategory(
  d: Pick<MutationDeps, "api" | "queryClient">,
  taskId: string,
  saved: string,
  later: Promise<string | null>,
): Promise<void> {
  let category: string | null;
  try {
    category = await later;
  } catch {
    return;
  }
  if (!category || category.toLowerCase() === saved.toLowerCase()) return;

  const qc = d.queryClient;
  const before = findTask(qc, taskId);
  if (before && before.category.toLowerCase() !== saved.toLowerCase()) return;

  // An older answer arriving after this change would put the saved category back on screen.
  await qc.cancelQueries({ queryKey: queryKeys.tasks.all });
  const categories = qc.getQueryData<Category[]>(queryKeys.categories) ?? NO_CATEGORIES;
  const color = colorOfCategory(categories, { category, color: before?.color });
  patchTask(qc, taskId, { category, color });
  try {
    await d.api.updateTask(taskId, { category, color });
  } catch {
    if (findTask(qc, taskId)?.category === category) patchTask(qc, taskId, { category: saved, color: before?.color ?? "slate" });
  }
}

/** `fillCategory` for the person signed in. It keeps working after the form that called it has closed. */
export function useCategoryFill(): (taskId: string, saved: string, later: Promise<string | null>) => Promise<void> {
  const { api } = useData();
  const queryClient = useQueryClient();
  return useCallback((taskId, saved, later) => fillCategory({ api, queryClient }, taskId, saved, later), [api, queryClient]);
}

// ---- The category field of a block's form ----

type FieldState = {
  /** The category in the field; `null` while there is none yet. */
  value: string | null;
  /** Chosen on purpose (by hand, or an activity's own): it stays whatever the title becomes. */
  byHand: boolean;
  /** The app put `value` there for the title. */
  guessed: boolean;
  /** The title `value` stands for, normalized; a guess for any other title is due. */
  settledFor: string;
  /** The title as the field last saw it. */
  title: string;
  /** A guess on its way, for a normalized title. */
  asking: { id: number; title: string } | null;
};

type FieldAction =
  | { type: "title"; title: string; known: string | null }
  | { type: "choose"; name: string }
  | { type: "asked"; id: number; title: string }
  | { type: "answered"; id: number; answer: string | null };

function fieldReducer(state: FieldState, action: FieldAction): FieldState {
  switch (action.type) {
    case "title": {
      const title = normalizeEmojiTitle(action.title);
      // A guess still on its way for another title is no longer wanted (its answer is still remembered).
      const asking = state.asking && state.asking.title === title ? state.asking : null;
      const next = { ...state, title: action.title, asking };
      if (state.byHand || !title || title === state.settledFor || !action.known) return next;
      return { ...next, value: action.known, guessed: true, settledFor: title, asking: null };
    }
    case "choose":
      return { ...state, value: action.name, byHand: true, guessed: false, asking: null };
    case "asked":
      return { ...state, asking: { id: action.id, title: action.title } };
    case "answered": {
      if (state.byHand || state.asking?.id !== action.id) return state;
      // No fit: a guess made for an earlier title goes, but a category the block already had stays.
      const value = action.answer ?? (state.guessed ? null : state.value);
      return { ...state, value, guessed: action.answer !== null, settledFor: state.asking.title, asking: null };
    }
  }
}

export type CategoryFieldOptions = {
  /** The category saved so far: the block's, or the activity's it starts from; `null` for a new block. */
  initial: string | null;
  /** The title that category belongs to; empty for a new block. */
  initialTitle: string;
  /** `initial` was chosen on purpose (an activity's category, say), so it is never guessed over. */
  initialByHand: boolean;
  /** What the title field says now. */
  title: string;
};

/**
 * The category of a block's form, picked for its title while the form is filled in, so the person rarely has to
 * think about it, and saving never waits for it:
 *
 *  1. As the title is typed, a title they have filed before goes where it went then (an activity of that name,
 *     or most of their blocks with it), and one already asked about this session goes where the model said.
 *  2. Otherwise, once typing pauses (or the field is left: `settle`), the model picks among their categories.
 *  3. When nothing fits, the field stays empty and the block is saved as `UNSORTED_CATEGORY`, in grey.
 *
 * A category chosen by hand (`choose`), or an activity's, is never replaced. A block that already has a real
 * category keeps it; one in a catch-all ("General") is guessed for once its title changes.
 *
 * `forSave` gives the category to save now. While a guess is still on its way that is the unsorted one, and
 * `fill` files the block where the guess says once it has been saved.
 */
export function useCategoryField({ initial, initialTitle, initialByHand, title }: CategoryFieldOptions) {
  const queryClient = useQueryClient();
  const { categoryCache } = useData();
  const suggest = useCategorySuggester();
  const fillLater = useCategoryFill();
  const categories = useCategories().data ?? NO_CATEGORIES;
  const templates = useTemplates().data ?? NO_TEMPLATES;

  // The blocks as they were when the form opened: what the person filed before is what counts here.
  const [blocks] = useState(() => filedBlocks(queryClient));
  const activities = useMemo(() => templates.map((t) => ({ title: t.name, category: t.category })), [templates]);
  const filed = useMemo(() => [...activities, ...blocks], [activities, blocks]);

  const options = useMemo(
    () => categoryOptions(withImplicitCategories(categories, templates), filed),
    [categories, templates, filed],
  );
  /** Every category, the most used first: the order a quick choice offers them in. */
  const ranked = useMemo(
    () => rankCategories(withImplicitCategories(categories, templates).map((entry) => entry.name), filed),
    [categories, templates, filed],
  );

  /** A category for the title without asking anyone: from the person's own history, or this session's answers. */
  const known = useCallback(
    (text: string) =>
      guessCategoryFromHistory(text, activities, blocks, options) ??
      onOffer(categoryCache.get(cacheKey(text, options)), options),
    [activities, blocks, options, categoryCache],
  );

  const [state, dispatch] = useReducer(fieldReducer, undefined, () => ({
    value: initial,
    byHand: initialByHand || (initial !== null && !isCatchAllCategory(initial)),
    guessed: false,
    settledFor: normalizeEmojiTitle(initialTitle),
    title: initialTitle,
    asking: null,
  }));

  // Following the title here (not in an effect) drops a stale answer, and files a known title in the same render.
  if (state.title !== title) dispatch({ type: "title", title, known: known(title) });

  const asks = useRef(0);
  const pending = useRef<{ id: number; title: string; answer: Promise<string | null> } | null>(null);
  const normalized = normalizeEmojiTitle(title);

  const ask = useCallback((): Promise<string | null> => {
    const id = ++asks.current;
    const answer = suggest(title, options).catch(() => null);
    pending.current = { id, title: normalized, answer };
    dispatch({ type: "asked", id, title: normalized });
    void answer.then((category) => dispatch({ type: "answered", id, answer: category }));
    return answer;
  }, [suggest, title, normalized, options]);

  const due =
    !state.byHand && normalized !== "" && normalized !== state.settledFor && state.asking?.title !== normalized && options.length > 0;

  // Once typing pauses.
  const askNow = useEffectEvent(() => void ask());
  useEffect(() => {
    if (!due) return;
    const timer = setTimeout(() => askNow(), CATEGORY_TYPING_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [due, normalized]);

  /** The title field was left: no reason to wait for the typing pause. */
  const settle = () => {
    if (due) void ask();
  };

  const choose = useCallback((name: string) => dispatch({ type: "choose", name }), []);

  const forSave = (): { category: string; fill?: (taskId: string) => void } => {
    const shown = state.value ?? UNSORTED_CATEGORY;
    if (state.byHand || !normalized || state.settledFor === normalized || !options.length) return { category: shown };
    // A guess for this title is due or on its way: what shows now was meant for another title, if anything.
    const later = pending.current?.title === normalized ? pending.current.answer : ask();
    const saved = state.guessed || !state.value ? UNSORTED_CATEGORY : state.value;
    return { category: saved, fill: (taskId) => void fillLater(taskId, saved, later) };
  };

  return {
    /** The category in the field, or `null` when there is none yet (it is then saved as unsorted). */
    value: state.value,
    /** The app chose it from the title: shown as a suggestion the person can change. */
    suggested: state.guessed && !state.byHand && state.value !== null,
    /** A guess for the title as it is now is on its way. */
    guessing: state.asking !== null && state.asking.title === normalized,
    /** Every category, the most used first. */
    ranked,
    choose,
    settle,
    forSave,
  };
}
