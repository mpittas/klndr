import { Check, Moon, Palette, Sun } from "lucide-react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { ThemeSwatch } from "@/components/ThemeSwatch";
import { THEME_GROUPS, useTheme, type ThemePreference } from "@/theme";

/** The least space left between the menu and the edge of the screen. */
const EDGE = 8;

const ROW_SELECTOR = "[role=menuitemradio]";
const focusClass = "outline-none focus:bg-accent";

/** The mouse and the keyboard share one highlight: the row under the mouse takes the focus. */
const followPointer = (event: ReactPointerEvent<HTMLElement>) => {
  if (event.pointerType !== "mouse") return;
  if (document.activeElement !== event.currentTarget) event.currentTarget.focus({ preventScroll: true });
};

/**
 * The row above or below `from` that sits nearest the same column: the next row of the grid, whatever its height.
 * Nothing there means the end was reached, so the caller wraps around.
 */
const nextInColumn = (items: HTMLElement[], from: HTMLElement, direction: 1 | -1) => {
  const origin = from.getBoundingClientRect();
  // From the full-width "Match device" row, down goes to the first column rather than the middle one.
  const x = origin.width > 160 ? origin.left : origin.left + origin.width / 2;
  const y = origin.top + origin.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const item of items) {
    const rect = item.getBoundingClientRect();
    const down = (rect.top + rect.height / 2 - y) * direction;
    if (down < 4) continue;
    const score = down * 1000 + Math.abs(rect.left + rect.width / 2 - x);
    if (score < bestScore) {
      best = item;
      bestScore = score;
    }
  }
  return best;
};

/**
 * The header's theme button and the menu it opens: "Match device" on top, then the light themes and the dark ones,
 * each drawn as a small planner in its own colors, the one in use outlined and ticked. Behaves like the account
 * menu: arrows, Home/End, Escape, and a press anywhere else close or move it; opened from the keyboard, the chosen
 * theme has the focus. The grid is walked in two dimensions: left and right along a row, up and down a column.
 *
 * `triggerClassName` styles the button (the app header and the landing page's bar each have their own look),
 * `iconClassName` its icon.
 */
export function ThemeMenu({
  triggerClassName,
  iconClassName = "",
}: {
  triggerClassName: string;
  iconClassName?: string;
}) {
  const { preference, setPreference } = useTheme();

  const [open, setOpen] = useState(false);
  /** How far the menu is moved right so it stays on screen: the bar that holds the button can be narrow. */
  const [shift, setShift] = useState(0);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  /** Where the focus goes when the menu opens: the chosen theme from the keyboard, the menu itself on a click. */
  const focusOnOpen = useRef<"choice" | "menu">("menu");

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus({ preventScroll: true });
  };

  const choose = (next: ThemePreference) => {
    setPreference(next);
    close();
  };

  // A press anywhere else closes it.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Keep the menu on screen. `offsetWidth` ignores the zoom-in animation, which `getBoundingClientRect` would not.
  useLayoutEffect(() => {
    if (!open) return;
    const panel = menuRef.current;
    const root = rootRef.current;
    if (!panel || !root) return;
    const right = root.getBoundingClientRect().right;
    const left = right - panel.offsetWidth;
    const viewport = document.documentElement.clientWidth;
    let next = 0;
    if (left < EDGE) next = EDGE - left;
    if (right + next > viewport - EDGE) next = viewport - EDGE - right;
    setShift(next);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const panel = menuRef.current;
    if (focusOnOpen.current === "choice") {
      (panel?.querySelector<HTMLElement>("[aria-checked=true]") ?? panel?.querySelector<HTMLElement>(ROW_SELECTOR))?.focus();
    } else {
      panel?.focus({ preventScroll: true });
    }
  }, [open]);

  const onTriggerKeydown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    focusOnOpen.current = "choice";
    setOpen(true);
  };

  const onMenuKeydown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "Tab") {
      close(false);
      return;
    }
    const keys = ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();

    const rows = [...(menuRef.current?.querySelectorAll<HTMLElement>(ROW_SELECTOR) ?? [])];
    const current = document.activeElement as HTMLElement;
    const index = rows.indexOf(current);
    const last = rows.length - 1;
    let next: HTMLElement | undefined;
    switch (event.key) {
      case "Home":
        next = rows[0];
        break;
      case "End":
        next = rows[last];
        break;
      case "ArrowRight":
        next = rows[index === last ? 0 : index + 1];
        break;
      case "ArrowLeft":
        next = rows[index <= 0 ? last : index - 1];
        break;
      default: {
        const down = event.key === "ArrowDown";
        next = index < 0 ? rows[down ? 0 : last] : (nextInColumn(rows, current, down ? 1 : -1) ?? rows[down ? 0 : last]);
      }
    }
    next?.focus();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label="Theme"
        title="Theme"
        data-active={open}
        className={[triggerClassName, "data-[active=true]:bg-foreground/[0.055] data-[active=true]:text-foreground"].join(" ")}
        onClick={(event) => {
          // A click with no pointer (Enter or Space on the button) counts as the keyboard.
          focusOnOpen.current = event.detail === 0 ? "choice" : "menu";
          setOpen((value) => !value);
        }}
        onKeyDown={onTriggerKeydown}
      >
        <Palette className={iconClassName} aria-hidden="true" />
      </button>

      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          tabIndex={-1}
          aria-label="Theme"
          style={{ right: -shift }}
          className="menu absolute top-full z-50 mt-2 max-h-[calc(100dvh-6rem)] w-[19.5rem] max-w-[calc(100vw-1rem)] origin-top-right overflow-y-auto overscroll-contain outline-none animate-in fade-in-0 zoom-in-95 duration-150"
          onKeyDown={onMenuKeydown}
        >
          {/* Follow the device: whichever of Light or Dark it is set to */}
          <button
            type="button"
            role="menuitemradio"
            aria-checked={preference === "system"}
            className={["flex w-full cursor-pointer select-none items-center gap-3 rounded-lg p-1.5 text-left touch:min-h-11", focusClass].join(" ")}
            onPointerMove={followPointer}
            onClick={() => choose("system")}
          >
            <ThemeSwatch name="system" size="sm" selected={preference === "system"} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-foreground">Match device</span>
              <span className="block truncate text-xs text-muted-foreground">Light or dark, like your device</span>
            </span>
            <Check className={["mr-1 h-4 w-4 shrink-0 text-foreground", preference === "system" ? "" : "invisible"].join(" ")} aria-hidden="true" />
          </button>

          {THEME_GROUPS.map((group) => (
            <div key={group.scheme} role="group" aria-label={`${group.label} themes`}>
              <div className="menu-label mt-1" aria-hidden="true">
                {group.scheme === "light" ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
                {group.label}
              </div>
              <div className="grid grid-cols-3 gap-0.5">
                {group.options.map((option) => {
                  const checked = preference === option.name;
                  return (
                    <button
                      key={option.name}
                      type="button"
                      role="menuitemradio"
                      aria-checked={checked}
                      title={`${option.label} · ${option.description}`}
                      className={["flex min-w-0 cursor-pointer select-none flex-col gap-1.5 rounded-lg p-1.5 text-left", focusClass].join(" ")}
                      onPointerMove={followPointer}
                      onClick={() => choose(option.name)}
                    >
                      <span className="relative block">
                        <ThemeSwatch name={option.name} size="tile" selected={checked} />
                        {checked ? (
                          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                            <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden="true" />
                          </span>
                        ) : null}
                      </span>
                      <span className={["truncate px-0.5 text-xs text-foreground", checked ? "font-semibold" : "font-medium"].join(" ")}>
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
