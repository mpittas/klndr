import type { ActivityTemplate, ChecklistItem, DayChecklist, ScheduledTask } from "@klndr/core";
import { describe, expect, it } from "vitest";
import { draftFromTemplate, isTempId, newTempId, planMove, taskFromDraft } from "../src/blocks";
import { buildDayChecklist, dayStats, emptyDayChecklist } from "../src/derive";

const task = (id: string, extra: Partial<ScheduledTask> = {}): ScheduledTask => ({
  id,
  templateId: null,
  title: id,
  emoji: "📌",
  color: "sky",
  category: "Work",
  day: "2031-04-14",
  startMinutes: 540,
  durationMinutes: 60,
  notes: null,
  completed: false,
  ...extra,
});

describe("blocks", () => {
  const template: ActivityTemplate = {
    id: "t1",
    name: "Workout",
    emoji: "🏋️",
    color: "emerald",
    category: "Health",
    defaultDuration: 45,
    notes: null,
    archived: false,
  };

  it("starts a block from an activity", () => {
    expect(draftFromTemplate("2031-04-14", template, 600, "rose")).toEqual({
      day: "2031-04-14",
      templateId: "t1",
      title: "Workout",
      category: "Health",
      color: "rose", // the category's color, not the activity's own
      emoji: "🏋️",
      startMinutes: 600,
      durationMinutes: 45,
      notes: "",
      completed: false,
    });
  });

  it("shows a draft as the block it will become", () => {
    const draft = draftFromTemplate("2031-04-14", template, 600, "rose");
    expect(taskFromDraft(draft, "pending-1")).toMatchObject({ id: "pending-1", templateId: "t1", notes: "", completed: false });
    // optional fields get their defaults
    const bare = taskFromDraft(
      { day: "d", title: "t", emoji: "e", color: "c", category: "k", startMinutes: 0, durationMinutes: 15 },
      "x",
    );
    expect(bare).toMatchObject({ templateId: null, notes: null, completed: false });
    expect(bare).not.toHaveProperty("lane");
  });

  it("makes temporary ids that can be told apart from real ones", () => {
    const a = newTempId();
    expect(isTempId(a)).toBe(true);
    expect(isTempId("abc123")).toBe(false);
    expect(newTempId()).not.toBe(a);
  });
});

describe("planMove", () => {
  const tasks = [task("a", { startMinutes: 540 }), task("b", { startMinutes: 540, lane: 1 })];

  it("saves the new start time of the block that moved", () => {
    expect([...planMove(tasks, tasks[0], 600)]).toEqual([["a", { startMinutes: 600 }]]);
  });

  it("saves nothing when nothing changed", () => {
    expect(planMove(tasks, tasks[0], 540).size).toBe(0);
    expect(planMove(tasks, tasks[0], 540, new Map([["b", 1]])).size).toBe(0); // b was already in lane 1
  });

  it("saves the columns of blocks that ended up somewhere else", () => {
    const changes = planMove(tasks, tasks[0], 540, new Map([["a", 1], ["b", 0]]));
    expect([...changes]).toEqual([["a", { lane: 1 }], ["b", { lane: 0 }]]);
  });

  it("combines a move and a column change for the same block", () => {
    const changes = planMove(tasks, tasks[0], 600, new Map([["a", 2]]));
    expect(changes.get("a")).toEqual({ startMinutes: 600, lane: 2 });
  });

  it("counts a lane as changed when the block had none", () => {
    expect(planMove([task("a")], task("a"), 540, new Map([["a", 0]])).get("a")).toEqual({ lane: 0 });
  });
});

describe("dayStats", () => {
  it("adds up a day", () => {
    const stats = dayStats([
      task("a", { category: "Work", durationMinutes: 60, completed: true }),
      task("b", { category: "Health", durationMinutes: 30 }),
      task("c", { category: "Work", durationMinutes: 45 }),
    ]);
    expect(stats).toEqual({ scheduled: 135, count: 3, done: 1, categories: [["Work", 105], ["Health", 30]] });
  });

  it("copes with an empty day", () => {
    expect(dayStats([])).toEqual({ scheduled: 0, count: 0, done: 0, categories: [] });
  });
});

describe("buildDayChecklist", () => {
  const item = (id: string, order: number): ChecklistItem => ({ id, title: id, emoji: "✅", order, archived: false });
  const day = (extra: Partial<DayChecklist> = {}): DayChecklist => ({ ...emptyDayChecklist("2031-04-14"), ...extra });

  it("shows the routines, then the one-offs after them", () => {
    const view = buildDayChecklist([item("a", 1), item("b", 2)], day({ extraItems: [{ id: "x", title: "Once", emoji: "1️⃣" }] }));
    expect(view.items.map((i) => [i.id, i.scope])).toEqual([["a", "default"], ["b", "default"], ["x", "day"]]);
    expect(view.items[2].order).toBeGreaterThan(view.items[1].order);
  });

  it("leaves skipped routines out and lists them apart", () => {
    const view = buildDayChecklist([item("a", 1), item("b", 2)], day({ hiddenItemIds: ["a"] }));
    expect(view.items.map((i) => i.id)).toEqual(["b"]);
    expect(view.skipped.map((i) => i.id)).toEqual(["a"]);
  });

  it("counts what is done, among what is shown", () => {
    const view = buildDayChecklist(
      [item("a", 1), item("b", 2), item("c", 3)],
      day({ completedItemIds: ["a", "c", "gone"], hiddenItemIds: ["c"] }),
    );
    expect(view.stats).toEqual({ total: 2, done: 1, percentage: 50 });
  });

  it("has a percentage of zero, not NaN, when there is nothing", () => {
    expect(buildDayChecklist([], day()).stats).toEqual({ total: 0, done: 0, percentage: 0 });
  });

  it("says whether there is anything to show", () => {
    expect(buildDayChecklist([], day()).hasChecklist).toBe(false);
    expect(buildDayChecklist([item("a", 1)], day()).hasChecklist).toBe(true);
    expect(buildDayChecklist([], day({ extraItems: [{ id: "x", title: "t", emoji: "e" }] })).hasChecklist).toBe(true);
    // all skipped is still a checklist
    expect(buildDayChecklist([item("a", 1)], day({ hiddenItemIds: ["a"] })).hasChecklist).toBe(true);
  });
});
