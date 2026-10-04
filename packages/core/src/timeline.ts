import { columnsBeside, lanesFor, layoutDay, withLanes, type Placement } from "./layout";
import { floorMinutes, snapMinutes } from "./time";
import { SLOT_HEIGHT, SLOT_MINUTES, SNAP_MINUTES, type ScheduledTask } from "./types";

/**
 * The maths of the day timeline that does not depend on how it is drawn: minutes to pixels and back,
 * where a block sits, what a drag or a resize snaps to, which column a drag lands in and how fast the
 * edge of the screen scrolls. The web planner and the phone's timeline both call these,
 * so a block lands on the same minute everywhere. Pixels are measured from the top of the grid and
 * minutes from midnight; nothing here touches the DOM or a native view.
 *
 * The functions a drag or a resize calls on every frame carry a `"worklet"` directive. It is only a string
 * to the web, to Node and to the tests; on the phone it lets the same code run on the UI thread, where the
 * finger is tracked, instead of keeping a second copy there.
 */

export const DAY_MINUTES = 24 * 60;

/** How tall the whole day is. */
export const GRID_HEIGHT = (DAY_MINUTES / SLOT_MINUTES) * SLOT_HEIGHT;

/** A finger must rest on a block this long before it lifts; a quicker drag scrolls the timeline instead. */
export const TOUCH_HOLD_MS = 300;
/** How far a resting finger may wander (in pixels) before the press is read as a scroll. */
export const TOUCH_SLOP = 10;

/** While a block is held this close to the top or bottom of the scroll area, the area scrolls. */
export const EDGE_SCROLL_ZONE = 72;
/** The fastest the edge scroll goes, in pixels per frame. */
export const EDGE_SCROLL_MAX = 16;

/** Blocks sit this far inside their slot, so back-to-back blocks keep a gap between them. */
export const BLOCK_INSET = 2;
/** No block is drawn shorter than this, however short its duration. */
export const MIN_BLOCK_HEIGHT = 16;

/** Where a day opens when it has no blocks to open on (07:00), and the room left above the first block. */
export const DEFAULT_SCROLL_MINUTES = 420;
export const SCROLL_LEAD = 96;

/** Minutes from midnight to pixels from the top of the grid. */
export function minutesToPx(minutes: number): number {
  "worklet";
  return (minutes / SLOT_MINUTES) * SLOT_HEIGHT;
}

/** Pixels from the top of the grid to minutes from midnight, not snapped to anything. */
export function pxToMinutes(px: number): number {
  "worklet";
  return (px / SLOT_HEIGHT) * SLOT_MINUTES;
}

// ---- Where a block is drawn ----

/** The top edge of a block that starts at `minutes`. */
export function blockTop(minutes: number): number {
  "worklet";
  return minutesToPx(minutes) + BLOCK_INSET;
}

/** Proportional to the duration, so a 15 minute block is visibly half the height of a 30 minute one. */
export function blockHeight(durationMinutes: number): number {
  "worklet";
  return Math.max(MIN_BLOCK_HEIGHT, minutesToPx(durationMinutes) - BLOCK_INSET * 2);
}

/** Blocks shorter than a slot fit their title and time on one line; taller ones put the time under the title. */
export const isShortBlock = (durationMinutes: number) => durationMinutes < SLOT_MINUTES;

/** How many lines the title may take: a block of 45 minutes or more has room for two. */
export const titleLines = (durationMinutes: number): 1 | 2 => (durationMinutes >= 45 ? 2 : 1);

/** Whether there is a free strip under the text for a resize grip (shorter blocks still resize from the edge). */
export const hasResizeGrip = (durationMinutes: number) => durationMinutes >= 45;

/** The scroll offset a day opens at: its first block (or 07:00 when empty), with a little room above. */
export function initialScrollOffset(tasks: readonly Pick<ScheduledTask, "startMinutes">[]): number {
  const first = tasks.reduce<number | null>(
    (min, task) => (min === null ? task.startMinutes : Math.min(min, task.startMinutes)),
    null,
  );
  return Math.max(0, minutesToPx(first ?? DEFAULT_SCROLL_MINUTES) - SCROLL_LEAD);
}

// ---- Tapping and dropping on the grid ----

/**
 * The quarter hour that contains the point `offsetY` below the top of the grid, clamped to the day: where a
 * tap on an empty stretch, or a dropped activity, puts a new block.
 */
export function slotAt(offsetY: number, step = SNAP_MINUTES): number {
  const clamped = Math.max(0, Math.min(GRID_HEIGHT, offsetY));
  return floorMinutes(pxToMinutes(clamped), step);
}

// ---- Moving a block ----

/** How far below its top edge the block was held, in minutes, from where the pointer is when it is picked up. */
export function grabOffset(pointerMinutes: number, startMinutes: number): number {
  "worklet";
  return pointerMinutes - startMinutes;
}

export type DragPosition = {
  /** Where the block's top edge follows the finger, in minutes, kept inside the day. */
  rawStart: number;
  /** Where it lands if let go now: the nearest quarter hour that still fits before midnight. */
  snappedStart: number;
};

/** The position of a held block with the pointer at `pointerMinutes`, having been grabbed `grabMinutes` below its top. */
export function dragPosition(pointerMinutes: number, grabMinutes: number, durationMinutes: number): DragPosition {
  "worklet";
  const maxStart = DAY_MINUTES - durationMinutes;
  const rawStart = Math.max(0, Math.min(maxStart, pointerMinutes - grabMinutes));
  const snappedStart = Math.min(
    Math.floor(maxStart / SNAP_MINUTES) * SNAP_MINUTES,
    snapMinutes(rawStart, SNAP_MINUTES),
  );
  return { rawStart, snappedStart };
}

/** How far across the timeline the pointer is, from 0 (left edge) to 1 (right edge): which column it is held over. */
export function dragFraction(x: number, left: number, width: number): number {
  "worklet";
  if (!(width > 0)) return 0;
  return Math.max(0, Math.min(1, (x - left) / width));
}

export type DragPlan = {
  /** The columns the blocks around the held one take, and the one it takes; empty if it would sit alone. */
  lanes: Map<string, number>;
  /** Where every block would sit with the held one dropped here. */
  placements: Map<string, Placement>;
};

/**
 * While a block is held, the others make room: it takes whichever column the pointer is over (`fraction`,
 * see `dragFraction`) among the blocks it would share time with at `snappedStart`.
 */
export function planDrag(tasks: ScheduledTask[], id: string, snappedStart: number, fraction: number): DragPlan {
  const beside = columnsBeside(tasks, id, snappedStart);
  const index = Math.floor(fraction * (beside.length + 1));
  const lanes = lanesFor(beside, id, index);
  const moved = tasks.map((task) => (task.id === id ? { ...task, startMinutes: snappedStart } : task));
  return { lanes, placements: layoutDay(withLanes(moved, lanes)) };
}

/** The lanes to save when a block is dropped, or nothing if no one ended up in a different column. */
export function changedLanes(tasks: ScheduledTask[], plan: DragPlan | null): Map<string, number> | undefined {
  if (!plan || !plan.lanes.size) return undefined;
  const before = layoutDay(tasks);
  const moved = [...plan.lanes.keys()].some((id) => {
    const was = before.get(id);
    const now = plan.placements.get(id);
    return was?.column !== now?.column || was?.columns !== now?.columns;
  });
  return moved ? plan.lanes : undefined;
}

/**
 * How many pixels to scroll this frame (negative is up) while a block is held at `pointerY`, with the scroll
 * area spanning `viewportTop` to `viewportBottom`. Zero outside the edge zones; faster the nearer the edge.
 */
export function edgeScrollSpeed(pointerY: number, viewportTop: number, viewportBottom: number): number {
  "worklet";
  const intoTop = viewportTop + EDGE_SCROLL_ZONE - pointerY;
  const intoBottom = pointerY - (viewportBottom - EDGE_SCROLL_ZONE);
  if (intoTop > 0) return -Math.min(1, intoTop / EDGE_SCROLL_ZONE) * EDGE_SCROLL_MAX;
  if (intoBottom > 0) return Math.min(1, intoBottom / EDGE_SCROLL_ZONE) * EDGE_SCROLL_MAX;
  return 0;
}

/** The start of a block nudged one step earlier (-1) or later (1), kept inside the day. */
export const nudgedStart = (startMinutes: number, durationMinutes: number, direction: -1 | 1) =>
  Math.max(0, Math.min(DAY_MINUTES - durationMinutes, startMinutes + direction * SNAP_MINUTES));

// ---- Resizing a block ----

/**
 * A duration as a block starting at `startMinutes` may have it: in quarter hours, at least one (as far as the
 * day allows) and no further than midnight.
 */
export function fitDuration(startMinutes: number, minutes: number): number {
  "worklet";
  const step = SNAP_MINUTES;
  const longest = Math.floor((DAY_MINUTES - startMinutes) / step) * step;
  return Math.max(Math.min(step, longest) || step, Math.min(longest, snapMinutes(minutes, step)));
}

/** The duration after the bottom edge of a block was dragged `deltaPx` pixels (down is positive). */
export function resizedDuration(startMinutes: number, startDuration: number, deltaPx: number): number {
  "worklet";
  return fitDuration(startMinutes, startDuration + pxToMinutes(deltaPx));
}

/** The duration after being made one step shorter (-1) or longer (1). */
export const nudgedDuration = (startMinutes: number, durationMinutes: number, direction: -1 | 1) =>
  fitDuration(startMinutes, durationMinutes + direction * SNAP_MINUTES);
