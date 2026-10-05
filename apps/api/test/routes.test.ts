import { MAX_DAY_EXTRAS, MAX_NOTES_LENGTH } from "@klndr/core";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { createStoreFactory } from "../src/db";
import { call, devApp } from "./helpers";

// A far-away day, so the demo schedule a fresh in-memory account starts with never gets in the way.
const DAY = "2031-01-15";

let app: ReturnType<typeof devApp>;
beforeEach(() => {
  app = devApp(); // a fresh account for every test
});

const get = (path: string) => call(app, "GET", path);
const post = (path: string, body: unknown) => call(app, "POST", path, body);
const patch = (path: string, body: unknown) => call(app, "PATCH", path, body);
const put = (path: string, body: unknown) => call(app, "PUT", path, body);
const del = (path: string) => call(app, "DELETE", path);

const newTask = (extra: Record<string, unknown> = {}) =>
  post("/api/tasks", { day: DAY, title: "Write tests", startMinutes: 540, durationMinutes: 60, ...extra });

describe("tasks", () => {
  it("creates a block and returns it with 201", async () => {
    const res = await newTask({ emoji: "🧪", color: "emerald", category: "Work", notes: "n" });
    expect(res.status).toBe(201);
    expect(res.body.task).toMatchObject({
      title: "Write tests",
      emoji: "🧪",
      color: "emerald",
      category: "Work",
      day: DAY,
      startMinutes: 540,
      durationMinutes: 60,
      notes: "n",
      completed: false,
      templateId: null,
    });
    expect(typeof res.body.task.id).toBe("string");
  });

  it("fills in defaults and cleans up what it is given", async () => {
    const res = await post("/api/tasks", {
      day: DAY,
      title: "  Padded  ",
      emoji: "",
      color: "not-a-color",
      startMinutes: 100, // rounds to the quarter hour
      durationMinutes: 7, // at least 15 minutes
    });
    expect(res.body.task).toMatchObject({
      title: "Padded",
      emoji: "📌",
      color: "indigo",
      category: "General",
      startMinutes: 105,
      durationMinutes: 15,
    });
  });

  it("keeps a block inside its day", async () => {
    const res = await newTask({ startMinutes: 99999, durationMinutes: 99999 });
    expect(res.body.task.startMinutes).toBe(24 * 60 - 15);
    expect(res.body.task.durationMinutes).toBe(24 * 60);
  });

  it("creates the category it names if it is new", async () => {
    await newTask({ category: "Zen" });
    const { body } = await get("/api/categories");
    expect(body.categories.map((c: { name: string }) => c.name)).toContain("Zen");
  });

  it("restores a block's column when it carries one (undo of a delete)", async () => {
    expect((await newTask({ lane: 2 })).body.task.lane).toBe(2);
    expect((await newTask()).body.task).not.toHaveProperty("lane");
  });

  it("only links a block to a template the user owns", async () => {
    const mine = (await get("/api/templates")).body.templates[0];
    expect((await newTask({ templateId: mine.id })).body.task.templateId).toBe(mine.id);
    expect((await newTask({ templateId: "nope" })).body.task.templateId).toBeNull();
  });

  it.each([
    ["no day", { title: "x" }, "day must be YYYY-MM-DD"],
    ["a malformed day", { day: "15/01/2031", title: "x" }, "day must be YYYY-MM-DD"],
    ["no title", { day: DAY }, "Title is required"],
    ["a blank title", { day: DAY, title: "   " }, "Title is required"],
  ])("refuses %s", async (_name, body, message) => {
    const res = await post("/api/tasks", body);
    expect(res.status).toBe(400);
    expect(res.body.statusMessage).toBe(message);
  });

  it.each([
    ["not JSON", "{oops"],
    ["a list", "[1,2]"],
    ["null", "null"],
    ["a string", '"hi"'],
  ])("refuses a body that is %s", async (_name, raw) => {
    const res = await call(app, "POST", "/api/tasks", raw);
    expect(res.status).toBe(400);
    expect(res.body.statusMessage).toBe("Expected a JSON object body");
  });

  it("lists one day, ordered by start time", async () => {
    await newTask({ title: "Late", startMinutes: 900 });
    await newTask({ title: "Early", startMinutes: 480 });
    await post("/api/tasks", { day: "2031-01-16", title: "Other day" });
    const { body } = await get(`/api/tasks?day=${DAY}`);
    expect(body.tasks.map((t: { title: string }) => t.title)).toEqual(["Early", "Late"]);
  });

  it("lists a range of days", async () => {
    await newTask({ title: "In" });
    await post("/api/tasks", { day: "2031-01-20", title: "Also in" });
    await post("/api/tasks", { day: "2031-02-20", title: "Out" });
    const { body } = await get("/api/tasks?from=2031-01-01&to=2031-01-31");
    expect(body.tasks.map((t: { title: string }) => t.title).sort()).toEqual(["Also in", "In"]);
  });

  it.each(["/api/tasks", "/api/tasks?day=nope", "/api/tasks?from=2031-01-01", "/api/tasks?from=x&to=y"])(
    "asks for a day or a range: %s",
    async (path) => {
      const res = await get(path);
      expect(res.status).toBe(400);
      expect(res.body.statusMessage).toBe("Provide ?day=YYYY-MM-DD or ?from=&to=");
    },
  );

  it("changes only the fields it is sent", async () => {
    const { id } = (await newTask({ emoji: "🧪" })).body.task;
    const res = await patch(`/api/tasks/${id}`, { title: "Renamed", startMinutes: 600, completed: true, day: "2031-01-16" });
    expect(res.status).toBe(200);
    expect(res.body.task).toMatchObject({
      title: "Renamed",
      emoji: "🧪",
      startMinutes: 600,
      durationMinutes: 60,
      completed: true,
      day: "2031-01-16",
    });
  });

  it("ignores values that aren't valid instead of storing them", async () => {
    const { id } = (await newTask()).body.task;
    const res = await patch(`/api/tasks/${id}`, { color: "nope", day: "tomorrow", startMinutes: "soon", completed: "yes" });
    expect(res.body.task).toMatchObject({ color: "indigo", day: DAY, startMinutes: 540, completed: false });
  });

  it("sets a block's column, and clears it again with null", async () => {
    const { id } = (await newTask()).body.task;
    expect((await patch(`/api/tasks/${id}`, { lane: 3 })).body.task.lane).toBe(3);
    expect((await patch(`/api/tasks/${id}`, { lane: null })).body.task).not.toHaveProperty("lane");
  });

  it("deletes a block", async () => {
    const { id } = (await newTask()).body.task;
    expect((await del(`/api/tasks/${id}`)).body).toEqual({ ok: true });
    expect((await get(`/api/tasks?day=${DAY}`)).body.tasks).toEqual([]);
  });

  it("answers 404 for a block that isn't there", async () => {
    expect((await patch("/api/tasks/9999", { title: "x" })).status).toBe(404);
    expect((await del("/api/tasks/9999")).status).toBe(404);
  });

  it.each(["has space", "a/b", "x".repeat(65), "dollar$"])("refuses the id %j", async (id) => {
    const res = await del(`/api/tasks/${encodeURIComponent(id)}`);
    expect(res.status).toBe(400);
    expect(res.body.statusMessage).toBe("Invalid id");
  });
});

describe("templates (activities)", () => {
  it("starts a new account with the default activities", async () => {
    const { body } = await get("/api/templates");
    expect(body.templates.length).toBeGreaterThan(5);
    expect(body.templates[0]).toMatchObject({ archived: false });
  });

  it("creates, edits and deletes one", async () => {
    const created = await post("/api/templates", { name: " Reading ", emoji: "📖", color: "sky", category: "Growth", defaultDuration: 40 });
    expect(created.status).toBe(201);
    expect(created.body.template).toMatchObject({ name: "Reading", emoji: "📖", color: "sky", category: "Growth", defaultDuration: 45, archived: false });

    const { id } = created.body.template;
    const edited = await patch(`/api/templates/${id}`, { name: "Deep reading", archived: true, defaultDuration: 90 });
    expect(edited.body.template).toMatchObject({ name: "Deep reading", archived: true, defaultDuration: 90, emoji: "📖" });

    expect((await del(`/api/templates/${id}`)).body).toEqual({ ok: true });
    expect((await del(`/api/templates/${id}`)).status).toBe(404);
  });

  it("needs a name", async () => {
    const res = await post("/api/templates", { emoji: "📖" });
    expect(res.status).toBe(400);
    expect(res.body.statusMessage).toBe("Name is required");
  });

  it("recolors the blocks made from it", async () => {
    const template = (await post("/api/templates", { name: "Run", color: "rose" })).body.template;
    await newTask({ templateId: template.id, color: "rose" });
    await patch(`/api/templates/${template.id}`, { color: "teal" });
    expect((await get(`/api/tasks?day=${DAY}`)).body.tasks[0].color).toBe("teal");
  });
});

describe("categories", () => {
  const names = async () =>
    (await get("/api/categories")).body.categories.map((c: { name: string }) => c.name);

  it("starts with the categories of the default activities", async () => {
    expect(await names()).toEqual(expect.arrayContaining(["Home", "Work", "Health"]));
  });

  it("creates one, with a default color for an unknown one", async () => {
    const res = await post("/api/categories", { name: "  Music ", color: "mystery" });
    expect(res.status).toBe(201);
    expect(res.body.category).toMatchObject({ name: "Music", color: "indigo" });
  });

  it("keeps the emoji it is given, and can change it later", async () => {
    const created = await post("/api/categories", { name: "Music", emoji: "🎸" });
    expect(created.body.category.emoji).toBe("🎸");
    const changed = await patch(`/api/categories/${created.body.category.id}`, { emoji: "🎹" });
    expect(changed.body.category.emoji).toBe("🎹");
    expect((await get("/api/categories")).body.categories.find((c: { name: string }) => c.name === "Music").emoji).toBe("🎹");
  });

  it("has no emoji until one is given, and ignores an empty one", async () => {
    const created = await post("/api/categories", { name: "Music", emoji: "  " });
    expect(created.body.category).not.toHaveProperty("emoji");
    const patched = await patch(`/api/categories/${created.body.category.id}`, { color: "rose", emoji: "" });
    expect(patched.body.category).not.toHaveProperty("emoji");
  });

  it("refuses a name that is taken, whatever its case", async () => {
    const res = await post("/api/categories", { name: "work" });
    expect(res.status).toBe(409);
    expect(res.body.statusMessage).toBe("A category with that name already exists");
  });

  it("needs a name", async () => {
    expect((await post("/api/categories", { name: " " })).status).toBe(400);
  });

  it("renames one and takes its activities and blocks along", async () => {
    const category = (await post("/api/categories", { name: "Music" })).body.category;
    await post("/api/templates", { name: "Guitar", category: "Music" });
    await newTask({ category: "Music" });

    const res = await patch(`/api/categories/${category.id}`, { name: "Band", color: "rose" });
    expect(res.body.category).toMatchObject({ name: "Band", color: "rose" });
    expect((await get(`/api/tasks?day=${DAY}`)).body.tasks[0].category).toBe("Band");
    const templates = (await get("/api/templates")).body.templates;
    expect(templates.find((t: { name: string }) => t.name === "Guitar").category).toBe("Band");
  });

  it("won't rename to nothing or to a name that is taken", async () => {
    const category = (await post("/api/categories", { name: "Music" })).body.category;
    const empty = await patch(`/api/categories/${category.id}`, { name: "  " });
    expect(empty.status).toBe(400);
    expect(empty.body.statusMessage).toBe("Name can't be empty");
    expect((await patch(`/api/categories/${category.id}`, { name: "Home" })).status).toBe(409);
  });

  it("answers 404 for a category that isn't there", async () => {
    expect((await patch("/api/categories/9999", { color: "rose" })).status).toBe(404);
    expect((await del("/api/categories/9999")).status).toBe(404);
  });

  it("makes you choose where the activities of a deleted category go", async () => {
    const home = (await get("/api/categories")).body.categories.find((c: { name: string }) => c.name === "Home");
    const res = await del(`/api/categories/${home.id}`);
    expect(res.status).toBe(400);
    expect(res.body.statusMessage).toBe("Choose a category to move its activities to");

    const missing = await del(`/api/categories/${home.id}?moveTo=Nowhere`);
    expect(missing.status).toBe(400);
    expect(missing.body.statusMessage).toBe("That category to move to doesn't exist");
  });

  it("moves the activities to another category when deleting", async () => {
    const home = (await get("/api/categories")).body.categories.find((c: { name: string }) => c.name === "Home");
    expect((await del(`/api/categories/${home.id}?moveTo=Work`)).body).toEqual({ ok: true });
    expect(await names()).not.toContain("Home");
    const templates = (await get("/api/templates")).body.templates;
    expect(templates.some((t: { category: string }) => t.category === "Home")).toBe(false);
    expect(templates.find((t: { name: string }) => t.name === "Cleaning").category).toBe("Work");
  });

  it("deletes the activities with it when asked to", async () => {
    const home = (await get("/api/categories")).body.categories.find((c: { name: string }) => c.name === "Home");
    await del(`/api/categories/${home.id}?deleteActivities=1`);
    const templates = (await get("/api/templates")).body.templates;
    expect(templates.some((t: { name: string }) => t.name === "Cleaning")).toBe(false);
  });

  it("deletes an unused category without asking where to move anything", async () => {
    const category = (await post("/api/categories", { name: "Empty" })).body.category;
    expect((await del(`/api/categories/${category.id}`)).status).toBe(200);
  });
});

describe("checklist", () => {
  it("starts with the default routines", async () => {
    const { body } = await get("/api/checklist/items");
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.map((i: { order: number }) => i.order)).toEqual([...body.items.map((i: { order: number }) => i.order)].sort((a, b) => a - b));
  });

  it("creates, edits and deletes an item", async () => {
    const created = await post("/api/checklist/items", { title: " Floss ", emoji: "🦷" });
    expect(created.status).toBe(201);
    expect(created.body.item).toMatchObject({ title: "Floss", emoji: "🦷", archived: false });

    const { id } = created.body.item;
    const edited = await patch(`/api/checklist/items/${id}`, { title: "Floss well", order: 99, archived: true });
    expect(edited.body.item).toMatchObject({ title: "Floss well", order: 99, archived: true });
    // archived items are left out of the list
    expect((await get("/api/checklist/items")).body.items.some((i: { id: string }) => i.id === id)).toBe(false);

    expect((await del(`/api/checklist/items/${id}`)).body).toEqual({ ok: true });
    expect((await del(`/api/checklist/items/${id}`)).status).toBe(404);
  });

  it("needs a title", async () => {
    const res = await post("/api/checklist/items", { emoji: "🦷" });
    expect(res.status).toBe(400);
    expect(res.body.statusMessage).toBe("Title is required");
  });

  it("ticks an item for one day and unticks it", async () => {
    const item = (await post("/api/checklist/items", { title: "Floss" })).body.item;
    const on = await post("/api/checklist/toggle", { day: DAY, itemId: item.id, completed: true });
    expect(on.body.dayChecklist).toMatchObject({ day: DAY, completedItemIds: [item.id] });
    expect((await get(`/api/checklist/day?day=${DAY}`)).body.dayChecklist.completedItemIds).toEqual([item.id]);
    // another day is untouched
    expect((await get("/api/checklist/day?day=2031-01-16")).body.dayChecklist.completedItemIds).toEqual([]);

    const off = await post("/api/checklist/toggle", { day: DAY, itemId: item.id, completed: false });
    expect(off.body.dayChecklist.completedItemIds).toEqual([]);
  });

  it("skips an item for one day and brings it back", async () => {
    const item = (await post("/api/checklist/items", { title: "Floss" })).body.item;
    const hidden = await post("/api/checklist/hide", { day: DAY, itemId: item.id, hidden: true });
    expect(hidden.body.dayChecklist.hiddenItemIds).toEqual([item.id]);
    const shown = await post("/api/checklist/hide", { day: DAY, itemId: item.id, hidden: false });
    expect(shown.body.dayChecklist.hiddenItemIds).toEqual([]);
  });

  it("adds and removes a one-off item for a day", async () => {
    const added = await post("/api/checklist/extras", { day: DAY, title: " Call mum ", emoji: "📞" });
    expect(added.status).toBe(201);
    const [extra] = added.body.dayChecklist.extraItems;
    expect(extra).toMatchObject({ title: "Call mum", emoji: "📞" });

    const removed = await del(`/api/checklist/extras/${extra.id}?day=${DAY}`);
    expect(removed.body.dayChecklist.extraItems).toEqual([]);
  });

  it("limits the one-off items of a day", async () => {
    for (let i = 0; i < MAX_DAY_EXTRAS; i += 1) {
      expect((await post("/api/checklist/extras", { day: DAY, title: `Item ${i}` })).status).toBe(201);
    }
    const res = await post("/api/checklist/extras", { day: DAY, title: "One too many" });
    expect(res.status).toBe(400);
    expect(res.body.statusMessage).toBe(`A day can have at most ${MAX_DAY_EXTRAS} one-off items`);
  });

  it("falls back to today when no day is asked for", async () => {
    const { body } = await get("/api/checklist/day");
    expect(body.dayChecklist.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((await get("/api/checklist/day?day=garbage")).body.dayChecklist.day).toBe(body.dayChecklist.day);
  });

  it.each([
    ["toggle", "POST", "/api/checklist/toggle", { day: "x", itemId: "1" }, "Invalid day format (YYYY-MM-DD)"],
    ["toggle", "POST", "/api/checklist/toggle", { day: DAY, itemId: "no way" }, "Invalid itemId"],
    ["hide", "POST", "/api/checklist/hide", { day: "x", itemId: "1" }, "Invalid day format (YYYY-MM-DD)"],
    ["hide", "POST", "/api/checklist/hide", { day: DAY }, "Invalid itemId"],
    ["extras", "POST", "/api/checklist/extras", { day: "x", title: "t" }, "Invalid day format (YYYY-MM-DD)"],
    ["extras", "POST", "/api/checklist/extras", { day: DAY, title: " " }, "Title is required"],
    ["remove extra", "DELETE", "/api/checklist/extras/1", undefined, "Invalid day format (YYYY-MM-DD)"],
  ])("refuses bad input to %s", async (_name, method, path, body, message) => {
    const res = await call(app, method, path, body);
    expect(res.status).toBe(400);
    expect(res.body.statusMessage).toBe(message);
  });
});

describe("notes", () => {
  it("saves a day's notes and reads them back", async () => {
    const saved = await put("/api/notes", { day: DAY, text: "- [ ] call\n**bold**" });
    expect(saved.body.dayNotes).toEqual({ day: DAY, text: "- [ ] call\n**bold**" });
    expect((await get(`/api/notes?day=${DAY}`)).body.dayNotes.text).toBe("- [ ] call\n**bold**");
    expect((await get("/api/notes?day=2031-01-16")).body.dayNotes).toEqual({ day: "2031-01-16", text: "" });
  });

  it("falls back to today when no day is asked for", async () => {
    expect((await get("/api/notes")).body.dayNotes.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("accepts notes right up to the limit and refuses more", async () => {
    expect((await put("/api/notes", { day: DAY, text: "a".repeat(MAX_NOTES_LENGTH) })).status).toBe(200);
    const res = await put("/api/notes", { day: DAY, text: "a".repeat(MAX_NOTES_LENGTH + 1) });
    expect(res.status).toBe(413);
    expect(res.body.statusMessage).toBe(`Notes can be at most ${MAX_NOTES_LENGTH} characters`);
  });

  it.each([
    [{ day: "x", text: "t" }, "Invalid day format (YYYY-MM-DD)"],
    [{ day: DAY, text: 5 }, "Notes must be text"],
    [{ day: DAY }, "Notes must be text"],
  ])("refuses %j", async (body, message) => {
    const res = await put("/api/notes", body);
    expect(res.status).toBe(400);
    expect(res.body.statusMessage).toBe(message);
  });
});

describe("account", () => {
  it("deletes everything the user has", async () => {
    await newTask();
    await put("/api/notes", { day: DAY, text: "hello" });
    await post("/api/checklist/extras", { day: DAY, title: "x" });

    expect((await del("/api/account")).body).toEqual({ ok: true });

    expect((await get(`/api/tasks?day=${DAY}`)).body.tasks).toEqual([]);
    expect((await get("/api/templates")).body.templates).toEqual([]);
    expect((await get("/api/categories")).body.categories).toEqual([]);
    expect((await get("/api/checklist/items")).body.items).toEqual([]);
    expect((await get(`/api/notes?day=${DAY}`)).body.dayNotes.text).toBe("");
    expect((await get(`/api/checklist/day?day=${DAY}`)).body.dayChecklist.extraItems).toEqual([]);
  });
});

describe("accounts are separate", () => {
  it("never shows one user another's data", async () => {
    const memory = createStoreFactory("");
    // Two apps over the same stores, serving different people (the real app picks the user from the token).
    const as = (userId: string) =>
      createApp({ firebaseProjectId: "", allowDevUser: true, storeFor: () => memory({ userId, idToken: null }) });
    const alice = as("alice");
    const bob = as("bob");

    await call(alice, "POST", "/api/tasks", { day: DAY, title: "Alice's secret" });
    expect((await call(alice, "GET", `/api/tasks?day=${DAY}`)).body.tasks).toHaveLength(1);
    expect((await call(bob, "GET", `/api/tasks?day=${DAY}`)).body.tasks).toEqual([]);
  });
});
