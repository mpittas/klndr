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
 * A bottom sheet on phones and a centred dialog from `sm`, with a focus trap, a shared Escape stack, a
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
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export function Modal({ open, title, subtitle, wide, lg, flush, onClose, children, footer }: ModalProps) {
  const [token] = useState(() => Symbol("modal"));
  const titleId = `modal-title-${useId()}`;
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);

  const { mounted, state } = usePresence(open);

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

  return createPortal(
    // In <body>, so a modal opened from inside another one is a sibling, not a descendant (focus trap, stacking).
    <div
      data-state={state}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs sm:items-center sm:p-6"
    >
      <div aria-hidden="true" className="modal-overlay absolute inset-0" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: "none" } : undefined}
        className={[
          "modal-panel relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-background shadow-lg focus:outline-none sm:max-h-[88dvh] sm:rounded-xl",
          wide ? "sm:max-w-2xl" : lg ? "sm:max-w-xl" : "sm:max-w-md",
          dragY ? "" : "transition-transform duration-200",
        ].join(" ")}
        onKeyDown={trapTab}
      >
        {/* Grab handle + header double as the swipe-to-dismiss area */}
        <div
          className="shrink-0 touch-none"
          onPointerDown={onSheetPointerDown}
          onPointerMove={onSheetPointerMove}
          onPointerUp={onSheetPointerUp}
          onPointerCancel={onSheetPointerUp}
        >
          <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-muted-foreground/30 sm:hidden" />
          <header className="flex items-start justify-between gap-3 border-b border-border bg-background py-3 pl-4 pr-2 sm:px-6 sm:py-4">
            <div className="min-w-0 self-center">
              <h2 id={titleId} className="text-base font-semibold leading-tight tracking-tight text-foreground">
                {title}
              </h2>
              {subtitle ? <p className="mt-1 text-xs tabular-nums text-muted-foreground">{subtitle}</p> : null}
            </div>
            <button
              type="button"
              className="-my-0.5 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-accent-foreground sm:my-0 sm:-mr-2 sm:h-8 sm:w-8"
              aria-label="Close"
              onClick={onClose}
            >
              <X className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden="true" />
            </button>
          </header>
        </div>

        <div
          className={[
            "min-h-0 flex-1 overscroll-contain",
            flush
              ? "flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]"
              : "overflow-y-auto px-4 py-4 sm:px-6 sm:py-5",
            !flush && !footer ? "pb-[max(1rem,env(safe-area-inset-bottom))]" : "",
          ].join(" ")}
        >
          {children}
        </div>

        {/* Pinned below the scrolling body so the primary action never scrolls out of reach */}
        {footer ? (
          <div className="shrink-0 border-t border-border bg-background px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
