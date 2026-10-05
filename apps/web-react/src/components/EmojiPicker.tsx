import { Check, Sparkles } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { useKeyboardInset, useMediaQuery } from "@/hooks/useViewport";
import {
  buildEmojiRows,
  emojiEntryOf,
  emojiGroups,
  emojiLookup,
  moveEmojiCursor,
  readRecentEmojis,
  rememberEmoji,
  searchEmojis,
  SUGGESTED_EMOJIS,
  type EmojiEntry,
  type EmojiMove,
  type EmojiRow,
  type EmojiSection,
} from "@/lib/emojis";

const COLUMNS = 8;
const PANEL_WIDTH = 328;
const PANEL_HEIGHT = 380;
const GAP = 6;
const HEADER_HEIGHT = 30;
/** Rows drawn past each edge of the scroller, so a fast scroll never shows a gap. */
const OVERSCAN_ROWS = 4;
/** Phones get a bottom sheet instead of a popover anchored to the field. */
const SHEET_QUERY = "(max-width: 639px)";
const TOUCH_QUERY = "(hover: none) and (pointer: coarse)";

const ARROWS: Record<string, EmojiMove> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };

const DEFAULT_TRIGGER_CLASS =
  "flex h-full w-12 shrink-0 cursor-pointer items-center justify-center rounded-l-md text-xl transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none sm:w-11 sm:text-lg";

type EmojiLine = Extract<EmojiRow, { kind: "emojis" }>;

/**
 * One drawn line of the grid. Memoised so a hover, which only changes which cell is highlighted, redraws
 * the two lines involved and not every line on screen.
 */
const EmojiLineView = memo(function EmojiLineView({
  row,
  cells,
  top,
  height,
  activeColumn,
  selectedChar,
  idPrefix,
  onChoose,
  onHover,
}: {
  row: EmojiLine;
  cells: EmojiEntry[];
  top: number;
  height: number;
  activeColumn: number;
  selectedChar: string;
  idPrefix: string;
  onChoose: (char: string) => void;
  onHover: (index: number) => void;
}) {
  return (
    <div role="presentation" className="absolute inset-x-0 grid grid-cols-8" style={{ top, height }}>
      {cells.slice(row.start, row.start + row.count).map((emoji, column) => {
        const index = row.start + column;
        const active = column === activeColumn;
        return (
          <button
            key={emoji.char}
            id={`${idPrefix}-${index}`}
            type="button"
            role="option"
            aria-selected={active}
            aria-label={emoji.label || emoji.char}
            tabIndex={-1}
            title={emoji.label || undefined}
            onClick={() => onChoose(emoji.char)}
            onMouseMove={() => onHover(index)}
            className={[
              "flex h-full w-full cursor-pointer items-center justify-center rounded-md text-xl",
              active ? "bg-accent" : "",
              !active && emoji.char === selectedChar ? "bg-primary/10 ring-1 ring-primary/40" : "",
            ].join(" ")}
          >
            {emoji.char}
          </button>
        );
      })}
    </div>
  );
});

/**
 * The emoji picker used everywhere an icon is chosen: a button showing the current emoji that opens a
 * popover on a pointer device and a bottom sheet on a phone.
 *
 * Nothing is fetched when it opens (the emoji set ships with the planner) and only the rows in view are
 * drawn, so it appears at once however many emoji there are. Type to search, arrow keys move, Enter picks.
 *
 * Where the app can pick the emoji for you (`onAuto`), `null` is a real value: the button shows a placeholder
 * instead of an emoji, and the panel starts with "Pick for me" to hand the choice back.
 */
export function EmojiPicker({
  value,
  onChange,
  onAuto,
  autoDescription = "Chosen for you when you save",
  stale = false,
  busy = false,
  placeholder,
  hint,
  className = DEFAULT_TRIGGER_CLASS,
  label = "Choose icon",
}: {
  /** The emoji, or `null` while there is none (the button then shows `placeholder`). */
  value: string | null;
  onChange: (next: string) => void;
  /** Adds "Pick for me" to the panel, which calls this. */
  onAuto?: () => void;
  /** What the "Pick for me" row says about when the emoji is chosen. */
  autoDescription?: string;
  /** A new emoji is about to replace this one: it gets a small sparkle. */
  stale?: boolean;
  /** An emoji is being chosen right now: the button pulses and can't be opened. */
  busy?: boolean;
  /** Drawn instead of an emoji while `value` is `null`; the default is a dashed square with a sparkle. */
  placeholder?: ReactNode;
  /** Said on hover, and to a screen reader, when the emoji is not simply the one showing. */
  hint?: string;
  /** Classes for the button that opens the picker; the default is the flush left end of a text field. */
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [cursor, setCursor] = useState(-1);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(PANEL_HEIGHT);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const isSheet = useMediaQuery(SHEET_QUERY);
  const isTouch = useMediaQuery(TOUCH_QUERY);
  const keyboardInset = useKeyboardInset();

  // A new emoji pops in; the one showing when the picker first appears just sits there.
  const [seen, setSeen] = useState(value);
  const [popped, setPopped] = useState<string | null>(null);
  if (seen !== value) {
    setSeen(value);
    setPopped(value);
  }

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  /** Set by an arrow key, so the grid scrolls to follow the cursor but not when the mouse moves it. */
  const followCursor = useRef(false);
  /** Scrolls and draws the rows for the new position now, instead of a frame later when the scroll event arrives. */
  const scrollTo = useCallback((scroller: HTMLElement, top: number) => {
    scroller.scrollTop = top;
    setScrollTop(top);
  }, []);
  const idPrefix = `emoji-${useId()}`;

  const rowHeight = isTouch ? 44 : 36;
  const searching = query.trim().length > 0;
  const groups = emojiGroups();

  // What the grid shows: the search results, or "Recent" (or suggestions) followed by every group.
  const { rows, cells } = useMemo(() => {
    if (!open) return { rows: [] as EmojiRow[], cells: [] as EmojiEntry[] };
    const known = emojiLookup();
    if (searching) {
      const results: EmojiSection[] = [{ id: "results", label: "", emojis: searchEmojis(groups, query) }];
      return buildEmojiRows(results, COLUMNS, false);
    }
    const first: EmojiSection = recent.length
      ? { id: "recent", label: "Recent", emojis: recent.map((char) => emojiEntryOf(char, known)) }
      : { id: "suggested", label: "Suggested", emojis: SUGGESTED_EMOJIS.map((char) => emojiEntryOf(char, known)) };
    const sections: EmojiSection[] = [first, ...groups.map((group) => ({ id: group.key, label: group.label, emojis: group.emojis }))];
    return buildEmojiRows(sections, COLUMNS);
  }, [open, searching, query, groups, recent]);

  // Where each row starts, so any row can be placed (and found by scroll position) without measuring.
  const { offsets, total } = useMemo(() => {
    const starts: number[] = [];
    let at = 0;
    for (const row of rows) {
      starts.push(at);
      at += row.kind === "header" ? HEADER_HEIGHT : rowHeight;
    }
    return { offsets: starts, total: at };
  }, [rows, rowHeight]);

  const activeCursor = cursor >= 0 && cursor < cells.length ? cursor : -1;

  // Only the rows in (or just outside) the viewport are drawn.
  const { first, last } = useMemo(() => {
    const margin = OVERSCAN_ROWS * rowHeight;
    const from = scrollTop - margin;
    const to = scrollTop + viewportHeight + margin;
    let start = 0;
    while (start < rows.length - 1 && offsets[start + 1] <= from) start += 1;
    let end = start;
    while (end < rows.length && offsets[end] < to) end += 1;
    return { first: start, last: end };
  }, [rows.length, offsets, scrollTop, viewportHeight, rowHeight]);

  /** Which group the reader is in, so the tab strip above follows the scrolling. */
  const activeGroup = useMemo(() => {
    let current = groups[0]?.key ?? "";
    rows.forEach((row, index) => {
      if (row.kind === "header" && offsets[index] <= scrollTop + 8 && groups.some((group) => group.key === row.id)) current = row.id;
    });
    return current;
  }, [rows, offsets, scrollTop, groups]);

  /** Anchors the popover under the trigger, flipping above it when there is no room below. */
  const place = useCallback(() => {
    if (isSheet) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const below = window.innerHeight - rect.bottom - GAP;
    const top = below >= PANEL_HEIGHT || below >= rect.top ? rect.bottom + GAP : Math.max(8, rect.top - GAP - PANEL_HEIGHT);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - PANEL_WIDTH - 8));
    setPosition({ top, left });
  }, [isSheet]);

  const hide = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  }, []);

  const show = useCallback(() => {
    place();
    setRecent(readRecentEmojis());
    setQuery("");
    setCursor(-1);
    setScrollTop(0);
    setOpen(true);
  }, [place]);

  // The panel follows the window while it is up.
  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", place);
    // On touch, focusing search would raise the keyboard over most of the picker; let people browse first.
    if (window.matchMedia("(hover: hover)").matches) searchRef.current?.focus();
    return () => window.removeEventListener("resize", place);
  }, [open, place]);

  // How tall the scroller is, which decides how many rows to draw.
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!open || !scroller) return;
    const measure = () => setViewportHeight(scroller.clientHeight || PANEL_HEIGHT);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [open]);

  // An arrow key moved the cursor: bring its row into view.
  useEffect(() => {
    if (!followCursor.current) return;
    followCursor.current = false;
    const scroller = scrollRef.current;
    if (!scroller || activeCursor < 0) return;
    const at = rows.findIndex((row) => row.kind === "emojis" && activeCursor >= row.start && activeCursor < row.start + row.count);
    if (at < 0) return;
    const top = offsets[at];
    const bottom = top + rowHeight;
    // Showing the section title with its first row keeps the reader oriented.
    const above = rows[at - 1]?.kind === "header" ? offsets[at - 1] : top;
    if (top < scroller.scrollTop) scrollTo(scroller, above);
    else if (bottom > scroller.scrollTop + scroller.clientHeight) scrollTo(scroller, bottom - scroller.clientHeight);
  }, [activeCursor, rows, offsets, rowHeight, scrollTo]);

  const choose = useCallback(
    (char: string) => {
      onChange(char);
      rememberEmoji(char);
      hide();
    },
    [onChange, hide],
  );

  const jumpTo = (key: string) => {
    const at = rows.findIndex((row) => row.kind === "header" && row.id === key);
    if (at >= 0 && scrollRef.current) scrollTo(scrollRef.current, offsets[at]);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      event.preventDefault();
      hide();
      return;
    }
    const move = ARROWS[event.key];
    if (move) {
      event.preventDefault();
      if (activeCursor < 0) {
        // Nothing is highlighted yet: the first press lands on the first emoji in view, not the top of the list.
        const seen = rows.findIndex((row, index) => row.kind === "emojis" && offsets[index] + rowHeight > scrollTop);
        const row = rows[seen];
        setCursor(row?.kind === "emojis" ? row.start : 0);
        return;
      }
      followCursor.current = true;
      setCursor(moveEmojiCursor(rows, cells.length, activeCursor, move));
      return;
    }
    // Enter in the search field picks the highlighted emoji, so "pizza" + Enter is all it takes.
    if (event.key === "Enter" && event.target === searchRef.current) {
      event.preventDefault();
      const picked = cells[activeCursor];
      if (picked) choose(picked.char);
    }
  };

  const highlighted = cells[activeCursor];

  const shown =
    value === null ? (
      (placeholder ?? (
        <span className="flex h-6 w-6 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      ))
    ) : (
      <span
        key={value}
        className={["relative leading-none", popped === value ? "animate-in fade-in-0 zoom-in-50 duration-200" : ""].join(" ")}
      >
        {value || "📌"}
        {stale ? (
          <Sparkles
            className="absolute -bottom-1.5 -right-2 h-3.5 w-3.5 rounded-full bg-background p-px text-muted-foreground shadow-xs"
            aria-hidden="true"
          />
        ) : null}
      </span>
    );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={hint ? `${label}. ${hint}` : label}
        title={hint}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-busy={busy || undefined}
        disabled={busy}
        onClick={() => (open ? hide() : show())}
        className={className}
      >
        <span className={["flex items-center justify-center", busy ? "motion-safe:animate-pulse" : ""].join(" ")}>{shown}</span>
      </button>

      {open &&
        createPortal(
          <div className={["fixed inset-0 z-[60]", isSheet ? "bg-black/40" : ""].join(" ")} onClick={hide}>
            <div
              role="dialog"
              aria-label="Emoji picker"
              className={[
                "fixed flex flex-col overflow-hidden border border-border bg-popover text-popover-foreground shadow-lg",
                // The popover appears at once; only the phone's sheet slides up, a short transform-only move.
                isSheet
                  ? "animate-in slide-in-from-bottom inset-x-0 rounded-t-2xl border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] duration-150"
                  : "rounded-xl",
              ].join(" ")}
              style={
                isSheet
                  ? { bottom: `${keyboardInset}px`, height: `min(75dvh, ${PANEL_HEIGHT + 80}px)` }
                  : { top: `${position.top}px`, left: `${position.left}px`, width: `${PANEL_WIDTH}px`, height: `${PANEL_HEIGHT}px` }
              }
              onClick={(event) => event.stopPropagation()}
              onKeyDown={handleKeyDown}
            >
              {isSheet && <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30" />}
              <div className="flex items-center gap-2 border-b border-border p-2">
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    // Highlight the best match so Enter picks it.
                    setCursor(event.target.value.trim() ? 0 : -1);
                    followCursor.current = false;
                    if (scrollRef.current) scrollTo(scrollRef.current, 0);
                  }}
                  type="search"
                  role="combobox"
                  aria-expanded="true"
                  aria-controls={`${idPrefix}-list`}
                  aria-activedescendant={activeCursor >= 0 ? `${idPrefix}-${activeCursor}` : undefined}
                  enterKeyHint="search"
                  autoComplete="off"
                  placeholder="Search emoji…"
                  aria-label="Search emoji"
                  className="flex h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:h-8 sm:px-2.5"
                />
                {isSheet && (
                  <button
                    type="button"
                    className="h-11 shrink-0 cursor-pointer rounded-md px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
                    onClick={hide}
                  >
                    Cancel
                  </button>
                )}
              </div>

              {onAuto && !searching && (
                <button
                  type="button"
                  className="flex w-full shrink-0 cursor-pointer items-center gap-2.5 border-b border-border px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none touch:min-h-12"
                  onClick={() => {
                    onAuto();
                    hide();
                  }}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">Pick for me</span>
                    <span className="block truncate text-xs text-muted-foreground">{autoDescription}</span>
                  </span>
                  {value === null ? <Check className="h-3.5 w-3.5 shrink-0 text-foreground" strokeWidth={3} aria-hidden="true" /> : null}
                </button>
              )}

              {!searching && groups.length > 0 && (
                <div className="flex items-center justify-between border-b border-border px-1.5 py-1">
                  {groups.map((group) => (
                    <button
                      key={group.key}
                      type="button"
                      title={group.label}
                      aria-label={group.label}
                      onClick={() => jumpTo(group.key)}
                      className={[
                        "flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-sm transition touch:h-10 touch:w-auto touch:flex-1",
                        activeGroup === group.key ? "bg-accent" : "opacity-60 hover:bg-accent/60 hover:opacity-100",
                      ].join(" ")}
                    >
                      {group.icon}
                    </button>
                  ))}
                </div>
              )}

              <div
                ref={scrollRef}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2"
                onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
              >
                {searching && cells.length === 0 && (
                  <p className="py-10 text-center text-xs text-muted-foreground">No emoji found for “{query.trim()}”</p>
                )}

                {cells.length > 0 && (
                  <div id={`${idPrefix}-list`} role="listbox" aria-label="Emoji" className="relative" style={{ height: total }}>
                    {rows.slice(first, last).map((row, offset) => {
                      const index = first + offset;
                      if (row.kind === "header") {
                        return (
                          <h3
                            key={`h-${row.id}`}
                            className="absolute inset-x-0 flex items-end px-1 pb-1 text-[11px] font-medium text-muted-foreground"
                            style={{ top: offsets[index], height: HEADER_HEIGHT }}
                          >
                            {row.label}
                          </h3>
                        );
                      }
                      const activeColumn =
                        activeCursor >= row.start && activeCursor < row.start + row.count ? activeCursor - row.start : -1;
                      return (
                        <EmojiLineView
                          key={`r-${row.start}`}
                          row={row}
                          cells={cells}
                          top={offsets[index]}
                          height={rowHeight}
                          activeColumn={activeColumn}
                          selectedChar={value ?? ""}
                          idPrefix={idPrefix}
                          onChoose={choose}
                          onHover={setCursor}
                        />
                      );
                    })}
                  </div>
                )}
              </div>

              {!isSheet && (
                <div className="flex h-8 shrink-0 items-center gap-2 border-t border-border px-3 text-xs text-muted-foreground">
                  {highlighted ? (
                    <>
                      <span className="text-base">{highlighted.char}</span>
                      <span className="truncate">{highlighted.label}</span>
                    </>
                  ) : (
                    <span>Pick an icon</span>
                  )}
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
