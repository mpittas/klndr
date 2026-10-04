import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useKeyboardInset, useMediaQuery } from "@/hooks/useViewport";
import { loadEmojiGroups, readRecentEmojis, rememberEmoji, searchEmojis, type EmojiEntry, type EmojiGroup } from "@/lib/emojis";

const PANEL_WIDTH = 328;
const PANEL_HEIGHT = 380;
const GAP = 6;
/** Phones get a bottom sheet instead of a popover anchored to the field. */
const SHEET_QUERY = "(max-width: 639px)";

const EMOJI_BUTTON_CLASS =
  "flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-xl transition hover:bg-accent touch:h-11 touch:w-full";

/**
 * A grid of emoji buttons. The picker re-renders on every hover (the footer shows the emoji under the
 * pointer), and without `memo` that would re-render all of the ~1,800 buttons each time.
 */
const EmojiGrid = memo(function EmojiGrid({
  emojis,
  onChoose,
  onHover,
}: {
  emojis: EmojiEntry[];
  onChoose: (char: string) => void;
  onHover: (emoji: EmojiEntry) => void;
}) {
  return (
    <>
      {emojis.map((emoji) => (
        <button
          key={emoji.char}
          type="button"
          title={emoji.label}
          onClick={() => onChoose(emoji.char)}
          onMouseEnter={() => onHover(emoji)}
          className={EMOJI_BUTTON_CLASS}
        >
          {emoji.char}
        </button>
      ))}
    </>
  );
});

/**
 * The trigger is a button; the panel is a popover anchored to it on a pointer device and a bottom sheet
 * on a phone.
 */
export function EmojiPicker({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<EmojiGroup[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [activeGroup, setActiveGroup] = useState("");
  const [hovered, setHovered] = useState<EmojiEntry | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const isSheet = useMediaQuery(SHEET_QUERY);
  const keyboardInset = useKeyboardInset();

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const panelId = `emoji-picker-${useId()}`;

  const searching = query.trim().length > 0;
  const results = useMemo(() => searchEmojis(groups, query), [groups, query]);
  const loading = open && groups.length === 0 && !loadFailed;

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
    setHovered(null);
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

  // The dataset is large, so it loads on first open rather than with the app.
  useEffect(() => {
    if (!open || groups.length) return;
    let cancelled = false;
    loadEmojiGroups().then(
      (loaded) => {
        if (cancelled) return;
        setLoadFailed(false);
        setGroups(loaded);
        setActiveGroup(loaded[0]?.key ?? "");
      },
      () => {
        if (!cancelled) setLoadFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [open, groups.length]);

  /** Which group the reader is looking at, so the tab strip above stays in step while scrolling. */
  const syncActiveGroup = useCallback(() => {
    const container = scrollRef.current;
    if (!container || searching) return;
    const top = container.getBoundingClientRect().top;
    let current = groups[0]?.key ?? "";
    for (const el of container.querySelectorAll<HTMLElement>("[data-group]")) {
      if (el.getBoundingClientRect().top - top <= 8) current = el.dataset.group ?? current;
    }
    setActiveGroup(current);
  }, [groups, searching]);

  useEffect(() => {
    if (open) syncActiveGroup();
  }, [open, syncActiveGroup]);

  const choose = useCallback(
    (char: string) => {
      onChange(char);
      rememberEmoji(char);
      hide();
    },
    [onChange, hide],
  );

  const jumpTo = (key: string) => {
    setActiveGroup(key);
    scrollRef.current?.querySelector(`[data-group="${key}"]`)?.scrollIntoView({ block: "start" });
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Choose icon"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? hide() : show())}
        className="flex h-full w-12 shrink-0 cursor-pointer items-center justify-center rounded-l-md text-xl transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none sm:w-11 sm:text-lg"
      >
        {value || "📌"}
      </button>

      {open &&
        createPortal(
          <div
            className={["fixed inset-0 z-[60]", isSheet ? "bg-black/40" : ""].join(" ")}
            onClick={hide}
          >
            <div
              id={panelId}
              role="dialog"
              aria-label="Emoji picker"
              className={[
                "fixed flex flex-col overflow-hidden border border-border bg-popover text-popover-foreground shadow-lg",
                isSheet
                  ? "inset-x-0 rounded-t-2xl border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)]"
                  : "rounded-xl",
              ].join(" ")}
              style={
                isSheet
                  ? { bottom: `${keyboardInset}px`, height: `min(75dvh, ${PANEL_HEIGHT + 80}px)` }
                  : { top: `${position.top}px`, left: `${position.left}px`, width: `${PANEL_WIDTH}px`, height: `${PANEL_HEIGHT}px` }
              }
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key !== "Escape") return;
                event.stopPropagation();
                event.preventDefault();
                hide();
              }}
            >
              {isSheet && <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30" />}
              <div className="flex items-center gap-2 border-b border-border p-2">
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    scrollRef.current?.scrollTo({ top: 0 });
                  }}
                  type="search"
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

              {!searching && groups.length > 0 && (
                <div className="flex items-center justify-between border-b border-border px-1.5 py-1">
                  {groups.map((group) => (
                    <button
                      key={group.key}
                      type="button"
                      title={group.label}
                      onClick={() => jumpTo(group.key)}
                      className={[
                        "flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-sm transition touch:h-10 touch:w-auto touch:flex-1",
                        activeGroup === group.key
                          ? "bg-accent"
                          : "opacity-60 hover:bg-accent/60 hover:opacity-100",
                      ].join(" ")}
                    >
                      {group.icon}
                    </button>
                  ))}
                </div>
              )}

              <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-2 pb-2" onScroll={syncActiveGroup}>
                {loading && <p className="py-10 text-center text-xs text-muted-foreground">Loading emoji…</p>}
                {loadFailed && (
                  <p className="py-10 text-center text-xs text-muted-foreground">
                    Couldn't load the emoji. Close this and try again.
                  </p>
                )}

                {!loading && searching && (
                  <>
                    {results.length === 0 ? (
                      <p className="py-10 text-center text-xs text-muted-foreground">
                        No emoji found for “{query.trim()}”
                      </p>
                    ) : (
                      <div className="grid grid-cols-8 pt-2">
                        <EmojiGrid emojis={results} onChoose={choose} onHover={setHovered} />
                      </div>
                    )}
                  </>
                )}

                {!loading && !searching && (
                  <>
                    {recent.length > 0 && (
                      <section>
                        <h3 className="sticky top-0 bg-popover py-1.5 text-[11px] font-medium text-muted-foreground">
                          Recent
                        </h3>
                        <div className="grid grid-cols-8">
                          {recent.map((char) => (
                            <button
                              key={char}
                              type="button"
                              onClick={() => choose(char)}
                              className={EMOJI_BUTTON_CLASS}
                            >
                              {char}
                            </button>
                          ))}
                        </div>
                      </section>
                    )}
                    {groups.map((group) => (
                      <section key={group.key} data-group={group.key}>
                        <h3 className="sticky top-0 bg-popover py-1.5 text-[11px] font-medium text-muted-foreground">
                          {group.label}
                        </h3>
                        <div className="grid grid-cols-8">
                          <EmojiGrid emojis={group.emojis} onChoose={choose} onHover={setHovered} />
                        </div>
                      </section>
                    ))}
                  </>
                )}
              </div>

              {!isSheet && (
                <div className="flex h-8 shrink-0 items-center gap-2 border-t border-border px-3 text-xs text-muted-foreground">
                  {hovered ? (
                    <>
                      <span className="text-base">{hovered.char}</span>
                      <span className="truncate">{hovered.label}</span>
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

