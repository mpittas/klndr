import type { ScheduledTask } from "./types";

/** What laying blocks out side by side needs to know about each one. */
type Block = Pick<ScheduledTask, "id" | "startMinutes" | "durationMinutes" | "lane">;

/** A block's column among the blocks it shares time with, counted from the left. */
export type Placement = { column: number; columns: number };

const endOf = (block: Block) => block.startMinutes + block.durationMinutes;
const overlap = (a: Block, b: Block) => a.startMinutes < endOf(b) && b.startMinutes < endOf(a);
const byStart = (a: Block, b: Block) =>
  a.startMinutes - b.startMinutes || b.durationMinutes - a.durationMinutes || a.id.localeCompare(b.id);
const hasLane = (block: Block) => typeof block.lane === "number";

/** Blocks that share time, directly or through blocks in between, and so split the width. */
function groupsOf<T extends Block>(blocks: T[]): T[][] {
  const groups: T[][] = [];
  let end = -1;
  for (const block of [...blocks].sort(byStart)) {
    if (groups.length && block.startMinutes < end) {
      groups[groups.length - 1].push(block);
      end = Math.max(end, endOf(block));
    } else {
      groups.push([block]);
      end = endOf(block);
    }
  }
  return groups;
}

/**
 * A group's columns, left to right. A block placed by hand keeps its lane while that is free at
 * its time; every other block takes the first free column.
 */
function columnsOf<T extends Block>(group: T[]): T[][] {
  const columns: T[][] = [];
  const place = (block: T, from: number) => {
    let index = from;
    while (columns[index]?.some((other) => overlap(other, block))) index += 1;
    if (!columns[index]) columns[index] = [];
    columns[index].push(block);
  };
  const placed = group.filter(hasLane).sort((a, b) => a.lane! - b.lane! || byStart(a, b));
  for (const block of placed) place(block, block.lane!);
  for (const block of group.filter((block) => !hasLane(block)).sort(byStart)) place(block, 0);
  return columns.filter(Boolean); // lanes can leave gaps; close them up
}

/** Where every block sits across the timeline. */
export function layoutDay(blocks: Block[]): Map<string, Placement> {
  const placements = new Map<string, Placement>();
  for (const group of groupsOf(blocks)) {
    const columns = columnsOf(group);
    columns.forEach((column, index) => {
      for (const block of column) placements.set(block.id, { column: index, columns: columns.length });
    });
  }
  return placements;
}

/**
 * The columns block `id` would sit beside if it started at `start`, left to right and without the
 * block itself. It can go before, between or after them; none means it would sit alone.
 */
export function columnsBeside<T extends Block>(blocks: T[], id: string, start: number): T[][] {
  const block = blocks.find((item) => item.id === id);
  if (!block) return [];
  const moved = blocks.map((item) => (item.id === id ? { ...item, startMinutes: start } : item));
  const group = groupsOf(moved).find((members) => members.some((item) => item.id === id)) ?? [];
  return columnsOf(group.filter((item) => item.id !== id));
}

/** Lanes that put block `id` at `index` (0 is leftmost) among `columns`, which keep their order. */
export function lanesFor(columns: Block[][], id: string, index: number): Map<string, number> {
  const lanes = new Map<string, number>();
  if (!columns.length) return lanes; // alone, so there is nothing to arrange
  const at = Math.max(0, Math.min(columns.length, index));
  columns.forEach((column, i) => {
    for (const block of column) lanes.set(block.id, i < at ? i : i + 1);
  });
  lanes.set(id, at);
  return lanes;
}

/** The blocks with `lanes` applied, to lay out an arrangement before it is saved. */
export function withLanes<T extends Block>(blocks: T[], lanes: Map<string, number>): T[] {
  return lanes.size ? blocks.map((block) => (lanes.has(block.id) ? { ...block, lane: lanes.get(block.id) } : block)) : blocks;
}

/** A placement as the left edge and width of its block, as fractions of the timeline's width. */
export const boxOf = (placement: Placement) => ({ left: placement.column / placement.columns, width: 1 / placement.columns });
