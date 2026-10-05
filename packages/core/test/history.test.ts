import { describe, expect, it } from "vitest";
import { TimelineHistory, type ScheduledTask, type TaskDraft, type TaskPatch } from "../src/index";

/** A block as the server would hand it back. */
const task = (over: Partial<ScheduledTask> = {}): ScheduledTask => ({
  id: "t1",
  templateId: null,
  title: "Write",
  emoji: "✍️",
  color: "indigo",
  category: "Work",
  day: "2026-10-03",
  startMinutes: 540,
  durationMinutes: 60,
  notes: null,
  completed: false,
  ...over,
});

/** A stand-in for the API that records what it was asked to do. */
function fakeApi(day = "2026-10-03") {
  const created: TaskDraft[] = [];
  const updates: { id: string; patch: TaskPatch }[] = [];
  const deleted: string[] = [];
  let nextId = 1;
  let failure: Error | null = null;
  const api = {
    async createTask(draft: TaskDraft) {
      if (failure) throw failure;
      created.push(draft);
      return task({ ...draft, id: `created-${nextId++}` });
    },
    async updateTask(id: string, patch: TaskPatch) {
      if (failure) throw failure;
      updates.push({ id, patch });
      const applied: Partial<ScheduledTask> = { ...(patch as Omit<TaskPatch, "lane">) };
      if (typeof patch.lane === "number") applied.lane = patch.lane;
      return task({ ...applied, id });
    },
    async deleteTask(id: string) {
      if (failure) throw failure;
      deleted.push(id);
    },
    async getTasksForDay() {
      return [task({ id: "from-server" })];
    },
  };
  return {
    api,
    created,
    updates,
    deleted,
    day,
    failWith: (error: Error | null) => {
      failure = error;
    },
  };
}

/** The engine plus the list it writes to, and everything it reported. */
function setup(options: { limit?: number } = {}) {
  const fake = fakeApi();
  let tasks: ScheduledTask[] = [];
  const notices: string[] = [];
  const states: { canUndo: boolean; canRedo: boolean }[] = [];
  const history = new TimelineHistory({
    api: fake.api,
    getTasks: () => tasks,
    setTasks: (next) => {
      tasks = next;
    },
    day: () => fake.day,
    notify: (message) => notices.push(message),
    ...options,
  });
  const unsubscribe = history.subscribe((state) => states.push(state));
  return {
    history,
    fake,
    notices,
    states,
    unsubscribe,
    getTasks: () => tasks,
    setTasks: (next: ScheduledTask[]) => {
      tasks = next;
    },
  };
}

describe("recording", () => {
  it("ignores a change that changed nothing", () => {
    const { history } = setup();
    const before = task();
    history.record("Nothing", [[before, { ...before }]]);
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
  });

  it("ignores a pair with neither side", () => {
    const { history } = setup();
    history.record("Nothing", [
      [null, null],
      [undefined, undefined],
    ]);
    expect(history.canUndo).toBe(false);
  });

  it("remembers a copy, so editing the block afterwards doesn't rewrite history", () => {
    const { history, fake } = setup();
    const before = task();
    history.record("Edit Write", [[before, { ...before, title: "Write more" }]]);
    before.title = "Changed after the fact";
    expect(history.canUndo).toBe(true);
    expect(fake.updates).toHaveLength(0);
  });

  it("reports the state as it changes", () => {
    const { history, states } = setup();
    expect(states).toEqual([{ canUndo: false, canRedo: false }]);
    history.record("Edit", [[task(), task({ title: "Other" })]]);
    expect(states.at(-1)).toEqual({ canUndo: true, canRedo: false });
  });
});

describe("undo and redo", () => {
  it("says there is nothing to undo or redo", async () => {
    const { history, notices, fake } = setup();
    await history.undo();
    await history.redo();
    expect(notices).toEqual(["Nothing to undo", "Nothing to redo"]);
    expect(fake.updates).toHaveLength(0);
  });

  it("saves the before back, and the after again on redo", async () => {
    const { history, fake, notices, getTasks } = setup();
    getTasks().push(task({ startMinutes: 600 }));
    history.record("Move Write", [[task({ startMinutes: 600 }), task({ startMinutes: 660 })]]);

    await history.undo();
    expect(fake.updates).toEqual([{ id: "t1", patch: { startMinutes: 600 } }]);
    expect(notices.at(-1)).toBe("Undid: Move Write");
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(true);

    await history.redo();
    expect(fake.updates.at(-1)).toEqual({ id: "t1", patch: { startMinutes: 660 } });
    expect(notices.at(-1)).toBe("Redid: Move Write");
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
  });

  it("only writes the fields the step changed", async () => {
    const { history, fake } = setup();
    history.record("Rename", [[task(), task({ title: "Renamed", durationMinutes: 90 })]]);
    await history.undo();
    expect(fake.updates[0].patch).toEqual({ title: "Write", durationMinutes: 60 });
  });

  it("clears a column that wasn't set before", async () => {
    const { history, fake } = setup();
    history.record("Move aside", [[task(), task({ lane: 1 })]]);
    await history.undo();
    expect(fake.updates[0].patch).toEqual({ lane: null });
  });

  it("puts the blocks back on screen sorted by start time", async () => {
    const { history, getTasks } = setup();
    getTasks().push(task({ startMinutes: 600 }));
    history.record("Move", [[task({ startMinutes: 600 }), task({ startMinutes: 900 })]]);
    await history.undo();
    expect(getTasks().map((item) => [item.id, item.startMinutes])).toEqual([["t1", 600]]);
  });

  it("keeps a block off the day on screen", async () => {
    const { history, getTasks } = setup();
    getTasks().push(task({ startMinutes: 600 }));
    history.record("Move to tomorrow", [[task({ day: "2026-10-04" }), task({ startMinutes: 600 })]]);
    await history.undo(); // back to the fourth, which isn't the day on screen
    expect(getTasks()).toEqual([]);
  });

  it("deletes on redo what it created on undo, under the server's new id", async () => {
    const { history, fake, getTasks } = setup();
    history.record("Delete Write", [[task(), null]]);

    await history.undo();
    expect(fake.created).toHaveLength(1);
    expect(fake.created[0]).not.toHaveProperty("id");
    expect(fake.created[0]).toMatchObject({ title: "Write", day: "2026-10-03" });
    expect(getTasks().map((item) => item.id)).toEqual(["created-1"]);

    await history.redo();
    expect(fake.deleted).toEqual(["created-1"]); // the alias, not the id the step recorded
    expect(getTasks()).toEqual([]);
  });

  it("creates on undo what it deleted before", async () => {
    const { history, fake, getTasks } = setup();
    getTasks().push(task({ id: "t9" }));
    history.record("Add Write", [[null, task({ id: "t9" })]]);

    await history.undo();
    expect(fake.deleted).toEqual(["t9"]);
    expect(getTasks()).toEqual([]);

    await history.redo();
    expect(fake.created).toHaveLength(1);
    expect(getTasks().map((item) => item.id)).toEqual(["created-1"]);
  });

  it("forgets everything and resyncs when a save fails", async () => {
    const { history, fake, notices, getTasks } = setup();
    history.record("Move", [[task(), task({ startMinutes: 600 })]]);
    fake.failWith(new Error("offline"));

    await history.undo();
    expect(notices.at(-1)).toBe("Could not undo that");
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    expect(getTasks().map((item) => item.id)).toEqual(["from-server"]);
  });

  it("starts over from a clean slate after clearing", () => {
    const { history, states } = setup();
    history.record("Move", [[task(), task({ startMinutes: 600 })]]);
    history.clear();
    expect(history.canUndo).toBe(false);
    expect(states.at(-1)).toEqual({ canUndo: false, canRedo: false });
  });

  it("keeps only as many steps as the limit allows", async () => {
    const { history, fake } = setup({ limit: 2 });
    history.record("One", [[task(), task({ startMinutes: 600 })]]);
    history.record("Two", [[task({ startMinutes: 600 }), task({ startMinutes: 660 })]]);
    history.record("Three", [[task({ startMinutes: 660 }), task({ startMinutes: 720 })]]);

    await history.undo();
    await history.undo();
    await history.undo(); // the first step was dropped, so there is nothing left
    expect(fake.updates).toHaveLength(2);
  });

  it("stops listening once unsubscribed", () => {
    const { history, states, unsubscribe } = setup();
    unsubscribe();
    history.record("Move", [[task(), task({ startMinutes: 600 })]]);
    expect(states).toEqual([{ canUndo: false, canRedo: false }]);
  });
});
