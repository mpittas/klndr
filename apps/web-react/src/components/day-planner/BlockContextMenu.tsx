import {
  DAY_MINUTES,
  DURATION_CHOICES,
  formatDuration,
  formatTime,
  sortCategoriesByName,
  type ScheduledTask,
} from "@klndr/core";
import { useCategories } from "@klndr/data";
import {
  CalendarArrowDown,
  CalendarPlus,
  Check,
  ChevronRight,
  CircleCheck,
  CircleDashed,
  Copy,
  Hourglass,
  Pencil,
  Play,
  Scissors,
  Tag,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { CategoryMark } from "@/components/category/CategoryMark";

const EDGE = 8;
/** The space between the menu and a submenu open beside it. */
const GAP = 0;
/** A submenu's padding, so its first row lines up with the row that opened it. */
const SUB_INSET = 4;
/** How long the pointer can cross other rows on its way into an open submenu before the submenu changes. */
const SUB_DELAY = 150;
/** The shortest a block can be split into two halves. */
const MIN_SPLIT = 30;

/**
 * Where the menu was asked for, and the block it is about. `origin` gets the focus back when it closes;
 * `keyboard` is set when it was opened from the keyboard, so its first row takes the focus.
 */
export type BlockMenuTarget = {
  task: ScheduledTask;
  x: number;
  y: number;
  origin: HTMLElement | null;
  keyboard?: boolean;
};

/** What the menu can do to a block. Every one is the planner's own; the menu only asks. */
export type BlockMenuActions = {
  edit: (task: ScheduledTask) => void;
  toggleComplete: (task: ScheduledTask) => void;
  /** A copy straight after the block. */
  duplicate: (task: ScheduledTask) => void;
  /** A copy at the same time, `days` from the block's day. */
  copyToDay: (task: ScheduledTask, days: number) => void;
  moveToDay: (task: ScheduledTask, days: number) => void;
  /** Starts the block at the current time. Only offered on today. */
  startNow: (task: ScheduledTask) => void;
  split: (task: ScheduledTask) => void;
  resize: (task: ScheduledTask, minutes: number) => void;
  setCategory: (task: ScheduledTask, category: string) => void;
  remove: (task: ScheduledTask) => void;
};

type Sub = "duration" | "category";
type Placement = { top: number; left: number; origin: string };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

// `transition-none`: `duration-100` (for the zoom-in) also sets a transition on every property, so a panel
// measured at top/left 0 would slide to its place instead of opening there.
const panelClass =
  "menu fixed transition-none flex max-h-[calc(100dvh-16px)] flex-col overflow-y-auto overscroll-contain outline-none";
const rowClass =
  "flex h-8 w-full shrink-0 cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] outline-none touch:h-11";
const toneClass = "text-foreground focus:bg-accent aria-expanded:bg-accent";
const dangerClass = "text-destructive focus:bg-destructive/10";
const iconClass = "h-4 w-4 shrink-0";
const hintClass = "max-w-20 shrink-0 truncate text-xs tabular-nums text-muted-foreground";

/** Placed once measured; until then it is laid out, so it can be measured, but not seen or hit. */
const placedStyle = (placement: Placement | null): CSSProperties =>
  placement
    ? { top: placement.top, left: placement.left, transformOrigin: placement.origin }
    : { top: 0, left: 0, opacity: 0, pointerEvents: "none" };

/** The mouse and the keyboard share one highlight: the row under the mouse takes the focus. */
const followPointer = (event: ReactPointerEvent<HTMLElement>) => {
  if (event.pointerType !== "mouse") return false;
  if (document.activeElement !== event.currentTarget) event.currentTarget.focus({ preventScroll: true });
  return true;
};

/** A submenu opened from the keyboard hands the focus to its checked row, or its first. */
const focusChoice = (flyout: HTMLElement | null) =>
  (
    flyout?.querySelector<HTMLElement>("[aria-checked=true]") ??
    flyout?.querySelector<HTMLElement>("[role=menuitemradio]")
  )?.focus();

const keepInside = (event: ReactMouseEvent) => event.stopPropagation();
const noBrowserMenu = (event: ReactMouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
};

function Item({
  icon: Icon,
  label,
  danger,
  onHover,
  onSelect,
}: {
  icon: LucideIcon;
  label: string;
  danger?: boolean;
  onHover: () => void;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={[rowClass, danger ? dangerClass : toneClass].join(" ")}
      onPointerMove={(event) => {
        if (followPointer(event)) onHover();
      }}
      onClick={onSelect}
    >
      <Icon className={[iconClass, danger ? "" : "text-muted-foreground"].join(" ")} strokeWidth={1.75} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}

const Separator = () => <div role="separator" className="-mx-1 my-1 h-px shrink-0 bg-border/80" />;

/**
 * The menu a right click (or the context-menu key) opens on a timeline block: everything that can be done to
 * it without opening the editor. A small popover at the pointer, kept inside the window; Duration and Category
 * open beside it, on whichever side has room.
 *
 * It only asks: `actions` are the planner's, so the menu never decides what a move or a copy means.
 */
export function BlockContextMenu({
  target,
  isToday,
  nowStart,
  actions,
  onClose,
}: {
  target: BlockMenuTarget | null;
  isToday: boolean;
  /** The start "Start now" gives a block (the clock, snapped), or null when it is not today. */
  nowStart: number | null;
  actions: BlockMenuActions;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const subRef = useRef<HTMLDivElement | null>(null);
  const triggers = useRef<Record<Sub, HTMLButtonElement | null>>({ duration: null, category: null });
  const timer = useRef<number | undefined>(undefined);
  /** Set when a submenu was opened from the keyboard, so its first row takes the focus once it is placed. */
  const focusSub = useRef(false);

  const [sub, setSub] = useState<Sub | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [subPlacement, setSubPlacement] = useState<(Placement & { sub: Sub }) | null>(null);
  const categoriesQuery = useCategories();
  const categories = useMemo(() => sortCategoriesByName(categoriesQuery.data ?? []), [categoriesQuery.data]);

  const task = target?.task ?? null;
  const targetKey = target ? `${target.task.id}:${target.x}:${target.y}` : null;
  const keyboard = target?.keyboard ?? false;

  const close = useCallback(
    (returnFocus = false) => {
      if (returnFocus) target?.origin?.focus({ preventScroll: true });
      onClose();
    },
    [onClose, target],
  );

  // A new menu starts with no submenu open, and unplaced until it has been measured.
  const [shownFor, setShownFor] = useState<string | null>(null);
  if (shownFor !== targetKey) {
    setShownFor(targetKey);
    setSub(null);
    setPlacement(null);
    setSubPlacement(null);
  }

  // At the pointer, flipped up or to the left when it would run off the window. Measured before paint with
  // offsetWidth/offsetHeight: the panel's real size, not the smaller one its zoom-in is passing through.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!target || !panel) return;
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    const flipX = target.x + width + EDGE > window.innerWidth;
    const flipY = target.y + height + EDGE > window.innerHeight;
    setPlacement({
      left: clamp(flipX ? target.x - width : target.x, EDGE, window.innerWidth - width - EDGE),
      top: clamp(flipY ? target.y - height : target.y, EDGE, window.innerHeight - height - EDGE),
      origin: `${flipY ? "bottom" : "top"} ${flipX ? "right" : "left"}`,
    });
  }, [target]);

  // A submenu sits beside the row that opened it: to the right, or to the left when only that side has room.
  // In a window too narrow for either it overlaps the menu rather than leave it.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const flyout = subRef.current;
    const trigger = sub ? triggers.current[sub] : null;
    if (!sub || !placement || !panel || !flyout || !trigger) return;
    const width = flyout.offsetWidth;
    const height = flyout.offsetHeight;
    const panelRect = panel.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    const right = panelRect.right + GAP;
    const left = panelRect.left - width - GAP;
    const toLeft = right + width + EDGE > window.innerWidth && left >= EDGE;
    setSubPlacement({
      sub,
      left: clamp(toLeft ? left : right, EDGE, window.innerWidth - width - EDGE),
      top: clamp(triggerRect.top - SUB_INSET, EDGE, window.innerHeight - height - EDGE),
      origin: `top ${toLeft ? "right" : "left"}`,
    });
  }, [sub, placement]);

  // Moves with the page or the window, so it closes rather than hang where the block no longer is. Scrolling
  // the menu's own list is not the page moving.
  useEffect(() => {
    if (!target) return;
    const dismiss = (event: Event) => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return;
      onClose();
    };
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, { capture: true, passive: true });
    return () => {
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, { capture: true });
    };
  }, [target, onClose]);

  // Opened from the keyboard, the first row takes the focus so Enter works straight away. From the mouse the
  // menu itself does, so nothing is lit until the pointer is over a row; the arrow keys still work.
  useEffect(() => {
    if (!targetKey) return;
    const panel = panelRef.current;
    const first = keyboard ? panel?.querySelector<HTMLElement>("[role=menuitem]") : null;
    (first ?? panel)?.focus({ preventScroll: true });
  }, [targetKey, keyboard]);

  useEffect(() => {
    if (!subPlacement || !focusSub.current) return;
    focusSub.current = false;
    focusChoice(subRef.current);
  }, [subPlacement]);

  // A pending submenu change belongs to the menu it was made in.
  useEffect(() => () => window.clearTimeout(timer.current), [targetKey]);

  if (!target || !task) return null;

  const run = (action: () => void) => {
    try {
      action();
    } finally {
      close();
    }
  };

  const openSub = (name: Sub, focusFirst: boolean) => {
    window.clearTimeout(timer.current);
    if (name === sub && placedSub) {
      if (focusFirst) focusChoice(subRef.current);
      return;
    }
    focusSub.current = focusFirst;
    setSub(name);
  };

  const closeSub = (focusTrigger: boolean) => {
    window.clearTimeout(timer.current);
    if (focusTrigger && sub) triggers.current[sub]?.focus();
    setSub(null);
  };

  // The pointer over a row: a submenu's row opens it, any other row closes the open one. While one is open
  // the change waits a moment, so the pointer can cut across other rows on its way into it.
  const hoverRow = (next: Sub | null) => {
    window.clearTimeout(timer.current);
    if (next === sub) return;
    if (sub === null) setSub(next);
    else timer.current = window.setTimeout(() => setSub(next), SUB_DELAY);
  };

  // The pointer leaving a panel unlights its row, except the row whose submenu is open.
  const unlight = (panel: HTMLDivElement | null, event: ReactPointerEvent) => {
    if (event.pointerType !== "mouse" || !panel?.contains(document.activeElement)) return;
    if (sub && document.activeElement === triggers.current[sub]) return;
    panel.focus({ preventScroll: true });
  };

  const durationLeft = DAY_MINUTES - task.startMinutes;
  const durations = DURATION_CHOICES.filter((minutes) => minutes <= durationLeft);
  const canSplit = task.durationMinutes >= MIN_SPLIT;
  const placedSub = subPlacement?.sub === sub ? subPlacement : null;

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const inSub = !!subRef.current?.contains(event.target as Node);
    if (event.key === "Escape" || (inSub && event.key === "ArrowLeft")) {
      event.preventDefault();
      event.stopPropagation();
      if (sub) closeSub(true);
      else close(true);
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      close(true);
      return;
    }
    const opens = (document.activeElement as HTMLElement | null)?.dataset.sub as Sub | undefined;
    if (!inSub && opens && event.key === "ArrowRight") {
      event.preventDefault();
      openSub(opens, true);
      return;
    }
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    if (!inSub && sub) closeSub(false);
    const list = inSub ? subRef.current : panelRef.current;
    const items = [...(list?.querySelectorAll<HTMLElement>("[role=menuitem], [role=menuitemradio]") ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : index < 0
            ? event.key === "ArrowDown"
              ? 0
              : items.length - 1
            : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  };

  const subTrigger = (name: Sub, icon: LucideIcon, label: string, hint: string) => {
    const Icon = icon;
    return (
      <button
        ref={(node) => {
          triggers.current[name] = node;
        }}
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={sub === name}
        data-sub={name}
        className={[rowClass, toneClass].join(" ")}
        onPointerMove={(event) => {
          if (followPointer(event)) hoverRow(name);
        }}
        onClick={(event) => openSub(name, event.detail === 0)}
      >
        <Icon className={[iconClass, "text-muted-foreground"].join(" ")} strokeWidth={1.75} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className={hintClass}>{hint}</span>
        <ChevronRight className="-mr-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
    );
  };

  const radio = (key: string, checked: boolean, onSelect: () => void, children: ReactNode) => (
    <button
      key={key}
      type="button"
      role="menuitemradio"
      aria-checked={checked}
      className={[rowClass, toneClass].join(" ")}
      onPointerMove={followPointer}
      onClick={() => run(() => (checked ? undefined : onSelect()))}
    >
      {children}
      <Check
        className={[iconClass, checked ? "" : "invisible"].join(" ")}
        strokeWidth={2.5}
        aria-hidden="true"
      />
    </button>
  );

  return createPortal(
    <div
      ref={rootRef}
      className="fixed inset-0 z-[60]"
      onClick={() => close()}
      onContextMenu={(event) => {
        // A second right click away from the menu closes it without opening the browser's own.
        event.preventDefault();
        close();
      }}
      onKeyDown={onKeyDown}
    >
      <div
        ref={panelRef}
        role="menu"
        tabIndex={-1}
        aria-label={`${task.title} actions`}
        className={[panelClass, "w-56", placement ? "animate-in fade-in-0 zoom-in-95 duration-100" : ""].join(" ")}
        style={placedStyle(placement)}
        onClick={keepInside}
        onContextMenu={noBrowserMenu}
        onPointerLeave={(event) => unlight(panelRef.current, event)}
      >
        {/* Which block this is about, so a menu opened from the keyboard is never a guess */}
        <p className="menu-label" aria-hidden="true">
          {task.emoji ? <span className="shrink-0 leading-none">{task.emoji}</span> : null}
          <span className="min-w-0 truncate">{task.title}</span>
        </p>

        <Item icon={Pencil} label="Edit…" onHover={() => hoverRow(null)} onSelect={() => run(() => actions.edit(task))} />
        <Item
          icon={task.completed ? CircleDashed : CircleCheck}
          label={task.completed ? "Mark as not done" : "Mark as done"}
          onHover={() => hoverRow(null)}
          onSelect={() => run(() => actions.toggleComplete(task))}
        />
        <Item icon={Copy} label="Duplicate" onHover={() => hoverRow(null)} onSelect={() => run(() => actions.duplicate(task))} />
        {canSplit ? (
          <Item
            icon={Scissors}
            label="Split in half"
            onHover={() => hoverRow(null)}
            onSelect={() => run(() => actions.split(task))}
          />
        ) : null}

        <Separator />

        {subTrigger("duration", Hourglass, "Duration", formatDuration(task.durationMinutes))}
        {subTrigger("category", Tag, "Category", task.category)}

        <Separator />

        {isToday && nowStart !== null && nowStart !== task.startMinutes ? (
          <Item icon={Play} label="Start now" onHover={() => hoverRow(null)} onSelect={() => run(() => actions.startNow(task))} />
        ) : null}
        <Item
          icon={CalendarArrowDown}
          label="Move to tomorrow"
          onHover={() => hoverRow(null)}
          onSelect={() => run(() => actions.moveToDay(task, 1))}
        />
        <Item
          icon={CalendarPlus}
          label="Repeat tomorrow"
          onHover={() => hoverRow(null)}
          onSelect={() => run(() => actions.copyToDay(task, 1))}
        />

        <Separator />

        <Item icon={Trash2} label="Delete" danger onHover={() => hoverRow(null)} onSelect={() => run(() => actions.remove(task))} />
      </div>

      {sub ? (
        <div
          key={sub}
          ref={subRef}
          role="menu"
          tabIndex={-1}
          aria-label={sub === "duration" ? "Duration" : "Category"}
          className={[panelClass, sub === "duration" ? "w-44" : "max-h-[min(20rem,calc(100dvh-16px))] w-48", placedSub ? "animate-in fade-in-0 zoom-in-95 duration-100" : ""].join(" ")}
          style={placedStyle(placedSub)}
          onClick={keepInside}
          onContextMenu={noBrowserMenu}
          onPointerEnter={() => window.clearTimeout(timer.current)}
          onPointerLeave={(event) => unlight(subRef.current, event)}
        >
          {sub === "duration"
            ? durations.map((minutes) =>
                radio(
                  String(minutes),
                  minutes === task.durationMinutes,
                  () => actions.resize(task, minutes),
                  <>
                    <span className="min-w-0 flex-1 truncate tabular-nums">{formatDuration(minutes)}</span>
                    <span className={hintClass}>{formatTime(task.startMinutes + minutes)}</span>
                  </>,
                ),
              )
            : categories.map((category) =>
                radio(
                  category.name,
                  category.name === task.category,
                  () => actions.setCategory(task, category.name),
                  <>
                    <span className="flex w-5 shrink-0 justify-center" aria-hidden="true">
                      <CategoryMark emoji={category.emoji} color={category.color} size="sm" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{category.name}</span>
                  </>,
                ),
              )}
          {sub === "category" && !categories.length ? (
            <p className="px-2.5 py-3 text-center text-xs text-muted-foreground">No categories yet</p>
          ) : null}
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
