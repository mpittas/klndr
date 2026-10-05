import type { ActivityTemplate, Category, ScheduledTask } from "@klndr/core";
import { describe, expect, it } from "vitest";
import {
  findTask,
  followsTemplate,
  mapTasks,
  mapTemplates,
  patchTask,
  removeCategory,
  removeTask,
  removeTemplate,
  upsertCategory,
  upsertTask,
  upsertTemplate,
} from "../src/cache";
import { queryKeys } from "../src/keys";
import { newClient } from "./world";

const task = (id: string, extra: Partial<ScheduledTask> = {}): ScheduledTask => ({
  id,
  templateId: null,
  title: `Task ${id}`,
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

const template = (id: string, extra: Partial<ActivityTemplate> = {}): ActivityTemplate => ({
  id,
  name: `Activity ${id}`,
  emoji: "📌",
  color: "sky",
  category: "Work",
  defaultDuration: 60,
  notes: null,
  archived: false,
  ...extra,
});

/** A client with one day and one month cached, as the day screen and the calendar would have them. */
function cachedTasks(day: ScheduledTask[], month: ScheduledTask[]) {
  const qc = newClient();
  qc.setQueryData(queryKeys.tasks.day("2031-04-14"), day);
  qc.setQueryData(queryKeys.tasks.range("2031-04-01", "2031-04-30"), month);
  return qc;
}
const dayList = (qc: ReturnType<typeof newClient>) => qc.getQueryData<ScheduledTask[]>(queryKeys.tasks.day("2031-04-14"));
const monthList = (qc: ReturnType<typeof newClient>) =>
  qc.getQueryData<ScheduledTask[]>(queryKeys.tasks.range("2031-04-01", "2031-04-30"));

describe("tasks in the cache", () => {
  it("adds a block to its day and to the month that covers it, each in its own order", () => {
    const other = task("b", { day: "2031-04-02", startMinutes: 600 });
    const qc = cachedTasks([task("a", { startMinutes: 700 })], [other]);

    upsertTask(qc, task("c", { startMinutes: 480 }));

    expect(dayList(qc)?.map((t) => t.id)).toEqual(["c", "a"]); // by start time
    expect(monthList(qc)?.map((t) => t.id)).toEqual(["b", "c"]); // by day, then start time
  });

  it("replaces a block that is already there instead of adding it twice", () => {
    const qc = cachedTasks([task("a")], [task("a")]);
    upsertTask(qc, task("a", { title: "Renamed" }));
    expect(dayList(qc)).toHaveLength(1);
    expect(monthList(qc)?.[0].title).toBe("Renamed");
  });

  it("leaves a block out of lists that don't cover its day", () => {
    const qc = cachedTasks([], []);
    upsertTask(qc, task("far", { day: "2031-09-09" }));
    expect(dayList(qc)).toEqual([]);
    expect(monthList(qc)).toEqual([]);
  });

  it("moves a block between days when its day changes", () => {
    const qc = cachedTasks([task("a")], [task("a")]);
    qc.setQueryData(queryKeys.tasks.day("2031-04-15"), []);

    patchTask(qc, "a", { day: "2031-04-15" });

    expect(dayList(qc)).toEqual([]);
    expect(qc.getQueryData<ScheduledTask[]>(queryKeys.tasks.day("2031-04-15"))?.map((t) => t.id)).toEqual(["a"]);
    expect(monthList(qc)?.[0].day).toBe("2031-04-15"); // still inside the month
  });

  it("drops a block from a month when it moves out of it", () => {
    const qc = cachedTasks([task("a")], [task("a")]);
    patchTask(qc, "a", { day: "2031-05-02" });
    expect(monthList(qc)).toEqual([]);
  });

  it("patches a block everywhere it appears", () => {
    const qc = cachedTasks([task("a")], [task("a")]);
    patchTask(qc, "a", { completed: true });
    expect(dayList(qc)?.[0].completed).toBe(true);
    expect(monthList(qc)?.[0].completed).toBe(true);
  });

  it("ignores a patch for a block it doesn't have", () => {
    const qc = cachedTasks([task("a")], []);
    patchTask(qc, "nope", { completed: true });
    expect(dayList(qc)?.[0].completed).toBe(false);
  });

  it("removes a block everywhere", () => {
    const qc = cachedTasks([task("a"), task("b")], [task("a")]);
    removeTask(qc, "a");
    expect(dayList(qc)?.map((t) => t.id)).toEqual(["b"]);
    expect(monthList(qc)).toEqual([]);
  });

  it("finds a block in any list", () => {
    const qc = cachedTasks([], [task("m")]);
    expect(findTask(qc, "m")?.id).toBe("m");
    expect(findTask(qc, "x")).toBeUndefined();
  });

  it("doesn't create a list for a day nobody has loaded", () => {
    const qc = newClient();
    upsertTask(qc, task("a"));
    expect(qc.getQueryData(queryKeys.tasks.day("2031-04-14"))).toBeUndefined();
  });

  it("rewrites blocks and keeps the lists it didn't change as they were", () => {
    const qc = cachedTasks([task("a", { category: "Old" })], [task("z", { category: "Keep" })]);
    const untouched = monthList(qc);

    mapTasks(qc, (t) => (t.category === "Old" ? { ...t, category: "New" } : t));

    expect(dayList(qc)?.[0].category).toBe("New");
    expect(monthList(qc)).toBe(untouched);
  });
});

describe("activities and categories in the cache", () => {
  it("keeps activities ordered by category, then name", () => {
    const qc = newClient();
    qc.setQueryData(queryKeys.templates, [template("1", { category: "Home", name: "B" }), template("2", { category: "Work", name: "A" })]);

    upsertTemplate(qc, template("3", { category: "Home", name: "A" }));
    upsertTemplate(qc, template("2", { category: "Home", name: "Z" })); // moved category

    expect(qc.getQueryData<ActivityTemplate[]>(queryKeys.templates)?.map((t) => t.id)).toEqual(["3", "1", "2"]);
  });

  it("removes an activity and relabels others", () => {
    const qc = newClient();
    qc.setQueryData(queryKeys.templates, [template("1", { category: "Old" }), template("2", { category: "Other" })]);

    mapTemplates(qc, (t) => (t.category === "Old" ? { ...t, category: "New" } : t));
    removeTemplate(qc, "2");

    expect(qc.getQueryData<ActivityTemplate[]>(queryKeys.templates)).toMatchObject([{ id: "1", category: "New" }]);
  });

  it("keeps categories ordered by name", () => {
    const qc = newClient();
    const c = (id: string, name: string): Category => ({ id, name, color: "sky" });
    qc.setQueryData(queryKeys.categories, [c("1", "Home"), c("2", "Work")]);

    upsertCategory(qc, c("3", "Health"));
    upsertCategory(qc, c("2", "Admin"));
    expect(qc.getQueryData<Category[]>(queryKeys.categories)?.map((x) => x.name)).toEqual(["Admin", "Health", "Home"]);

    removeCategory(qc, "3");
    expect(qc.getQueryData<Category[]>(queryKeys.categories)?.map((x) => x.id)).toEqual(["2", "1"]);
  });

  it("does nothing to a list nobody has loaded", () => {
    const qc = newClient();
    upsertTemplate(qc, template("1"));
    upsertCategory(qc, { id: "1", name: "A", color: "sky" });
    expect(qc.getQueryData(queryKeys.templates)).toBeUndefined();
    expect(qc.getQueryData(queryKeys.categories)).toBeUndefined();
  });
});

describe("followsTemplate", () => {
  const t = template("tpl", { name: "Run", category: "Health" });

  it("matches blocks made from the activity", () => {
    expect(followsTemplate(task("a", { templateId: "tpl" }), t)).toBe(true);
    expect(followsTemplate(task("a", { templateId: "other" }), t)).toBe(false);
  });

  it("matches older unlinked blocks by name and category", () => {
    expect(followsTemplate(task("a", { title: "Run", category: "Health" }), t)).toBe(true);
    expect(followsTemplate(task("a", { title: "Run", category: "Work" }), t)).toBe(false);
    expect(followsTemplate(task("a", { title: "Swim", category: "Health" }), t)).toBe(false);
  });
});
