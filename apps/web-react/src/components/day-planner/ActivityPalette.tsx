import {
  DURATION_CHOICES,
  formatDuration,
  sortCategoriesByName,
  withImplicitCategories,
  type ActivityTemplate,
} from "@klndr/core";
import { useCategories, useCategoryColor, useLibraryActions } from "@klndr/data";
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, Pencil, Plus, Search, SquarePen, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { EmojiPicker } from "@/components/EmojiPicker";
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
 * A quick add goes through `@klndr/data`'s `saveTemplate`, which writes the new activity into the cache,
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
  const [addEmoji, setAddEmoji] = useState("📌");
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
      .map((entry) => ({ category: entry.name, color: entry.color, items: byCategory.get(entry.name) ?? [] }))
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
    // Cleared at once so the next name can be typed while this one saves; put back if saving fails.
    setAddName("");
    try {
      await saveTemplate({
        id: null,
        draft: {
          name,
          emoji: addEmoji || "📌",
          color: colorOf({ category }),
          category,
          defaultDuration: addDuration,
          notes: null,
        },
      });
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
      <div className="px-3 pb-2 pt-2.5">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              ref={searchRef}
              value={search}
              type="text"
              placeholder="Search activities"
              aria-label="Search activities"
              className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-8 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") clearSearch();
              }}
            />
            {search ? (
              <button
                type="button"
                className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
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
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-input bg-background text-muted-foreground shadow-xs transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
      <div className="flex-1 overflow-y-auto px-2 pb-3 pt-1">
        {groups.length === 0 ? (
          <div className="px-3 py-10 text-center">
            <p className="text-sm font-medium text-foreground">
              {templates.length === 0 ? "No activities yet" : `No matches for "${search.trim()}"`}
            </p>
            <button
              type="button"
              className="mt-2 cursor-pointer text-xs font-medium text-muted-foreground underline underline-offset-2 transition hover:text-foreground"
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
              "mb-2.5 overflow-hidden rounded-xl border bg-card shadow-2xs transition-all",
              dropTarget === group.category && dragging?.category !== group.category
                ? "border-ring bg-accent/60 ring-2 ring-ring/30"
                : "border-border/70",
            ].join(" ")}
            onDragOver={(event) => onGroupDragOver(event, group.category)}
            onDragLeave={(event) => onGroupDragLeave(event, group.category)}
            onDrop={(event) => {
              event.preventDefault();
              onGroupDrop(group.category);
            }}
          >
            <div className="bg-muted/40">
              <button
                type="button"
                className="flex w-full cursor-pointer items-center justify-between gap-2 px-2.5 py-2 text-left text-xs font-semibold text-foreground transition hover:bg-muted/70"
                aria-expanded={isOpen(group.category)}
                onClick={() => toggleGroup(group.category)}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <ChevronRight
                    className={[
                      "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
                      isOpen(group.category) ? "rotate-90 text-foreground" : "",
                    ].join(" ")}
                    aria-hidden="true"
                  />
                  <span
                    className={["h-2.5 w-2.5 shrink-0 rounded-full shadow-2xs", paletteOf(group.color).dot].join(" ")}
                  />
                  <span className="truncate font-semibold tracking-tight text-foreground">{group.category}</span>
                </div>
                <span className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {group.items.length}
                </span>
              </button>
            </div>

            {isOpen(group.category) ? (
              <ul className="space-y-0.5 border-t border-border/40 p-1">
                {group.items.map((template) => (
                  <li
                    key={template.id}
                    draggable
                    role="button"
                    tabIndex={0}
                    title={`${template.name} · ${formatDuration(template.defaultDuration)}`}
                    className={[
                      "group flex cursor-grab items-center gap-2 rounded-md border border-transparent px-2 py-1 outline-none transition hover:border-border hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring active:cursor-grabbing",
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
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs leading-none",
                        paletteOf(colorOf(template)).icon,
                      ].join(" ")}
                    >
                      {template.emoji}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                      {template.name}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                      {formatDuration(template.defaultDuration)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Edit ${template.name}`}
                      title="Edit"
                      draggable={false}
                      className="-mr-1 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group-hover:opacity-100 touch:h-9 touch:w-9 touch:opacity-70"
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
                  <li className="rounded-md border border-ring/60 bg-background p-1.5 shadow-2xs">
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
                      <div className="flex h-8 items-center rounded-md border border-input bg-background transition-colors focus-within:ring-1 focus-within:ring-ring">
                        <EmojiPicker value={addEmoji} onChange={setAddEmoji} />
                        <span className="h-4 w-px shrink-0 bg-border" />
                        <input
                          ref={addInput}
                          value={addName}
                          maxLength={80}
                          autoComplete="off"
                          enterKeyHint="done"
                          aria-label={`New activity in ${group.category}`}
                          placeholder="New activity, press Enter"
                          className="h-full min-w-0 flex-1 bg-transparent px-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none"
                          onChange={(event) => setAddName(event.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={addDuration}
                          aria-label="Default length"
                          className="h-7 min-w-0 flex-1 cursor-pointer rounded-md border border-input bg-background px-2 text-xs tabular-nums focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                          className="h-7 cursor-pointer rounded-md px-2.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          onClick={stopAdd}
                        >
                          Done
                        </button>
                        <button
                          type="submit"
                          disabled={!addName.trim()}
                          className="h-7 cursor-pointer rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {addPending > 0 ? "Adding…" : "Add"}
                        </button>
                      </div>
                      {addError ? (
                        <p className="text-[11px] font-medium text-destructive" role="alert">
                          {addError}
                        </p>
                      ) : null}
                    </form>
                  </li>
                ) : (
                  <li>
                    <button
                      type="button"
                      className="flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium text-muted-foreground/80 transition hover:bg-accent/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      onClick={() => startAdd(group.category)}
                    >
                      <Plus className="h-3 w-3" aria-hidden="true" />
                      Add new activity
                    </button>
                  </li>
                )}
              </ul>
            ) : null}
          </section>
        ))}
      </div>

      {/* Footer: where to edit the library */}
      <div className="border-t border-border px-3 py-2.5">
        {query ? (
          <p className="mb-2 text-[11px] tabular-nums text-muted-foreground">
            {matchCount} of {templates.length} activities
          </p>
        ) : null}
        <button
          type="button"
          className="inline-flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-input bg-background text-xs font-medium text-foreground shadow-xs transition hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          onClick={() => showLibrary()}
        >
          <SquarePen className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          Edit activities &amp; categories
        </button>
      </div>
    </div>
  );
}
