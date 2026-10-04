import {
  nextCategoryColor,
  sortCategoriesByName,
  withImplicitCategories,
  type ActivityTemplate,
} from "@klndr/core";
import { useCategories, useLibraryActions } from "@klndr/data";
import { Check, ChevronDown, Plus, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";

import { useKeyboardInset, useMediaQuery } from "@/hooks/useViewport";
import { paletteOf } from "@/lib/colors";
import { useLibrary } from "@/lib/library";

const PANEL_MAX_HEIGHT = 340;
const GAP = 6;
/** Phones get a bottom sheet instead of a popover anchored to the field. */
const SHEET_QUERY = "(max-width: 639px)";

/**
 * The field that shows the current category with its dot and opens a list of the rest, with "new
 * category" and "manage categories…" at the bottom. A pointer device gets a popover anchored to the field;
 * a phone gets a bottom sheet that sits above the on-screen keyboard.
 */
export function CategorySelect({
  value,
  templates,
  onChange,
  className,
}: {
  value: string;
  templates?: ActivityTemplate[];
  onChange: (next: string) => void;
  className?: string;
}) {
  const categoriesQuery = useCategories();
  const { createCategory } = useLibraryActions();
  const { show: showLibrary } = useLibrary();

  const [open, setOpen] = useState(false);
  const isSheet = useMediaQuery(SHEET_QUERY);
  const keyboardInset = useKeyboardInset();
  const [position, setPosition] = useState({ top: 0, left: 0, width: 240, maxHeight: PANEL_MAX_HEIGHT });

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newError, setNewError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const newInputRef = useRef<HTMLInputElement | null>(null);

  const categories = useMemo(() => sortCategoriesByName(categoriesQuery.data ?? []), [categoriesQuery.data]);

  const entries = useMemo(() => {
    const list = withImplicitCategories(categories, templates);
    const current = value?.trim();
    // The current value may not be saved anywhere yet (e.g. a brand-new typed name).
    if (current && !list.some((c) => c.name.toLowerCase() === current.toLowerCase())) {
      list.push({ id: null, name: current, color: "slate" });
    }
    return list;
  }, [categories, templates, value]);

  const selected = entries.find((c) => c.name.toLowerCase() === value?.trim().toLowerCase());

  /** Anchors the popover to the field, opening upwards when there is no room below. */
  const place = useCallback(() => {
    if (isSheet) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const below = window.innerHeight - rect.bottom - GAP - 8;
    const above = rect.top - GAP - 8;
    const openUp = below < 220 && above > below;
    const maxHeight = Math.min(PANEL_MAX_HEIGHT, openUp ? above : below);
    const width = Math.max(rect.width, 240);
    setPosition({
      top: openUp ? rect.top - GAP - maxHeight : rect.bottom + GAP,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      width,
      maxHeight,
    });
  }, [isSheet]);

  const hide = useCallback(() => {
    setOpen(false);
    setCreating(false);
    setNewName("");
    setNewError(null);
    triggerRef.current?.focus({ preventScroll: true });
  }, []);

  // The panel follows the window while it is up.
  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, place]);

  // Once the panel is up, the option in use takes the focus.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const active =
      panel.querySelector<HTMLElement>('[aria-selected="true"]') ?? panel.querySelector<HTMLElement>("[role=option]");
    active?.focus({ preventScroll: true });
    active?.scrollIntoView({ block: "nearest" });
  }, [open]);

  const show = () => {
    place();
    setCreating(false);
    setOpen(true);
  };

  const choose = (name: string) => {
    onChange(name);
    hide();
  };

  const startCreating = () => {
    setCreating(true);
    setNewError(null);
    requestAnimationFrame(() => newInputRef.current?.focus());
  };

  const submitNew = async () => {
    const name = newName.trim();
    if (!name || busy) return;
    const existing = entries.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      choose(existing.name);
      return;
    }
    setBusy(true);
    setNewError(null);
    try {
      const created = await createCategory({ draft: { name, color: nextCategoryColor(categories) } });
      choose(created.name);
    } catch (err) {
      setNewError(err instanceof Error ? err.message : "Could not add category");
    } finally {
      setBusy(false);
    }
  };

  const manage = () => {
    hide();
    showLibrary({ kind: "new-category" });
  };

  // Arrow keys move through the options.
  const onListKeydown = (event: ReactKeyboardEvent<HTMLUListElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const options = [...(panelRef.current?.querySelectorAll<HTMLElement>("[role=option]") ?? [])];
    const index = options.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "ArrowDown" ? index + 1 : index - 1;
    options[Math.max(0, Math.min(options.length - 1, next))]?.focus();
    event.preventDefault();
  };

  const isCurrent = (name: string) => name.toLowerCase() === value?.trim().toLowerCase();


  return (
    <div className={["relative", className ?? ""].join(" ")}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-11 w-full cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-2.5 text-left text-sm shadow-xs transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:h-9 sm:px-2"
        onClick={() => (open ? hide() : show())}
      >
        <span className={["h-2.5 w-2.5 shrink-0 rounded-full", paletteOf(selected?.color ?? "slate").dot].join(" ")} />
        <span className="min-w-0 flex-1 truncate text-foreground">{value || "Choose a category"}</span>
        <ChevronDown
          className={["h-4 w-4 shrink-0 text-muted-foreground transition-transform", open ? "rotate-180" : ""].join(" ")}
          aria-hidden="true"
        />
      </button>

      {open
        ? createPortal(
            <div className={["fixed inset-0 z-[60]", isSheet ? "bg-black/40" : ""].join(" ")} onClick={hide}>
              <div
                ref={panelRef}
                className={[
                  "fixed flex flex-col overflow-hidden border border-border bg-popover text-popover-foreground shadow-lg",
                  isSheet
                    ? "inset-x-0 rounded-t-2xl border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)]"
                    : "rounded-xl",
                ].join(" ")}
                style={
                  isSheet
                    ? { bottom: `${keyboardInset}px`, maxHeight: `min(70dvh, ${PANEL_MAX_HEIGHT + 100}px)` }
                    : {
                        top: `${position.top}px`,
                        left: `${position.left}px`,
                        width: `${position.width}px`,
                        maxHeight: `${position.maxHeight}px`,
                      }
                }
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key !== "Escape") return;
                  event.stopPropagation();
                  event.preventDefault();
                  hide();
                }}
              >
                {isSheet ? (
                  <div className="shrink-0 border-b border-border px-4 pb-2.5 pt-2.5">
                    <div className="mx-auto h-1.5 w-10 rounded-full bg-muted-foreground/30" />
                    <p className="mt-2 text-sm font-semibold text-foreground">Category</p>
                  </div>
                ) : null}

                <ul
                  role="listbox"
                  aria-label="Categories"
                  className="min-h-0 flex-1 overflow-y-auto p-1"
                  onKeyDown={onListKeydown}
                >
                  {entries.map((entry) => (
                    <li key={entry.name} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={isCurrent(entry.name)}
                        className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-accent focus-visible:bg-accent focus-visible:outline-none touch:min-h-12 touch:px-3"
                        onClick={() => choose(entry.name)}
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                          <span className={["h-2.5 w-2.5 rounded-full", paletteOf(entry.color).dot].join(" ")} />
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium text-foreground">{entry.name}</span>
                        {isCurrent(entry.name) ? (
                          <Check className="h-3.5 w-3.5 shrink-0 text-foreground" aria-hidden="true" strokeWidth={3} />
                        ) : null}
                      </button>
                    </li>
                  ))}
                  {!entries.length ? (
                    <li className="px-3 py-4 text-center text-xs text-muted-foreground">No categories yet</li>
                  ) : null}
                </ul>


                <div className="shrink-0 border-t border-border p-1">
                  {creating ? (
                    <form
                      className="p-1"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void submitNew();
                      }}
                    >
                      <div className="flex gap-1.5">
                        <input
                          ref={newInputRef}
                          value={newName}
                          type="text"
                          maxLength={40}
                          autoComplete="off"
                          placeholder="New category name"
                          className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:h-8"
                          onChange={(event) => {
                            setNewError(null);
                            setNewName(event.target.value);
                          }}
                        />
                        <button
                          type="submit"
                          disabled={busy || !newName.trim()}
                          className="h-10 shrink-0 cursor-pointer rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 sm:h-8 sm:px-3 sm:text-xs"
                        >
                          Add
                        </button>
                      </div>
                      {newError ? (
                        <p className="mt-1.5 text-xs font-medium text-destructive" role="alert">
                          {newError}
                        </p>
                      ) : null}
                    </form>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm font-medium text-foreground transition hover:bg-accent focus-visible:bg-accent focus-visible:outline-none touch:min-h-12 touch:px-3"
                        onClick={startCreating}
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                        New category
                      </button>
                      <button
                        type="button"
                        className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:outline-none touch:min-h-12 touch:px-3"
                        onClick={manage}
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                        Manage categories…
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
