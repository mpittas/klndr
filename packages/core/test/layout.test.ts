import { describe, expect, it } from "vitest";
import { boxOf, columnsBeside, lanesFor, layoutDay, withLanes } from "../src/index";

type Block = { id: string; startMinutes: number; durationMinutes: number; lane?: number };

const block = (id: string, startMinutes: number, durationMinutes: number, lane?: number): Block =>
  lane === undefined ? { id, startMinutes, durationMinutes } : { id, startMinutes, durationMinutes, lane };

describe("layoutDay", () => {
  it("lays out nothing", () => {
    expect(layoutDay([]).size).toBe(0);
  });

  it("gives a lone block the full width", () => {
    expect(layoutDay([block("a", 540, 60)]).get("a")).toEqual({ column: 0, columns: 1 });
  });

  it("leaves blocks that don't share time alone", () => {
    const placements = layoutDay([block("a", 540, 60), block("b", 600, 60), block("c", 660, 60)]);
    expect(placements.get("a")).toEqual({ column: 0, columns: 1 });
    expect(placements.get("b")).toEqual({ column: 0, columns: 1 });
    expect(placements.get("c")).toEqual({ column: 0, columns: 1 });
  });

  it("splits the width between two blocks that overlap", () => {
    const placements = layoutDay([block("a", 540, 60), block("b", 570, 60)]);
    expect(placements.get("a")).toEqual({ column: 0, columns: 2 });
    expect(placements.get("b")).toEqual({ column: 1, columns: 2 });
  });

  it("splits a chain of blocks into the columns it needs, not one per block", () => {
    // a-b and b-c overlap, a-c do not, so a and c share the left column.
    const placements = layoutDay([block("a", 540, 60), block("b", 570, 60), block("c", 615, 60)]);
    expect(placements.get("a")).toEqual({ column: 0, columns: 2 });
    expect(placements.get("b")).toEqual({ column: 1, columns: 2 });
    expect(placements.get("c")).toEqual({ column: 0, columns: 2 });
  });

  it("orders a group by start, then longest, then id", () => {
    const placements = layoutDay([block("z", 540, 60), block("a", 540, 60), block("long", 540, 120)]);
    expect(placements.get("long")).toEqual({ column: 0, columns: 3 });
    expect(placements.get("a")).toEqual({ column: 1, columns: 3 });
    expect(placements.get("z")).toEqual({ column: 2, columns: 3 });
  });

  it("keeps a block in the column it was dragged to", () => {
    const placements = layoutDay([block("dragged", 570, 60, 1), block("auto", 540, 60)]);
    expect(placements.get("dragged")).toEqual({ column: 1, columns: 2 });
    expect(placements.get("auto")).toEqual({ column: 0, columns: 2 });
  });

  it("moves a block out of a column that is taken at its time", () => {
    const placements = layoutDay([block("first", 540, 60, 0), block("second", 570, 60, 0)]);
    expect(placements.get("first")).toEqual({ column: 0, columns: 2 });
    expect(placements.get("second")).toEqual({ column: 1, columns: 2 });
  });

  it("gives a lone block the full width even when it carries a column", () => {
    expect(layoutDay([block("a", 540, 60, 3)]).get("a")).toEqual({ column: 0, columns: 1 });
  });

  it("closes the gaps a saved column leaves behind", () => {
    const placements = layoutDay([block("right", 570, 60, 2), block("left", 540, 60, 0)]);
    expect(placements.get("left")).toEqual({ column: 0, columns: 2 });
    expect(placements.get("right")).toEqual({ column: 1, columns: 2 });
  });
});

describe("columnsBeside", () => {
  const neighbours = [block("a", 540, 60), block("b", 660, 60), block("x", 780, 30, 0)];

  it("has nothing for a block that isn't there", () => {
    expect(columnsBeside(neighbours, "missing", 540)).toEqual([]);
  });

  it("has nothing beside a block that would sit alone", () => {
    expect(columnsBeside(neighbours, "x", 780)).toEqual([]);
  });

  it("returns the columns of the blocks it would sit beside", () => {
    const beside = columnsBeside(neighbours, "x", 570);
    expect(beside).toHaveLength(1);
    expect(beside[0].map((item) => item.id)).toEqual(["a"]);
  });

  it("keeps the block itself out of the columns", () => {
    const beside = columnsBeside(neighbours, "a", 550);
    expect(beside.flat().map((item) => item.id)).not.toContain("a");
  });
});

describe("lanesFor and withLanes", () => {
  const blocks = [block("a", 540, 60), block("b", 570, 60), block("x", 600, 30)];

  it("places a block alone", () => {
    // Nothing to arrange: with no columns to shift, the block keeps the full width.
    expect([...lanesFor([], "x", 0)]).toEqual([]);
  });

  it("shifts the columns to the right of where the block lands", () => {
    const columns = [[blocks[0]], [blocks[1]]];
    expect([...lanesFor(columns, "x", 0)]).toEqual([["a", 1], ["b", 2], ["x", 0]]);
    expect([...lanesFor(columns, "x", 1)]).toEqual([["a", 0], ["b", 2], ["x", 1]]);
    expect([...lanesFor(columns, "x", 2)]).toEqual([["a", 0], ["b", 1], ["x", 2]]);
  });

  it("clamps an index past the last column", () => {
    expect([...lanesFor([[blocks[0]]], "x", 9)]).toEqual([["a", 0], ["x", 1]]);
  });

  it("applies the lanes to the blocks, leaving the others alone", () => {
    const laid = withLanes(blocks, lanesFor([[blocks[0]]], "x", 1));
    expect(laid[2]).toEqual({ ...blocks[2], lane: 1 });
    expect(laid[1]).toBe(blocks[1]); // untouched, and not copied
  });

  it("hands back the same list when there is nothing to apply", () => {
    expect(withLanes(blocks, new Map())).toBe(blocks);
  });
});

describe("boxOf", () => {
  it("turns a placement into left and width fractions", () => {
    expect(boxOf({ column: 0, columns: 4 })).toEqual({ left: 0, width: 0.25 });
    expect(boxOf({ column: 1, columns: 4 })).toEqual({ left: 0.25, width: 0.25 });
    expect(boxOf({ column: 1, columns: 3 })).toEqual({ left: 1 / 3, width: 1 / 3 });
  });
});
