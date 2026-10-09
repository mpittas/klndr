import { describe, expect, it } from "vitest";
import { MemoryStore, type MemorySnapshot } from "../src/index";

// A far-away day, so the demo schedule a fresh store starts with never gets in the way.
const DAY = "2031-01-15";

/** The snapshot as it would come back from `localStorage`: plain JSON, read again. */
const roundTrip = (snapshot: MemorySnapshot): MemorySnapshot => JSON.parse(JSON.stringify(snapshot));

describe("MemoryStore snapshots", () => {
  it("carries on with the same data, after a save and a load", async () => {
    const store = new MemoryStore();
    const task = await store.createTask({
      templateId: null,
      title: "Saved block",
      emoji: "💾",
      color: "emerald",
      category: "Work",
      day: DAY,
      startMinutes: 540,
      durationMinutes: 60,
      notes: null,
      completed: false,
    });
    await store.setDayNotes(DAY, "Remember this");

    const restored = new MemoryStore(roundTrip(store.snapshot()));

    expect(await restored.listTasksForDay(DAY)).toEqual([task]);
    expect((await restored.getDayNotes(DAY)).text).toBe("Remember this");
  });

  it("does not hand out an id a saved item already has", async () => {
    const store = new MemoryStore();
    const before = await store.listTemplates();

    const restored = new MemoryStore(roundTrip(store.snapshot()));
    const added = await restored.createTemplate({
      name: "New",
      emoji: "⭐",
      color: "emerald",
      category: "Work",
      defaultDuration: 30,
      notes: null,
    });

    expect(before.map((template) => template.id)).not.toContain(added.id);
  });

  it("starts from the demo data only when there is nothing saved", async () => {
    expect((await new MemoryStore().listTemplates()).length).toBeGreaterThan(0);

    const empty = new MemoryStore({
      seq: 1,
      templates: [],
      categories: [],
      tasks: [],
      checklistItems: [],
      checklistDays: [],
      notes: [],
    });
    expect(await empty.listTemplates()).toEqual([]);
  });
});
