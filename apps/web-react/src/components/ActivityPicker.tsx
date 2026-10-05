import { formatDuration, type ActivityTemplate } from "@klndr/core";
import { Check, ChevronDown, PencilLine, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";

import { useKeyboardInset, useMediaQuery } from "@/hooks/useViewport";

const PANEL_MAX_HEIGHT = 360;
const GAP = 6;
/** Phones get a bottom sheet instead of a popover anchored to the field. */
const SHEET_QUERY = "(max-width: 639px)";
/** A search box only earns its room once the list is long enough to need it. */
const SEARCH_FROM = 7;

/**
 * The "Start from an activity" field: it shows the activity in use and opens a list of the rest, each with
 * its emoji, category and length, instead of a wall of chips to scroll through. A pointer device gets a
 * popover anchored to the field; a phone gets a bottom sheet above the on-screen keyboard. A long list can be
 * searched.
 */
export function ActivityPicker({
  value,
  templates,
  onChange,
}: {
  /** The chosen activity's id, or `null` for a block of its own. */
  value: string | null;
  templates: ActivityTemplate[];
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const isSheet = useMediaQuery(SHEET_QUERY);
  const keyboardInset = useKeyboardInset();
  const [position, setPosition] = useState({ top: 0, left: 0, width: 280, maxHeight: PANEL_MAX_HEIGHT });

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const selected = templates.find((template) => template.id === value) ?? null;
  const searchable = templates.length >= SEARCH_FROM;

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return templates;
    return templates.filter((template) => `${template.name} ${template.category}`.toLowerCase().includes(needle));
  }, [templates, query]);

  /** Anchors the popover to the field, opening upwards when there is no room below. */
  const place = useCallback(() => {
    if (isSheet) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const below = window.innerHeight - rect.bottom - GAP - 8;
    const above = rect.top - GAP - 8;
    const openUp = below < 240 && above > below;
    const maxHeight = Math.min(PANEL_MAX_HEIGHT, openUp ? above : below);
    const width = Math.max(rect.width, 280);
    setPosition({
      top: openUp ? rect.top - GAP - maxHeight : rect.bottom + GAP,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      width,
      maxHeight,
    });
  }, [isSheet]);

  const hide = useCallback(() => {
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus({ preventScroll: true });
  }, []);

  // The panel follows the window while it is up.
  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, place]);

  // Once the panel is up, a pointer device lands in the search box; a phone leaves the keyboard down and
  // puts the focus on the option in use.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const wantsSearch = searchable && window.matchMedia("(hover: hover)").matches;
    if (wantsSearch) {
      searchRef.current?.focus({ preventScroll: true });
      return;
    }
    const active =
      panel.querySelector<HTMLElement>('[aria-selected="true"]') ?? panel.querySelector<HTMLElement>("[role=option]");
    active?.focus({ preventScroll: true });
    active?.scrollIntoView({ block: "nearest" });
  }, [open, searchable]);

  const show = () => {
    place();
    setOpen(true);
  };

  const choose = (id: string | null) => {
    onChange(id);
    hide();
  };

  // Arrow keys move through the options, and out of the search box into them.
  const onPanelKeydown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      event.preventDefault();
      hide();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const options = [...(panelRef.current?.querySelectorAll<HTMLElement>("[role=option]") ?? [])];
    if (!options.length) return;
    const index = options.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "ArrowDown" ? index + 1 : index - 1;
    options[Math.max(0, Math.min(options.length - 1, next))]?.focus();
    event.preventDefault();
  };

  const optionClass =
    "flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-accent focus-visible:bg-accent focus-visible:outline-none touch:min-h-14 touch:px-3";

  return (
    <div>
      <span id="task-activity-label" className="text-xs font-medium text-foreground">
        Start from an activity
      </span>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby="task-activity-label task-activity-value"
        className="mt-1.5 flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-md border border-input bg-background px-2.5 text-left text-sm shadow-xs transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:h-9"
        onClick={() => (open ? hide() : show())}
      >
        <span className="flex w-5 shrink-0 items-center justify-center text-base leading-none" aria-hidden="true">
          {selected ? selected.emoji : <PencilLine className="h-4 w-4 text-muted-foreground" />}
        </span>
        <span id="task-activity-value" className="min-w-0 flex-1 truncate text-foreground">
          {selected ? selected.name : "Custom block"}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {selected ? formatDuration(selected.defaultDuration) : `${templates.length} saved`}
        </span>
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
                    ? { bottom: `${keyboardInset}px`, maxHeight: `min(75dvh, ${PANEL_MAX_HEIGHT + 140}px)` }
                    : {
                        top: `${position.top}px`,
                        left: `${position.left}px`,
                        width: `${position.width}px`,
                        maxHeight: `${position.maxHeight}px`,
                      }
                }
                onClick={(event) => event.stopPropagation()}
                onKeyDown={onPanelKeydown}
              >
                {isSheet ? (
                  <div className="shrink-0 px-4 pb-1 pt-2.5">
                    <div className="mx-auto h-1.5 w-10 rounded-full bg-muted-foreground/30" />
                    <p className="mt-2 text-sm font-semibold text-foreground">Start from an activity</p>
                  </div>
                ) : null}

                {searchable ? (
                  <div className="shrink-0 border-b border-border p-2">
                    <label className="flex h-11 items-center gap-2 rounded-md border border-input bg-background px-2.5 focus-within:ring-1 focus-within:ring-ring sm:h-9">
                      <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <input
                        ref={searchRef}
                        value={query}
                        type="search"
                        autoComplete="off"
                        enterKeyHint="search"
                        aria-label="Search activities"
                        placeholder="Search activities"
                        className="h-full min-w-0 flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus-visible:outline-none"
                        onChange={(event) => setQuery(event.target.value)}
                      />
                    </label>
                  </div>
                ) : null}

                <ul role="listbox" aria-label="Activities" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
                  {!query.trim() ? (
                    <li role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={!selected}
                        className={optionClass}
                        onClick={() => choose(null)}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
                          <PencilLine className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-foreground">Custom block</span>
                          <span className="block truncate text-xs text-muted-foreground">Name it yourself</span>
                        </span>
                        {!selected ? <Check className="h-4 w-4 shrink-0 text-foreground" aria-hidden="true" strokeWidth={3} /> : null}
                      </button>
                    </li>
                  ) : null}

                  {matches.map((template) => {
                    const current = template.id === value;
                    return (
                      <li key={template.id} role="presentation">
                        <button
                          type="button"
                          role="option"
                          aria-selected={current}
                          className={optionClass}
                          onClick={() => choose(template.id)}
                        >
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-lg leading-none"
                            aria-hidden="true"
                          >
                            {template.emoji}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-foreground">{template.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {template.category} · {formatDuration(template.defaultDuration)}
                            </span>
                          </span>
                          {current ? <Check className="h-4 w-4 shrink-0 text-foreground" aria-hidden="true" strokeWidth={3} /> : null}
                        </button>
                      </li>
                    );
                  })}

                  {query.trim() && !matches.length ? (
                    <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                      No activity matches “{query.trim()}”
                    </li>
                  ) : null}
                </ul>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
