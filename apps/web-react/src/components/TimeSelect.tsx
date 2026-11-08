import { Check } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { useMediaQuery } from "@/hooks/useViewport";

export type TimeOption = {
  /** Minutes from midnight (or any number the caller picks by). */
  value: number;
  label: string;
  /** Shown on the right of the row, e.g. the length a choice of end time gives. */
  hint?: string;
  /** Draws the hint in the brand color (the slot that holds "now"). */
  accent?: boolean;
};

const PANEL_WIDTH = 208;
const PANEL_MAX_HEIGHT = 300;
const GAP = 6;
/** Phones get a bottom sheet instead of a popover anchored to the trigger. */
const SHEET_QUERY = "(max-width: 639px)";

/**
 * A time chosen from a list of slots: the trigger is whatever the caller draws (a big "11:30 AM" in the block
 * editor), the list is a popover on a pointer device and a bottom sheet on a phone. The list opens scrolled to
 * the current choice. On the closed trigger, ↑ and ↓ step to the previous or next slot without opening it.
 */
export function TimeSelect({
  value,
  options,
  onChange,
  label,
  align = "start",
  className,
  children,
}: {
  value: number;
  options: TimeOption[];
  onChange: (next: number) => void;
  /** What is being chosen ("Start time"); the sheet's title and the trigger's accessible name. */
  label: string;
  /** Which edge of the trigger the popover lines up with. */
  align?: "start" | "end";
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const isSheet = useMediaQuery(SHEET_QUERY);
  const [position, setPosition] = useState({ top: 0, left: 0, maxHeight: PANEL_MAX_HEIGHT });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const current = options.find((option) => option.value === value);

  /** Anchors the popover to the trigger, opening upwards when there is no room below. */
  const place = useCallback(() => {
    if (isSheet) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const below = window.innerHeight - rect.bottom - GAP - 8;
    const above = rect.top - GAP - 8;
    const openUp = below < 200 && above > below;
    const maxHeight = Math.min(PANEL_MAX_HEIGHT, openUp ? above : below);
    const preferred = align === "end" ? rect.right - PANEL_WIDTH : rect.left;
    setPosition({
      top: openUp ? rect.top - GAP - maxHeight : rect.bottom + GAP,
      left: Math.max(8, Math.min(preferred, window.innerWidth - PANEL_WIDTH - 8)),
      maxHeight,
    });
  }, [isSheet, align]);

  const hide = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, place]);

  // The choice in use takes the focus, in the middle of the list.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const active =
      panel?.querySelector<HTMLElement>('[aria-selected="true"]') ?? panel?.querySelector<HTMLElement>("[role=option]");
    active?.scrollIntoView({ block: "center" });
    active?.focus({ preventScroll: true });
  }, [open]);

  const show = () => {
    place();
    setOpen(true);
  };

  const choose = (next: number) => {
    onChange(next);
    hide();
  };

  const step = (direction: 1 | -1) => {
    const index = options.findIndex((option) => option.value === value);
    const next = options[index === -1 ? 0 : index + direction];
    if (next) onChange(next.value);
  };

  const onTriggerKeydown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.altKey && event.key === "ArrowDown") {
      event.preventDefault();
      show();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    step(event.key === "ArrowDown" ? 1 : -1);
  };

  const onListKeydown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" || event.key === "Tab") {
      // Kept from the dialog underneath, which would otherwise close too.
      event.stopPropagation();
      if (event.key === "Escape") event.preventDefault();
      hide();
      return;
    }
    const keys = ["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const items = [...(panelRef.current?.querySelectorAll<HTMLElement>("[role=option]") ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const target =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : index + ({ ArrowDown: 1, ArrowUp: -1, PageDown: 8, PageUp: -8 } as Record<string, number>)[event.key];
    const item = items[Math.max(0, Math.min(items.length - 1, target))];
    item?.focus();
    item?.scrollIntoView({ block: "nearest" });
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${current?.label ?? ""}`}
        title="Choose a time · ↑ ↓ to nudge"
        className={className}
        onClick={() => (open ? hide() : show())}
        onKeyDown={onTriggerKeydown}
      >
        {children}
      </button>

      {open
        ? createPortal(
            <div className={["fixed inset-0 z-[70]", isSheet ? "bg-[var(--scrim)]" : ""].join(" ")} onClick={hide}>
              <div
                ref={panelRef}
                className={[
                  "fixed flex flex-col overflow-hidden border border-border bg-popover text-popover-foreground shadow-xl",
                  isSheet
                    ? "inset-x-0 bottom-0 max-h-[60dvh] rounded-t-3xl border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] animate-in slide-in-from-bottom-8 fade-in-0 duration-200"
                    : "rounded-xl animate-in fade-in-0 zoom-in-95 duration-100",
                ].join(" ")}
                style={isSheet ? undefined : { top: position.top, left: position.left, width: PANEL_WIDTH, maxHeight: position.maxHeight }}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={onListKeydown}
              >
                {isSheet ? (
                  <div className="shrink-0 border-b border-border px-5 pb-3 pt-2.5">
                    <div className="mx-auto h-1.5 w-10 rounded-full bg-foreground/15" />
                    <p className="mt-2.5 text-[15px] font-semibold tracking-[-0.01em] text-foreground">{label}</p>
                  </div>
                ) : null}
                <div role="listbox" aria-label={label} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">
                  {options.map((option) => {
                    const selected = option.value === value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={[
                          "flex h-9 w-full shrink-0 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-left text-[13px] tabular-nums outline-none transition-colors hover:bg-accent focus-visible:bg-accent touch:h-12 touch:px-4 touch:text-[15px]",
                          selected ? "bg-accent/70 font-semibold text-foreground" : "text-foreground",
                        ].join(" ")}
                        onClick={() => choose(option.value)}
                      >
                        <span className="w-4 shrink-0">
                          {selected ? <Check className="h-3.5 w-3.5 text-foreground" strokeWidth={3} aria-hidden="true" /> : null}
                        </span>
                        <span className="min-w-0 flex-1">{option.label}</span>
                        {option.hint ? (
                          <span
                            className={[
                              "shrink-0 text-xs",
                              option.accent ? "font-semibold text-brand" : "font-normal text-muted-foreground",
                            ].join(" ")}
                          >
                            {option.hint}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
