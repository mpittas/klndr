import {
  DURATION_CHOICES,
  formatDuration,
  sortCategoriesByName,
  withImplicitCategories,
  type ActivityTemplate,
} from "@dayro/core";
import { useCategories, useCategoryColor, useLibraryActions } from "@dayro/data";
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, Pencil, Plus, Search, SquarePen, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { CategoryMark } from "@/components/category/CategoryMark";
import { EmojiPicker } from "@/components/EmojiPicker";
import { EmojiPop } from "@/components/EmojiPop";
import { useEmojiField } from "@/hooks/useEmojiField";
import { paletteOf } from "@/lib/colors";
import { useLibrary } from "@/lib/library";

const COLLAPSED_KEY = "dayforge:collapsed-categories";

/** The category groups the person left collapsed last time; everything open when storage is unreadable. */
function readCollapsed(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter((c): c is string => typeof c === "string") : [];
  } catch {
    return [];
  }
}

/**
 * The activities of the sidebar, grouped by category, with a search, a quick add inside each group and
 * the row's drag to the timeline (the caller owns the drop) or onto another group (which moves the
 * activity there).
 *
 * A quick add goes through `@dayro/data`'s `saveTemplate`, which writes the new activity into the cache,
 * which is where `templates` comes from.
 */
export function ActivityPalette({
  templates,
  onPick,
  onDragStart,
  onDragEnd,
  onMove,
  onManage,
}: {
  templates: ActivityTemplate[];
  onPick: (template: ActivityTemplate) => void;
  onDragStart: (template: ActivityTemplate) => void;
  onDragEnd: () => void;
  onMove: (template: ActivityTemplate, category: string) => void;
  onManage: () => void;
}) {
  const categoriesQuery = useCategories();
  const colorOf = useCategoryColor();
  const { saveTemplate } = useLibraryActions();
  const { show: showLibrary } = useLibrary();

  const categories = useMemo(() => sortCategoriesByName(categoriesQuery.data ?? []), [categoriesQuery.data]);

  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);

  // The activity being dragged, and the group it is held over.
  const [dragging, setDragging] = useState<ActivityTemplate | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  // Quick add: a short form at the bottom of a category, kept open between adds.
  const [adding, setAdding] = useState<string | null>(null);
  const [addName, setAddName] = useState("");
  // Picked as the name is typed; a hand-picked emoji is for one add.
  const addEmoji = useEmojiField({ kind: "activity", initial: null, initialTitle: "", title: addName, known: templates });
  const [addDuration, setAddDuration] = useState(60);
  // Saves in flight. Several can overlap when names are typed in quick succession.
  const [addPending, setAddPending] = useState(0);
  const [addError, setAddError] = useState<string | null>(null);
  const addInput = useRef<HTMLInputElement | null>(null);

  // Read once, when the state is created: reading it in an effect would race the write below.
  const [collapsed, setCollapsed] = useState<string[]>(readCollapsed);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify(collapsed));
    } catch {
      // Storage full or blocked: the preference just won't persist.
    }
  }, [collapsed]);

  const query = search.trim().toLowerCase();

  // One group per category, including empty ones, so a new category shows up right away.
  // While searching, only groups with a match are listed.
  const groups = useMemo(() => {
    const byCategory = new Map<string, ActivityTemplate[]>();
    for (const template of templates) {
      if (query && !template.name.toLowerCase().includes(query) && !template.category.toLowerCase().includes(query)) {
        continue;
      }
      const list = byCategory.get(template.category) ?? [];
      list.push(template);
      byCategory.set(template.category, list);
    }
    return withImplicitCategories(categories, templates)
      .map((entry) => ({ category: entry.name, color: entry.color, emoji: entry.emoji, items: byCategory.get(entry.name) ?? [] }))
      .filter((group) => !query || group.items.length > 0);
  }, [categories, templates, query]);

  const matchCount = useMemo(() => groups.reduce((sum, g) => sum + g.items.length, 0), [groups]);

  // While searching, every group with a match is shown so nothing hides behind a collapsed header.
  const isOpen = (category: string) => query !== "" || !collapsed.includes(category);

  const toggleGroup = (category: string) =>
    setCollapsed((current) =>
      current.includes(category) ? current.filter((c) => c !== category) : [...current, category],
    );

  const allCollapsed = groups.length > 0 && groups.every((g) => collapsed.includes(g.category));
  const toggleAll = () => setCollapsed(allCollapsed ? [] : groups.map((g) => g.category));

  const clearSearch = () => {
    setSearch("");
    searchRef.current?.focus();
  };

  const onGroupDragOver = (event: React.DragEvent<HTMLElement>, category: string) => {
    if (!dragging) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    setDropTarget(category);
  };

  const onGroupDragLeave = (event: React.DragEvent<HTMLElement>, category: string) => {
    const next = event.relatedTarget as Node | null;
    if (dropTarget === category && !event.currentTarget.contains(next)) setDropTarget(null);
  };

  // Dropping an activity on a category group moves it there; the drop works on the whole group, so it
  // also works on a collapsed one.
  const onGroupDrop = (category: string) => {
    const template = dragging;
    setDragging(null);
    setDropTarget(null);
    // The dragged row may be re-rendered into another group, in which case it never gets "dragend".
    onDragEnd();
    if (template && template.category !== category) onMove(template, category);
  };

  const endDrag = () => {
    setDragging(null);
    setDropTarget(null);
    onDragEnd();
  };

  const startAdd = (category: string) => {
    setAdding(category);
    setAddName("");
    addEmoji.reset();
    setAddError(null);
    setCollapsed((current) => current.filter((c) => c !== category));
    requestAnimationFrame(() => {
      addInput.current?.focus();
      addInput.current?.scrollIntoView({ block: "nearest" });
    });
  };

  const stopAdd = () => {
    setAdding(null);
    setAddError(null);
  };

  const submitAdd = async (category: string) => {
    const name = addName.trim();
    if (!name) {
      addInput.current?.focus();
      return;
    }
    setAddPending((n) => n + 1);
    setAddError(null);
    // Added at once, even when its emoji is still being picked: that one is put on the activity when it arrives.
    const picked = addEmoji.forSave();
    // Cleared at once so the next name can be typed while this one saves; put back if saving fails.
    setAddName("");
    addEmoji.reset();
    try {
      const saved = await saveTemplate({
        id: null,
        draft: {
          name,
          emoji: picked.emoji,
          color: colorOf({ category }),
          category,
          defaultDuration: addDuration,
          notes: null,
        },
      });
      picked.fill?.({ kind: "template", id: saved.id });
    } catch (err) {
      setAddName((current) => (current ? current : name));
      setAddError(err instanceof Error ? err.message : "Could not add that activity");
    } finally {
      setAddPending((n) => n - 1);
      requestAnimationFrame(() => addInput.current?.focus());
    }
  };

  const onRowDragStart = (event: React.DragEvent<HTMLLIElement>, template: ActivityTemplate) => {
    setDragging(template);
    onDragStart(template);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "copyMove";
      event.dataTransfer.setData("application/x-dayforge-template", String(template.id));
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Search */}
      <div className="px-3 pb-2 pt-1">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              ref={searchRef}
              value={search}
              type="text"
              placeholder="Search activities"
              aria-label="Search activities"
              className="field h-9 pl-8 pr-8 text-[13px]"
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") clearSearch();
              }}
            />
            {search ? (
              <button
                type="button"
                className="btn btn-ghost btn-icon absolute right-1.5 top-1/2 h-6 -translate-y-1/2 rounded-md"
                aria-label="Clear search"
                onClick={clearSearch}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          {!query && groups.length > 1 ? (
            <button
              type="button"
              className="btn btn-ghost btn-icon h-9"
              title={allCollapsed ? "Expand all categories" : "Collapse all categories"}
              aria-label={allCollapsed ? "Expand all categories" : "Collapse all categories"}
              onClick={toggleAll}
            >
              {allCollapsed ? (
                <ChevronsUpDown className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronsDownUp className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          ) : null}
        </div>
      </div>

      {/* Activities, grouped by category */}
      <div className="flex-1 overflow-y-auto px-2 pb-3 pt-1.5">
        {groups.length === 0 ? (
          <div className="px-3 py-10 text-center">
            <p className="text-sm font-medium text-foreground">
              {templates.length === 0 ? "No activities yet" : `No matches for "${search.trim()}"`}
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-xs mt-3"
              onClick={() => (templates.length === 0 ? onManage() : clearSearch())}
            >
              {templates.length === 0 ? "Create your first activity" : "Clear search"}
            </button>
          </div>
        ) : null}

        {groups.map((group) => (
          <section
            key={group.category}
            className={[
              "mb-2 rounded-xl border transition-colors duration-150",
              dropTarget === group.category && dragging?.category !== group.category
                ? "border-ring/50 bg-brand/[0.05]"
                : "border-transparent",
            ].join(" ")}
            onDragOver={(event) => onGroupDragOver(event, group.category)}
            onDragLeave={(event) => onGroupDragLeave(event, group.category)}
            onDrop={(event) => {
              event.preventDefault();
              onGroupDrop(group.category);
            }}
          >
            <div>
              <button
                type="button"
                className="flex h-8 w-full cursor-pointer items-center justify-between gap-2 rounded-lg pl-1.5 pr-2 text-left text-[13px] font-semibold text-foreground transition-colors hover:bg-foreground/[0.045]"
                aria-expanded={isOpen(group.category)}
                onClick={() => toggleGroup(group.category)}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <ChevronRight
                    className={[
                      "h-3.5 w-3.5 shrink-0 text-muted-foreground/70 transition-transform duration-200",
                      isOpen(group.category) ? "rotate-90" : "",
                    ].join(" ")}
                    aria-hidden="true"
                  />
                  <CategoryMark emoji={group.emoji} color={group.color} size="sm" />
                  <span className="truncate tracking-[-0.01em]">{group.category}</span>
                </div>
                <span className="count">
                  {group.items.length}
                </span>
              </button>
            </div>

            {isOpen(group.category) ? (
              <ul className="space-y-px pb-1 pt-0.5">
                {group.items.map((template) => (
                  <li
                    key={template.id}
                    draggable
                    role="button"
                    tabIndex={0}
                    title={`${template.name} · ${formatDuration(template.defaultDuration)}`}
                    className={[
                      "group flex h-9 cursor-grab items-center gap-2.5 rounded-lg px-2 transition-colors hover:bg-foreground/[0.045] active:cursor-grabbing touch:h-11",
                      dragging?.id === template.id ? "opacity-40" : "",
                    ].join(" ")}
                    onDragStart={(event) => onRowDragStart(event, template)}
                    onDragEnd={endDrag}
                    onClick={() => onPick(template)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      onPick(template);
                    }}
                  >
                    <span
                      className={[
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[13px] leading-none",
                        paletteOf(colorOf(template)).icon,
                      ].join(" ")}
                    >
                      <EmojiPop emoji={template.emoji} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                      {template.name}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground group-hover:hidden group-focus-within:hidden touch:hidden">
                      {formatDuration(template.defaultDuration)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Edit ${template.name}`}
                      title="Edit"
                      draggable={false}
                      className="btn btn-ghost btn-icon -mr-1 hidden h-6 rounded-md hover:bg-foreground/[0.07] group-hover:inline-flex group-focus-within:inline-flex touch:inline-flex touch:h-9 touch:opacity-70"
                      onClick={(event) => {
                        event.stopPropagation();
                        showLibrary({ kind: "edit", id: template.id });
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") event.stopPropagation();
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}

                {adding === group.category ? (
                  <li className="rounded-xl border border-border bg-card p-1.5 shadow-sm">
                    <form
                      className="space-y-1.5"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void submitAdd(group.category);
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Escape") return;
                        event.stopPropagation();
                        event.preventDefault();
                        stopAdd();
                      }}
                    >
                      <div className="flex h-9 items-center rounded-lg border border-border bg-muted/50 transition-[border-color,box-shadow,background-color] focus-within:border-ring focus-within:bg-card focus-within:ring-[3px] focus-within:ring-ring/15">
                        <EmojiPicker
                          value={addEmoji.emoji}
                          busy={addEmoji.picking}
                          automatic={addEmoji.automatic}
                          autoDisabled={!addName.trim()}
                          hint={addEmoji.hint}
                          onChange={addEmoji.choose}
                          onAuto={addEmoji.auto}
                        />
                        <span className="h-4 w-px shrink-0 bg-border" />
                        <input
                          ref={addInput}
                          value={addName}
                          maxLength={80}
                          autoComplete="off"
                          enterKeyHint="done"
                          aria-label={`New activity in ${group.category}`}
                          placeholder="New activity, press Enter"
                          className="h-full min-w-0 flex-1 bg-transparent px-2 text-[13px] placeholder:text-muted-foreground/75 focus-visible:outline-none"
                          onChange={(event) => setAddName(event.target.value)}
                          onBlur={addEmoji.settle}
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={addDuration}
                          aria-label="Default length"
                          className="field h-7 flex-1 cursor-pointer rounded-md px-1.5 text-xs tabular-nums"
                          onChange={(event) => setAddDuration(Number(event.target.value))}
                        >
                          {DURATION_CHOICES.map((minutes) => (
                            <option key={minutes} value={minutes}>
                              {formatDuration(minutes)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={stopAdd}
                        >
                          Done
                        </button>
                        <button
                          type="submit"
                          disabled={!addName.trim()}
                          className="btn btn-primary btn-xs px-3"
                        >
                          {addPending > 0 ? "Adding…" : "Add"}
                        </button>
                      </div>
                      {addError ? (
                        <p className="px-0.5 text-xs font-medium text-destructive" role="alert">
                          {addError}
                        </p>
                      ) : null}
                    </form>
                  </li>
                ) : (
                  <li>
                    <button
                      type="button"
                      className="group/add flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.045] hover:text-foreground"
                      onClick={() => startAdd(group.category)}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-dashed border-foreground/20 transition-colors group-hover/add:border-foreground/40">
                        <Plus className="h-3 w-3" aria-hidden="true" />
                      </span>
                      Add activity
                    </button>
                  </li>
                )}
              </ul>
            ) : null}
          </section>
        ))}
      </div>

      {/* Footer: where to edit the library */}
      <div className="border-t border-border px-3 py-3">
        {query ? (
          <p className="mb-2 text-xs tabular-nums text-muted-foreground">
            {matchCount} of {templates.length} activities
          </p>
        ) : null}
        <button
          type="button"
          className="btn btn-secondary btn-sm w-full"
          onClick={() => showLibrary()}
        >
          <SquarePen className="text-muted-foreground" aria-hidden="true" />
          Edit activities &amp; categories
        </button>
      </div>
    </div>
  );
}
