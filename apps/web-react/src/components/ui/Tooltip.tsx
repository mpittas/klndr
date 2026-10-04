import {
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useId,
  useMemo,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
} from "react";

/**
 * A small tooltip: the app needs exactly one kind of tip, a line of help over the checklist's "Every day /
 * This day only" buttons, so there is no tooltip library behind this.
 *
 * Hover and focus both open the tip, Escape and blur close it, and the trigger is linked to the tip with
 * `aria-describedby` so it is announced.
 */

type TooltipState = { open: boolean; setOpen: (next: boolean) => void; id: string };

const TooltipContext = createContext<TooltipState | null>(null);

const useTooltip = () => {
  const state = useContext(TooltipContext);
  if (!state) throw new Error("<Tooltip> parts must be used inside <Tooltip>.");
  return state;
};

export function Tooltip({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const state = useMemo(() => ({ open, setOpen, id }), [open, id]);

  return (
    <TooltipContext.Provider value={state}>
      <span className="relative flex" onPointerLeave={() => setOpen(false)} onBlur={() => setOpen(false)}>
        {children}
      </span>
    </TooltipContext.Provider>
  );
}

type TriggerProps = {
  "aria-describedby"?: string;
  onPointerEnter?: (event: PointerEvent<HTMLElement>) => void;
  onFocus?: (event: FocusEvent<HTMLElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
};

/** Wraps its one child (`asChild`) or a `<span>`, keeping any handlers the child already has. */
export function TooltipTrigger({ asChild, children }: { asChild?: boolean; children: ReactNode }) {
  const { setOpen, id } = useTooltip();

  const add = (existing: TriggerProps): TriggerProps => ({
    "aria-describedby": id,
    onPointerEnter: (event) => {
      existing.onPointerEnter?.(event);
      setOpen(true);
    },
    onFocus: (event) => {
      existing.onFocus?.(event);
      setOpen(true);
    },
    onKeyDown: (event) => {
      existing.onKeyDown?.(event);
      if (event.key === "Escape") setOpen(false);
    },
  });

  if (asChild && isValidElement<TriggerProps>(children)) {
    return cloneElement(children as ReactElement<TriggerProps>, add(children.props));
  }
  return <span {...add({})}>{children}</span>;
}

export function TooltipContent({
  side = "bottom",
  children,
}: {
  side?: "top" | "bottom";
  children: ReactNode;
}) {
  const { open, id } = useTooltip();
  if (!open) return null;
  return (
    <span
      id={id}
      role="tooltip"
      data-side={side}
      className={[
        "pointer-events-none absolute left-1/2 z-50 w-max max-w-56 -translate-x-1/2 text-balance rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground shadow-md",
        "animate-in fade-in-0 zoom-in-95",
        side === "top" ? "bottom-full mb-2 slide-in-from-bottom-2" : "top-full mt-2 slide-in-from-top-2",
      ].join(" ")}
    >
      {children}
      <span
        aria-hidden="true"
        className={[
          "absolute left-1/2 size-2.5 -translate-x-1/2 rotate-45 rounded-[2px] bg-primary",
          side === "top" ? "-bottom-1" : "-top-1",
        ].join(" ")}
      />
    </span>
  );
}
