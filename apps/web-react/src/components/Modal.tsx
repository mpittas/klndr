import { X } from "lucide-react";
import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { lockScroll, unlockScroll } from "@/hooks/useScrollLock";

/**
 * A bottom sheet on phones and a centred dialog from `sm` (or, with `side`, a drawer that slides in from the
 * left edge and leaves the page in view, like Notion's side peek), with a focus trap, a shared Escape stack, a
 * scroll lock and swipe-to-dismiss.
 *
 * Put `data-autofocus` on the field that should take focus when the dialog opens. It is honoured on
 * devices with a real pointer only, so a phone's keyboard does not cover half the sheet.
 */

// Shared by every open Modal, so only the top-most one reacts to Escape.
const openStack: symbol[] = [];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keeps a node mounted for `ms` after it closes, so the leave animation can play. `mounted` is already
 * true in the render where `open` becomes true, so the dialog's ref exists by the time effects run.
 */
function usePresence(open: boolean, ms = 220) {
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);

  // Adjusting state while rendering (not in an effect) keeps `mounted` in step with `open`.
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (open) {
      // A frame late, so the closed styles are in place and the transition actually runs.
      const frame = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(frame);
    }
    const timer = window.setTimeout(() => {
      setEntered(false);
      setMounted(false);
    }, ms);
    return () => window.clearTimeout(timer);
  }, [open, ms]);

  return { mounted: open || mounted, state: open && entered ? "open" : "closed" } as const;
}

export type ModalProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  wide?: boolean;
  lg?: boolean;
  /** Content runs edge to edge (no padding) and brings its own height, e.g. notes or a list with a pinned footer. */
  flush?: boolean;
  /**
   * From `sm`, open as a full-height drawer on the left instead of a centred dialog. It can change while the
   * dialog is open: the panel moves over and nothing inside it is lost. Phones always get the bottom sheet.
   */
  side?: boolean;
  /** Small controls shown beside the close button (e.g. a switch between the dialog and the drawer). */
  actions?: ReactNode;
  /**
   * A slim toolbar header instead of the big title: `title` becomes a small label on the left, the actions and the
   * close button sit on the right, and the content (which brings its own headline) starts right under it.
   */
  compactHeader?: boolean;
  onClose: () => void;
  /** A click on the dimmed area outside the dialog. Defaults to `onClose`; a form can save here instead. */
  onBackdropClick?: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export function Modal({
  open,
  title,
  subtitle,
  wide,
  lg,
  flush,
  side = false,
  actions,
  compactHeader,
  onClose,
  onBackdropClick,
  children,
  footer,
}: ModalProps) {
  const [token] = useState(() => Symbol("modal"));
  const titleId = `modal-title-${useId()}`;
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);

  const { mounted, state } = usePresence(open);

  // A hairline under the header once the content has scrolled beneath it.
  const [scrolled, setScrolled] = useState(false);
  const [openedAt, setOpenedAt] = useState(open);
  if (open !== openedAt) {
    setOpenedAt(open);
    if (open) setScrolled(false);
  }

  // Switching between the dialog and the drawer while open: the panel arrives in its new place with a short
  // settle, instead of jumping there.
  const previousSide = useRef(side);
  useEffect(() => {
    if (previousSide.current === side) return;
    previousSide.current = side;
    const panel = dialogRef.current;
    if (!open || !panel) return;
    if (!window.matchMedia("(min-width: 640px)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    panel.animate(
      side
        ? [
            { opacity: 0, transform: "translateX(-28px)" },
            { opacity: 1, transform: "none" },
          ]
        : [
            { opacity: 0, transform: "scale(0.97)" },
            { opacity: 1, transform: "none" },
          ],
      { duration: 240, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" },
    );
  }, [side, open]);

  // Callers pass inline handlers. Reading the latest one through an Effect Event keeps the effect below
  // from re-running (and handing focus back and forth) every time the parent renders.
  const requestClose = useEffectEvent(onClose);

  useEffect(() => {
    if (!open) return;

    openStack.push(token);
    lockScroll();
    returnFocusTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && openStack[openStack.length - 1] === token) requestClose();
    };
    window.addEventListener("keydown", onKeydown);

    const dialog = dialogRef.current;
    if (dialog && !dialog.contains(document.activeElement)) {
      // Never auto-focus a field on touch: it would raise the keyboard over half the sheet.
      const wantsField = window.matchMedia("(hover: hover)").matches;
      if (wantsField) dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
      if (!dialog.contains(document.activeElement)) dialog.focus({ preventScroll: true });
    }

    return () => {
      const index = openStack.indexOf(token);
      if (index !== -1) openStack.splice(index, 1);
      unlockScroll();
      window.removeEventListener("keydown", onKeydown);
      if (returnFocusTo.current?.isConnected) returnFocusTo.current.focus({ preventScroll: true });
      returnFocusTo.current = null;
    };
  }, [open, token]);

  /** Keeps Tab inside the dialog. Listens on the dialog itself, so popovers teleported out of it are unaffected. */
  const trapTab = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!items.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === dialog)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  // Swipe down on the grab handle / header to dismiss (phones only: the handle is hidden from `sm`).
  const dragStart = useRef<{ y: number; time: number } | null>(null);
  const [dragY, setDragY] = useState(0);

  const onSheetPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" || (event.target as HTMLElement).closest("button")) return;
    dragStart.current = { y: event.clientY, time: event.timeStamp };
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      /* the pointer is already gone; the gesture just won't be captured */
    }
  };

  const onSheetPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    setDragY(Math.max(0, event.clientY - dragStart.current.y));
  };

  const onSheetPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    const distance = Math.max(0, event.clientY - dragStart.current.y);
    const velocity = distance / Math.max(1, event.timeStamp - dragStart.current.time); // px per ms
    dragStart.current = null;
    setDragY(0);
    if (distance > 120 || (distance > 40 && velocity > 0.6)) onClose();
  };

  if (!mounted) return null;

  const closeButton = (
    <button
      type="button"
      className="btn btn-soft btn-icon h-10 rounded-full text-muted-foreground hover:text-foreground sm:h-8"
      aria-label="Close"
      onClick={onClose}
    >
      <X className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden="true" />
    </button>
  );

  return createPortal(
    // In <body>, so a modal opened from inside another one is a sibling, not a descendant (focus trap, stacking).
    <div
      data-state={state}
      className={[
        "fixed inset-0 z-50 flex items-end justify-center bg-[var(--scrim)] backdrop-blur-[3px] transition-[opacity,background-color] duration-200",
        // The drawer leaves the page readable: a lighter veil, no blur.
        side
          ? "modal-side sm:items-stretch sm:justify-start sm:bg-[color-mix(in_oklab,var(--scrim)_40%,transparent)] sm:p-2 sm:backdrop-blur-none sm:dark:bg-black/40"
          : "sm:items-center sm:p-6",
      ].join(" ")}
    >
      <div aria-hidden="true" className="modal-overlay absolute inset-0" onClick={onBackdropClick ?? onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: "none" } : undefined}
        className={[
          "modal-panel relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-border/70 bg-background shadow-xl focus:outline-none dark:shadow-[0_28px_70px_-18px_rgb(0_0_0/0.75)] sm:rounded-2xl",
          side
            ? "sm:h-full sm:max-h-full sm:max-w-[34rem] sm:shadow-[0_0_0_1px_rgb(var(--shade)/0.03),24px_0_60px_-24px_rgb(var(--shade)/0.35)]"
            : ["sm:max-h-[88dvh]", wide ? "sm:max-w-2xl" : lg ? "sm:max-w-xl" : "sm:max-w-md"].join(" "),
          dragY ? "" : "transition-transform duration-200",
        ].join(" ")}
        onKeyDown={trapTab}
      >
        {/* Grab handle + header double as the swipe-to-dismiss area */}
        <div
          className="relative shrink-0 touch-none"
          onPointerDown={onSheetPointerDown}
          onPointerMove={onSheetPointerMove}
          onPointerUp={onSheetPointerUp}
          onPointerCancel={onSheetPointerUp}
        >
          <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-foreground/15 sm:hidden" />
          {compactHeader ? (
            <header
              className={[
                "flex items-center justify-between gap-3 border-b py-2.5 pl-5 pr-3 transition-colors duration-150 sm:py-3 sm:pl-7 sm:pr-4",
                scrolled ? "border-border/80" : "border-transparent",
              ].join(" ")}
            >
              <h2 id={titleId} className="min-w-0 truncate text-[13px] font-medium text-muted-foreground">
                {title}
              </h2>
              <div className="flex shrink-0 items-center gap-1.5">
                {actions}
                {closeButton}
              </div>
            </header>
          ) : (
            <header
              className={[
                "flex items-start justify-between gap-3 border-b py-3 pl-5 pr-3 transition-colors duration-150 sm:px-7 sm:pb-3 sm:pt-5",
                scrolled ? "border-border/80" : "border-transparent",
              ].join(" ")}
            >
              <div className="min-w-0 self-center">
                <h2 id={titleId} className="text-lg font-semibold leading-tight tracking-[-0.02em] text-foreground">
                  {title}
                </h2>
                {subtitle ? <p className="mt-1 text-[13px] leading-snug tabular-nums text-muted-foreground">{subtitle}</p> : null}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {actions}
                {closeButton}
              </div>
            </header>
          )}
        </div>
        <div
          className={[
            "relative min-h-0 flex-1 overscroll-contain",
            flush
              ? "flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]"
              : compactHeader
                ? "overflow-y-auto px-5 pb-4 pt-2 sm:px-7 sm:pb-5 sm:pt-3"
                : "overflow-y-auto px-5 py-3 sm:px-7 sm:py-4",
            !flush && !footer ? "pb-[max(1rem,env(safe-area-inset-bottom))]" : "",
          ].join(" ")}
          onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 2)}
        >
          {children}
        </div>

        {/* Pinned below the scrolling body so the primary action never scrolls out of reach */}
        {footer ? (
          <div className="relative shrink-0 border-t border-border/70 bg-muted/50 px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-7 sm:pb-4 sm:pt-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
