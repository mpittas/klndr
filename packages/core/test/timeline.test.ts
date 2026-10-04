import { describe, expect, it } from "vitest";
import {
  BLOCK_INSET,
  DAY_MINUTES,
  DEFAULT_SCROLL_MINUTES,
  EDGE_SCROLL_MAX,
  EDGE_SCROLL_ZONE,
  GRID_HEIGHT,
  MIN_BLOCK_HEIGHT,
  SCROLL_LEAD,
  SLOT_HEIGHT,
  SLOT_MINUTES,
  SNAP_MINUTES,
  blockHeight,
  blockTop,
  changedLanes,
  fitDuration,
  dragFraction,
  dragPosition,
  edgeScrollSpeed,
  floorMinutes,
  grabOffset,
  hasResizeGrip,
  initialScrollOffset,
  isShortBlock,
  layoutDay,
  minutesToPx,
  nudgedDuration,
  nudgedStart,
  planDrag,
  pxToMinutes,
  resizedDuration,
  slotAt,
  snapMinutes,
  titleLines,
  type ScheduledTask,
} from "../src/index";

const task = (id: string, startMinutes: number, durationMinutes: number, lane?: number): ScheduledTask => ({
  id,
  templateId: null,
  title: id,
  emoji: "",
  color: "indigo",
  category: "General",
  day: "2026-10-03",
  startMinutes,
  durationMinutes,
  notes: null,
  completed: false,
  ...(lane === undefined ? {} : { lane }),
});

/**
 * The formulas as the original web planner had them before they moved here, copied as they were. The functions under test must agree with them everywhere, which is what "behaviour
 * unchanged" means.
 */
const original = {
  pointerMinutes: (lastY: number, rectTop: number) => ((lastY - rectTop) / SLOT_HEIGHT) * SLOT_MINUTES,
  drag(pointer: number, grab: number, duration: number) {
    const maxStart = DAY_MINUTES - duration;
    const rawStart = Math.max(0, Math.min(maxStart, pointer - grab));
    const snappedStart = Math.min(Math.floor(maxStart / SNAP_MINUTES) * SNAP_MINUTES, snapMinutes(rawStart, SNAP_MINUTES));
    return { rawStart, snappedStart };
  },
  edge(lastY: number, top: number, bottom: number) {
    const intoTop = top + 72 - lastY;
    const intoBottom = lastY - (bottom - 72);
    return intoTop > 0
      ? -Math.min(1, intoTop / 72) * 16
      : intoBottom > 0
        ? Math.min(1, intoBottom / 72) * 16
        : 0;
  },
  snapDuration(start: number, startDuration: number, minutes: number) {
    void startDuration;
    const step = SNAP_MINUTES;
    const longest = Math.floor((24 * 60 - start) / step) * step;
    return Math.max(Math.min(step, longest) || step, Math.min(longest, snapMinutes(minutes, step)));
  },
  minutesFromEvent(clientY: number, rectTop: number, rectHeight: number) {
    const offsetY = Math.max(0, Math.min(rectHeight, clientY - rectTop));
    return floorMinutes((offsetY / SLOT_HEIGHT) * SLOT_MINUTES, SNAP_MINUTES);
  },
  blockTop: (minutes: number) => (minutes / SLOT_MINUTES) * SLOT_HEIGHT + 2,
  blockHeight: (duration: number) => Math.max(16, (duration / SLOT_MINUTES) * SLOT_HEIGHT - 4),
  nudge: (start: number, duration: number, direction: number) =>
    Math.max(0, Math.min(24 * 60 - duration, start + direction * SNAP_MINUTES)),
};

describe("the grid", () => {
  it("is 48 half-hour rows tall", () => {
    expect(GRID_HEIGHT).toBe(48 * SLOT_HEIGHT);
    expect(DAY_MINUTES).toBe(1440);
  });

  it("converts minutes and pixels both ways", () => {
    expect(minutesToPx(0)).toBe(0);
    expect(minutesToPx(30)).toBe(SLOT_HEIGHT);
    expect(minutesToPx(90)).toBe(3 * SLOT_HEIGHT);
    expect(pxToMinutes(SLOT_HEIGHT)).toBe(30);
    expect(pxToMinutes(minutesToPx(437))).toBeCloseTo(437, 10);
  });
});

describe("how a block is drawn", () => {
  it("sits inset from its slot, so neighbours keep a gap", () => {
    expect(blockTop(0)).toBe(BLOCK_INSET);
    expect(blockTop(60)).toBe(2 * SLOT_HEIGHT + BLOCK_INSET);
    expect(blockHeight(30)).toBe(SLOT_HEIGHT - 2 * BLOCK_INSET);
  });

  it("is proportional to its duration, down to a minimum", () => {
    expect(blockHeight(60)).toBe(92);
    expect(blockHeight(15)).toBe(20); // 24 minus the inset, still above the 16 floor
    expect(blockHeight(1)).toBe(MIN_BLOCK_HEIGHT);
    expect(blockHeight(0)).toBe(MIN_BLOCK_HEIGHT);
  });

  it("matches the formulas the original planner used", () => {
    for (let minutes = 0; minutes <= DAY_MINUTES; minutes += 5) {
      expect(blockTop(minutes)).toBe(original.blockTop(minutes));
      expect(blockHeight(minutes)).toBe(original.blockHeight(minutes));
    }
  });

  it("puts title and time on one line for blocks under a slot", () => {
    expect(isShortBlock(15)).toBe(true);
    expect(isShortBlock(29)).toBe(true);
    expect(isShortBlock(30)).toBe(false);
  });

  it("lets the title take two lines from 45 minutes, and shows a grip from there too", () => {
    expect(titleLines(15)).toBe(1);
    expect(titleLines(30)).toBe(1);
    expect(titleLines(44)).toBe(1);
    expect(titleLines(45)).toBe(2);
    expect(titleLines(240)).toBe(2);
    expect(hasResizeGrip(30)).toBe(false);
    expect(hasResizeGrip(45)).toBe(true);
  });
});

describe("where a day opens", () => {
  it("opens on 07:00 when it has no blocks", () => {
    expect(initialScrollOffset([])).toBe(minutesToPx(DEFAULT_SCROLL_MINUTES) - SCROLL_LEAD);
    expect(DEFAULT_SCROLL_MINUTES).toBe(7 * 60);
  });

  it("opens on the earliest block, whatever order they come in", () => {
    const offset = initialScrollOffset([task("b", 780, 60), task("a", 540, 60), task("c", 600, 30)]);
    expect(offset).toBe(minutesToPx(540) - SCROLL_LEAD);
  });

  it("never scrolls above the top", () => {
    expect(initialScrollOffset([task("early", 0, 30)])).toBe(0);
    expect(initialScrollOffset([task("early", 60, 30)])).toBe(0); // 96px is exactly what leaves the room
  });
});

describe("a tap or a drop on the grid", () => {
  it("lands on the quarter hour under the point", () => {
    expect(slotAt(0)).toBe(0);
    expect(slotAt(SLOT_HEIGHT)).toBe(30);
    expect(slotAt(SLOT_HEIGHT * 0.9)).toBe(15); // 27 minutes floors to 15, not rounds to 30
    expect(slotAt(minutesToPx(8 * 60 + 20))).toBe(8 * 60 + 15);
  });

  it("is clamped to the day", () => {
    expect(slotAt(-50)).toBe(0);
    expect(slotAt(GRID_HEIGHT + 500)).toBe(DAY_MINUTES - SNAP_MINUTES);
    expect(slotAt(GRID_HEIGHT)).toBe(DAY_MINUTES - SNAP_MINUTES);
  });

  it("matches the formula the original planner used, across the grid and past both ends", () => {
    const rectTop = 120;
    for (let clientY = rectTop - 40; clientY <= rectTop + GRID_HEIGHT + 40; clientY += 7) {
      expect(slotAt(clientY - rectTop)).toBe(original.minutesFromEvent(clientY, rectTop, GRID_HEIGHT));
    }
  });
});

describe("moving a block", () => {
  it("remembers how far below its top it was held", () => {
    expect(grabOffset(555, 540)).toBe(15);
    expect(grabOffset(540, 540)).toBe(0);
  });

  it("follows the pointer, and lands on the nearest quarter hour", () => {
    expect(dragPosition(600, 10, 60)).toEqual({ rawStart: 590, snappedStart: 585 });
    expect(dragPosition(608, 0, 60)).toEqual({ rawStart: 608, snappedStart: 615 });
    expect(dragPosition(607, 0, 60).snappedStart).toBe(600);
  });

  it("stays inside the day", () => {
    expect(dragPosition(-300, 0, 60)).toEqual({ rawStart: 0, snappedStart: 0 });
    expect(dragPosition(5000, 0, 60)).toEqual({ rawStart: 1380, snappedStart: 1380 });
  });

  it("never lets a block that is not a whole number of quarter hours run past midnight", () => {
    // 50 minutes long: the latest start is 1390, and the latest quarter hour that fits is 1380.
    expect(dragPosition(5000, 0, 50)).toEqual({ rawStart: 1390, snappedStart: 1380 });
  });

  it("matches the formula the original planner used", () => {
    for (const duration of [15, 30, 45, 50, 60, 90, 240, 1440]) {
      for (let pointer = -100; pointer <= DAY_MINUTES + 100; pointer += 11) {
        for (const grab of [0, 7, 23]) {
          expect(dragPosition(pointer, grab, duration)).toEqual(original.drag(pointer, grab, duration));
        }
      }
    }
  });

  it("reads which column the pointer is over, clamped to the timeline", () => {
    expect(dragFraction(100, 0, 200)).toBe(0.5);
    expect(dragFraction(-30, 0, 200)).toBe(0);
    expect(dragFraction(900, 0, 200)).toBe(1);
    expect(dragFraction(150, 100, 200)).toBe(0.25);
    expect(dragFraction(10, 0, 0)).toBe(0); // no width, no column
  });

  it("nudges a block a quarter hour, and not out of the day", () => {
    expect(nudgedStart(540, 60, 1)).toBe(555);
    expect(nudgedStart(540, 60, -1)).toBe(525);
    expect(nudgedStart(0, 60, -1)).toBe(0);
    expect(nudgedStart(1380, 60, 1)).toBe(1380);
    for (let start = 0; start <= 1380; start += 15) {
      for (const direction of [-1, 1] as const) {
        expect(nudgedStart(start, 60, direction)).toBe(original.nudge(start, 60, direction));
      }
    }
  });
});

describe("making room while a block is held", () => {
  const alone = [task("a", 540, 60), task("held", 720, 60)];
  const crowd = [task("a", 540, 60), task("b", 540, 60), task("held", 720, 60)];

  it("leaves everything as it is when the block lands alone", () => {
    const plan = planDrag(alone, "held", 720, 0.5);
    expect(plan.lanes.size).toBe(0);
    expect(plan.placements.get("held")).toEqual({ column: 0, columns: 1 });
    expect(changedLanes(alone, plan)).toBeUndefined();
  });

  it("puts the block in the column the pointer is over", () => {
    // Held over the 540 pair: it can sit before, between or after them, by how far across the pointer is.
    const left = planDrag(crowd, "held", 540, 0.05);
    const middle = planDrag(crowd, "held", 540, 0.5);
    const right = planDrag(crowd, "held", 540, 0.95);
    expect(left.placements.get("held")).toEqual({ column: 0, columns: 3 });
    expect(middle.placements.get("held")).toEqual({ column: 1, columns: 3 });
    expect(right.placements.get("held")).toEqual({ column: 2, columns: 3 });
    expect(right.placements.get("a")).toEqual({ column: 0, columns: 3 });
    expect(right.placements.get("b")).toEqual({ column: 1, columns: 3 });
  });

  it("treats the far right edge as the last column", () => {
    expect(planDrag(crowd, "held", 540, 1).placements.get("held")).toEqual({ column: 2, columns: 3 });
  });

  it("pushes the neighbours aside, and says who moved", () => {
    const plan = planDrag(crowd, "held", 540, 0.05);
    expect([...plan.lanes]).toEqual(expect.arrayContaining([["held", 0], ["a", 1], ["b", 2]]));
    expect(changedLanes(crowd, plan)).toBe(plan.lanes);
  });

  it("saves the lanes when the neighbours only get narrower", () => {
    // `held` is the last of four side by side, and is dropped last among three: its own column does not
    // change and neither does anyone else's, but x, y and z each lose a quarter of their width to it.
    const tasks = [
      task("a", 540, 60), task("b", 540, 60), task("c", 540, 60), task("held", 540, 60),
      task("x", 900, 60), task("y", 900, 60), task("z", 900, 60),
    ];
    expect(layoutDay(tasks).get("held")).toEqual({ column: 3, columns: 4 });
    const plan = planDrag(tasks, "held", 900, 0.99);
    expect(plan.placements.get("held")).toEqual({ column: 3, columns: 4 });
    expect(plan.placements.get("x")).toEqual({ column: 0, columns: 4 });
    expect(changedLanes(tasks, plan)).toBe(plan.lanes);
  });

  it("saves nothing when everyone stays where they were", () => {
    // Dropped on the same spot, over the column it already has: nobody changes column.
    const sharing = [task("a", 540, 60), task("held", 540, 60)];
    const before = layoutDay(sharing);
    const column = before.get("held")!.column;
    const plan = planDrag(sharing, "held", 540, column === 0 ? 0.25 : 0.75);
    expect(plan.placements.get("held")).toEqual(before.get("held"));
    expect(changedLanes(sharing, plan)).toBeUndefined();
  });

  it("copes with no plan at all", () => {
    expect(changedLanes(crowd, null)).toBeUndefined();
  });
});

describe("edge scrolling", () => {
  const top = 100;
  const bottom = 700;

  it("does not scroll in the middle", () => {
    expect(edgeScrollSpeed(400, top, bottom)).toBe(0);
    expect(edgeScrollSpeed(top + EDGE_SCROLL_ZONE, top, bottom)).toBe(0);
    expect(edgeScrollSpeed(bottom - EDGE_SCROLL_ZONE, top, bottom)).toBe(0);
  });

  it("scrolls up near the top and down near the bottom", () => {
    expect(edgeScrollSpeed(top + 10, top, bottom)).toBeLessThan(0);
    expect(edgeScrollSpeed(bottom - 10, top, bottom)).toBeGreaterThan(0);
  });

  it("speeds up the nearer the edge, to a limit", () => {
    expect(edgeScrollSpeed(bottom - 36, top, bottom)).toBeCloseTo(EDGE_SCROLL_MAX / 2, 10);
    expect(edgeScrollSpeed(bottom, top, bottom)).toBe(EDGE_SCROLL_MAX);
    expect(edgeScrollSpeed(bottom + 500, top, bottom)).toBe(EDGE_SCROLL_MAX);
    expect(edgeScrollSpeed(top - 500, top, bottom)).toBe(-EDGE_SCROLL_MAX);
  });

  it("matches the formula the original planner used", () => {
    for (let y = -100; y <= 900; y += 3) {
      expect(edgeScrollSpeed(y, top, bottom)).toBe(original.edge(y, top, bottom));
    }
  });
});

describe("resizing a block", () => {
  it("snaps to quarter hours", () => {
    expect(fitDuration(540, 52)).toBe(45);
    expect(fitDuration(540, 53)).toBe(60);
    expect(resizedDuration(540, 60, minutesToPx(30))).toBe(90);
    expect(resizedDuration(540, 60, -minutesToPx(30))).toBe(30);
  });

  it("is never shorter than a quarter hour", () => {
    expect(resizedDuration(540, 60, -5000)).toBe(SNAP_MINUTES);
    expect(fitDuration(540, 0)).toBe(SNAP_MINUTES);
    expect(fitDuration(540, -90)).toBe(SNAP_MINUTES);
  });

  it("is never longer than what is left of the day", () => {
    expect(resizedDuration(1380, 30, 5000)).toBe(60);
    expect(resizedDuration(1425, 15, 5000)).toBe(15);
    expect(fitDuration(1430, 60)).toBe(SNAP_MINUTES); // 10 minutes left: no whole step fits, so it keeps one
  });

  it("matches the formula the original planner used", () => {
    for (const start of [0, 15, 540, 1000, 1380, 1410, 1425, 1430]) {
      for (const startDuration of [15, 30, 60, 240]) {
        for (let deltaPx = -400; deltaPx <= 400; deltaPx += 13) {
          const minutes = startDuration + (deltaPx / SLOT_HEIGHT) * SLOT_MINUTES;
          expect(resizedDuration(start, startDuration, deltaPx)).toBe(original.snapDuration(start, startDuration, minutes));
        }
      }
    }
  });

  it("goes one step longer or shorter for the accessibility actions", () => {
    expect(nudgedDuration(540, 60, 1)).toBe(75);
    expect(nudgedDuration(540, 60, -1)).toBe(45);
    expect(nudgedDuration(540, 15, -1)).toBe(15);
    expect(nudgedDuration(1425, 15, 1)).toBe(15);
  });
});

describe("the pointer", () => {
  it("is measured the way the original planner measured it", () => {
    for (const lastY of [100, 333, 1234]) {
      expect(pxToMinutes(lastY - 100)).toBe(original.pointerMinutes(lastY, 100));
    }
  });
});
