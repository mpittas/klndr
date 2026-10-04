import { createApiClient, type ApiClient } from "@klndr/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { devApp } from "./helpers";

// The API client in @klndr/core is what the web and mobile apps call. Pointing it at this app (with
// `fetch` routed straight into it) checks that every method still matches a route, its URL, its body
// and the shape of what comes back, so the two can't drift apart unnoticed.

const DAY = "2031-03-10";
const sent: Array<{ method: string; url: string; authorization: string | null }> = [];
let client: ApiClient;

beforeEach(() => {
  const app = devApp();
  sent.length = 0;
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    const request = new Request(url, init);
    sent.push({ method: request.method, url, authorization: request.headers.get("authorization") });
    return app.fetch(request);
  });
  client = createApiClient({ baseUrl: "http://api.test/", getToken: async () => "token-123" });
});

afterEach(() => vi.unstubAllGlobals());

describe("the core API client against the API", () => {
  it("sends the base URL, a normalised path and the bearer token", async () => {
    await client.getTasksForDay(DAY);
    expect(sent).toEqual([{ method: "GET", url: `http://api.test/api/tasks?day=${DAY}`, authorization: "Bearer token-123" }]);
  });

  it("works through tasks", async () => {
    const created = await client.createTask({
      day: DAY, title: "Plan", emoji: "🗓️", color: "sky", category: "Work", startMinutes: 480, durationMinutes: 30,
    });
    expect(created).toMatchObject({ title: "Plan", day: DAY, startMinutes: 480 });

    expect(await client.getTasksForDay(DAY)).toEqual([created]);
    expect(await client.getTasksBetween("2031-03-01", "2031-03-31")).toEqual([created]);

    const moved = await client.updateTask(created.id, { startMinutes: 600, lane: 1, completed: true });
    expect(moved).toMatchObject({ startMinutes: 600, lane: 1, completed: true });
    expect(await client.updateTask(created.id, { lane: null })).not.toHaveProperty("lane");

    await client.deleteTask(created.id);
    expect(await client.getTasksForDay(DAY)).toEqual([]);
  });

  it("works through activities", async () => {
    const created = await client.createTemplate({
      name: "Pottery", emoji: "🏺", color: "orange", category: "Crafts", defaultDuration: 90, notes: null,
    });
    expect(created).toMatchObject({ name: "Pottery", category: "Crafts", defaultDuration: 90, archived: false });
    expect(await client.getTemplates()).toContainEqual(created);

    const edited = await client.updateTemplate(created.id, { name: "Ceramics", archived: true });
    expect(edited).toMatchObject({ name: "Ceramics", archived: true });

    await client.deleteTemplate(created.id);
    expect((await client.getTemplates()).some((t) => t.id === created.id)).toBe(false);
  });

  it("works through categories, in all three ways of deleting one", async () => {
    const music = await client.createCategory({ name: "Music", color: "violet" });
    expect(await client.getCategories()).toContainEqual(music);
    expect(await client.updateCategory(music.id, { color: "rose" })).toMatchObject({ name: "Music", color: "rose" });

    await client.createTemplate({ name: "Guitar", emoji: "🎸", color: "rose", category: "Music", defaultDuration: 60, notes: null });
    await expect(client.deleteCategory(music.id)).rejects.toThrow("Choose a category to move its activities to");
    await client.deleteCategory(music.id, { moveTo: "Work" });
    expect((await client.getTemplates()).find((t) => t.name === "Guitar")?.category).toBe("Work");

    const art = await client.createCategory({ name: "Art", color: "pink" });
    await client.createTemplate({ name: "Paint", emoji: "🎨", color: "pink", category: "Art", defaultDuration: 60, notes: null });
    await client.deleteCategory(art.id, { deleteActivities: true });
    expect((await client.getTemplates()).some((t) => t.name === "Paint")).toBe(false);

    const empty = await client.createCategory({ name: "Empty", color: "lime" });
    await client.deleteCategory(empty.id); // nothing to move
    expect((await client.getCategories()).some((c) => c.id === empty.id)).toBe(false);
  });

  it("works through the checklist", async () => {
    const item = await client.createChecklistItem({ title: "Floss", emoji: "🦷" });
    expect(await client.getChecklistItems()).toContainEqual(item);
    expect(await client.updateChecklistItem(item.id, { title: "Floss well" })).toMatchObject({ title: "Floss well" });

    expect((await client.toggleChecklistItem(DAY, item.id, true)).completedItemIds).toEqual([item.id]);
    expect((await client.hideChecklistItem(DAY, item.id, true)).hiddenItemIds).toEqual([item.id]);

    const withExtra = await client.addDayChecklistExtra(DAY, { title: "Call mum", emoji: "📞" });
    expect(withExtra.extraItems).toHaveLength(1);
    expect(await client.getDayChecklist(DAY)).toEqual(withExtra);
    expect((await client.removeDayChecklistExtra(DAY, withExtra.extraItems[0].id)).extraItems).toEqual([]);

    await client.deleteChecklistItem(item.id);
    expect((await client.getChecklistItems()).some((i) => i.id === item.id)).toBe(false);
  });

  it("works through notes", async () => {
    expect(await client.getDayNotes(DAY)).toEqual({ day: DAY, text: "" });
    expect(await client.saveDayNotes(DAY, "- [ ] one")).toEqual({ day: DAY, text: "- [ ] one" });
    expect(await client.getDayNotes(DAY)).toEqual({ day: DAY, text: "- [ ] one" });
  });

  it("deletes the account's data", async () => {
    await client.createTask({
      day: DAY, title: "Plan", emoji: "🗓️", color: "sky", category: "Work", startMinutes: 480, durationMinutes: 30,
    });
    await client.deleteAccount();
    expect(await client.getTasksForDay(DAY)).toEqual([]);
    expect(await client.getTemplates()).toEqual([]);
  });

  it("turns the API's message into the error the app shows", async () => {
    await expect(client.createTask({
      day: "nope", title: "x", emoji: "", color: "", category: "", startMinutes: 0, durationMinutes: 15,
    })).rejects.toThrow("day must be YYYY-MM-DD");
    await expect(client.updateTask("9999", { title: "x" })).rejects.toThrow("Not found");
  });
});
