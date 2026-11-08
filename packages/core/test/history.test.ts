import { describe, expect, it } from "vitest";
import { TimelineHistory, type ScheduledTask, type TaskDraft, type TaskPatch, type TaskStore } from "../src/index";

const DAY = "2026-10-03";

/** A block as the server would hand it back. */
const task = (over: Partial<ScheduledTask> = {}): ScheduledTask => ({
  id: "t1",
  templateId: null,
  title: "Write",
  emoji: "✍️",
  color: "indigo",
  category: "Work",
  day: DAY,
  startMinutes: 540,
  durationMinutes: 60,
  notes: null,
  completed: false,
  ...over,
});

/** A stand-in for the API that records what it was asked to do; `hold` keeps its answers back. */
function fakeApi() {
  const created: TaskDraft[] = [];
  const updates: { id: string; patch: TaskPatch }[] = [];
  const deleted: string[] = [];
  let nextId = 1;
  let failure: Error | null = null;
  let held: Promise<void> | null = null;
  const wait = async () => {
    if (held) await held;
  };
  const api = {
    async createTask(draft: TaskDraft) {
      await wait();
      if (failure) throw failure;
      created.push(draft);
      return task({ ...draft, id: `created-${nextId++}` });
    },
    async updateTask(id: string, patch: TaskPatch) {
      await wait();
      if (failure) throw failure;
      updates.push({ id, patch });
      const applied: Partial<ScheduledTask> = { ...(patch as Omit<TaskPatch, "lane">) };
      if (typeof patch.lane === "number") applied.lane = patch.lane;
      return task({ ...applied, id });
    },
    async deleteTask(id: string) {
      await wait();
      if (failure) throw failure;
      deleted.push(id);
    },
  };
  return {
    api,
    created,
    updates,
    deleted,
    failWith: (error: Error | null) => {
      failure = error;
    },
    /** Hold every request until the returned function is called. */
    hold: () => {
      let release!: () => void;
      held = new Promise<void>((resolve) => (release = resolve));
      return () => {
        held = null;
        release();
      };
    },
  };
}

/**
 * The blocks on screen: one list per day shown, as the app's cache keeps them. Like the cache, `put` only
 * reaches a day that is shown.
 */
function fakeStore(days: string[]) {
  const lists = new Map<string, ScheduledTask[]>(days.map((day) => [day, []]));
  const store: TaskStore = {
    find: (id) => [...lists.values()].flat().find((item) => item.id === id),
    put: (block) => {
      for (const [day, list] of lists) {
        const rest = list.filter((item) => item.id !== block.id);
        lists.set(day, day === block.day ? [...rest, block].sort((a, b) => a.startMinutes - b.startMinutes) : rest);
      }
    },
    remove: (id) => {
      for (const [day, list] of lists) lists.set(day, list.filter((item) => item.id !== id));
    },
  };
  return {
    store,
    list: (day = DAY) => lists.get(day) ?? [],
    seed: (...blocks: ScheduledTask[]) => blocks.forEach((block) => store.put(block)),
  };
}

/** The engine plus the lists it writes to, and everything it reported. */
function setup(options: { limit?: number; days?: string[] } = {}) {
  const fake = fakeApi();
  const screen = fakeStore(options.days ?? [DAY]);
  const notices: string[] = [];
  const states: { canUndo: boolean; canRedo: boolean }[] = [];
  let resyncs = 0;
  const history = new TimelineHistory({
    api: fake.api,
    store: screen.store,
    notify: (message) => notices.push(message),
    resync: () => {
      resyncs += 1;
    },
    limit: options.limit,
  });
  const unsubscribe = history.subscribe((state) => states.push(state));
  return { history, fake, screen, notices, states, unsubscribe, resyncs: () => resyncs };
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
    const { history, fake, notices, screen } = setup();
    screen.seed(task({ startMinutes: 660 }));
    history.record("Move Write", [[task({ startMinutes: 600 }), task({ startMinutes: 660 })]]);

    await history.undo();
    expect(fake.updates).toEqual([{ id: "t1", patch: { startMinutes: 600 } }]);
    expect(screen.list()[0].startMinutes).toBe(600);
    expect(notices.at(-1)).toBe("Undid: Move Write");
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(true);

    await history.redo();
    expect(fake.updates.at(-1)).toEqual({ id: "t1", patch: { startMinutes: 660 } });
    expect(screen.list()[0].startMinutes).toBe(660);
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

  it("keeps a change made to another field in between", async () => {
    const { history, screen } = setup();
    history.record("Move", [[task(), task({ startMinutes: 600 })]]);
    screen.seed(task({ startMinutes: 600, title: "Renamed since" }));
    await history.undo();
    expect(screen.list()[0]).toMatchObject({ startMinutes: 540, title: "Renamed since" });
  });

  it("clears a column that wasn't set before", async () => {
    const { history, fake, screen } = setup();
    screen.seed(task({ lane: 1 }));
    history.record("Move aside", [[task(), task({ lane: 1 })]]);
    await history.undo();
    expect(fake.updates[0].patch).toEqual({ lane: null });
    expect(screen.list()[0].lane).toBeUndefined();
  });

  it("puts the blocks back on screen sorted by start time", async () => {
    const { history, screen } = setup();
    screen.seed(task({ id: "t2", startMinutes: 700 }), task({ startMinutes: 900 }));
    history.record("Move", [[task({ startMinutes: 600 }), task({ startMinutes: 900 })]]);
    await history.undo();
    expect(screen.list().map((item) => [item.id, item.startMinutes])).toEqual([
      ["t1", 600],
      ["t2", 700],
    ]);
  });

  it("brings a block moved to another day back at once, before the server has answered", async () => {
    const { history, fake, screen } = setup({ days: [DAY, "2026-10-04"] });
    screen.seed(task({ day: "2026-10-04" }));
    history.record("Move Write", [[task(), task({ day: "2026-10-04" })]]);
    const release = fake.hold();

    const done = history.undo();
    expect(screen.list(DAY).map((item) => item.id)).toEqual(["t1"]);
    expect(screen.list("2026-10-04")).toEqual([]); // and gone from the day it was moved to
    release();
    await done;
    expect(fake.updates).toEqual([{ id: "t1", patch: { day: DAY } }]);
  });

  it("brings it back even when the day it was moved to isn't on screen", async () => {
    const { history, screen } = setup(); // only DAY is shown
    history.record("Move Write", [[task(), task({ day: "2026-10-04" })]]);
    await history.undo();
    expect(screen.list(DAY)).toEqual([task()]);
  });

  it("shows several quick undos one after another, never a step that was already undone", async () => {
    const { history, fake, screen } = setup();
    screen.seed(task({ startMinutes: 720 }));
    history.record("One", [[task({ startMinutes: 540 }), task({ startMinutes: 600 })]]);
    history.record("Two", [[task({ startMinutes: 600 }), task({ startMinutes: 660 })]]);
    history.record("Three", [[task({ startMinutes: 660 }), task({ startMinutes: 720 })]]);

    const release = fake.hold();
    void history.undo();
    void history.undo();
    const done = history.undo();
    expect(screen.list()[0].startMinutes).toBe(540);
    release();
    await done;

    // The server's answers to the first two don't show on the way.
    expect(screen.list()[0].startMinutes).toBe(540);
    expect(fake.updates.map((update) => update.patch.startMinutes)).toEqual([660, 600, 540]);
  });

  it("doesn't put back what the server said over a change made while the step was saving", async () => {
    const { history, fake, screen } = setup();
    screen.seed(task({ startMinutes: 600 }));
    history.record("Move", [[task(), task({ startMinutes: 600 })]]);
    const release = fake.hold();

    const done = history.undo(); // shows 540 at once
    screen.seed(task({ startMinutes: 480 })); // moved again before the undo was saved
    release();
    await done;
    expect(screen.list()[0].startMinutes).toBe(480);
  });

  it("deletes on redo what it created on undo, under the server's new id", async () => {
    const { history, fake, screen } = setup();
    history.record("Delete Write", [[task(), null]]);

    await history.undo();
    expect(fake.created).toHaveLength(1);
    expect(fake.created[0]).not.toHaveProperty("id");
    expect(fake.created[0]).toMatchObject({ title: "Write", day: DAY });
    expect(screen.list().map((item) => item.id)).toEqual(["created-1"]);
    expect(history.resolve("t1")).toBe("created-1");

    await history.redo();
    expect(fake.deleted).toEqual(["created-1"]); // the alias, not the id the step recorded
    expect(screen.list()).toEqual([]);
  });

  it("shows a deleted block at once while it is made again, and keeps what was done to it meanwhile", async () => {
    const { history, fake, screen } = setup();
    history.record("Delete Write", [[task(), null]]);
    const release = fake.hold();

    const done = history.undo();
    expect(screen.list().map((item) => item.id)).toEqual(["t1"]); // a stand-in under the old id
    screen.seed({ ...screen.list()[0], completed: true }); // ticked before the server answered
    release();
    await done;
    expect(screen.list()).toEqual([task({ id: "created-1", completed: true })]);
  });

  it("doesn't bring back a block that a quick redo took away again", async () => {
    const { history, fake, screen } = setup();
    history.record("Delete Write", [[task(), null]]);
    const release = fake.hold();

    void history.undo();
    const done = history.redo();
    expect(screen.list()).toEqual([]);
    release();
    await done;
    expect(fake.created).toHaveLength(1);
    expect(fake.deleted).toEqual(["created-1"]);
    expect(screen.list()).toEqual([]);
  });

  it("creates on redo what it deleted on undo", async () => {
    const { history, fake, screen } = setup();
    screen.seed(task({ id: "t9" }));
    history.record("Add Write", [[null, task({ id: "t9" })]]);

    await history.undo();
    expect(fake.deleted).toEqual(["t9"]);
    expect(screen.list()).toEqual([]);

    await history.redo();
    expect(fake.created).toHaveLength(1);
    expect(screen.list().map((item) => item.id)).toEqual(["created-1"]);
  });

  it("undoes every block of a step together", async () => {
    const { history, fake, screen } = setup();
    screen.seed(task({ durationMinutes: 30 }), task({ id: "t2", startMinutes: 570, durationMinutes: 30 }));
    history.record("Split Write", [
      [task(), task({ durationMinutes: 30 })],
      [null, task({ id: "t2", startMinutes: 570, durationMinutes: 30 })],
    ]);

    await history.undo();
    expect(screen.list()).toEqual([task()]);
    expect(fake.updates).toEqual([{ id: "t1", patch: { durationMinutes: 60 } }]);
    expect(fake.deleted).toEqual(["t2"]);
  });

  it("forgets everything and asks for the blocks again when a save fails", async () => {
    const { history, fake, notices, resyncs } = setup();
    history.record("Move", [[task(), task({ startMinutes: 600 })]]);
    fake.failWith(new Error("offline"));

    await history.undo();
    expect(notices.at(-1)).toBe("Could not undo that");
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    expect(resyncs()).toBe(1);
  });

  it("can be taken step by step, for an app that saves through its own queue", async () => {
    const { history, fake, notices, screen } = setup();
    screen.seed(task({ startMinutes: 600 }));
    history.record("Move", [[task(), task({ startMinutes: 600 })]]);

    const step = history.take("undo")!;
    expect(step.direction).toBe("undo");
    expect(history.canRedo).toBe(true);
    history.preview(step);
    expect(screen.list()[0].startMinutes).toBe(540);
    await history.save(step);
    history.saved(step);
    expect(fake.updates).toEqual([{ id: "t1", patch: { startMinutes: 540 } }]);
    expect(notices.at(-1)).toBe("Undid: Move");
    expect(history.take("undo")).toBeNull();
    expect(notices.at(-1)).toBe("Nothing to undo");
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
