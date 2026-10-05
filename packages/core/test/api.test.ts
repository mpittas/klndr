import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiClient, type TaskDraft } from "../src/index";

type Call = { url: string; init: RequestInit };

/** Answers every request with `body`, and records what was asked of it. */
function stubFetch(body: unknown, options: { ok?: boolean; status?: number } = {}) {
  const calls: Call[] = [];
  const ok = options.ok ?? true;
  const status = options.status ?? (ok ? 200 : 500);
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return { ok, status, json: async () => body };
  });
  return calls;
}

const headersOf = (call: Call) => call.init.headers as Record<string, string>;
const bodyOf = (call: Call) => JSON.parse(String(call.init.body)) as unknown;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requests", () => {
  it("puts the base URL in front of the path, without doubling the slash", async () => {
    const calls = stubFetch({ tasks: [] });
    await createApiClient({ baseUrl: "https://api.example/" }).getTasksForDay("2026-10-03");
    expect(calls[0].url).toBe("https://api.example/api/tasks?day=2026-10-03");
    expect(calls[0].init.method).toBe("GET");
    expect(headersOf(calls[0])["Content-Type"]).toBe("application/json");
  });

  it("calls the current origin when no base URL is given", async () => {
    const calls = stubFetch({ tasks: [] });
    await createApiClient().getTasksForDay("2026-10-03");
    expect(calls[0].url).toBe("/api/tasks?day=2026-10-03");
  });

  it("asks for a range of days", async () => {
    const calls = stubFetch({ tasks: [] });
    await createApiClient().getTasksBetween("2026-09-27", "2026-11-07");
    expect(calls[0].url).toBe("/api/tasks?from=2026-09-27&to=2026-11-07");
  });

  it("sends the token when there is one", async () => {
    const calls = stubFetch({ tasks: [] });
    await createApiClient({ getToken: async () => "tok-1" }).getTasksForDay("2026-10-03");
    expect(headersOf(calls[0]).Authorization).toBe("Bearer tok-1");
  });

  it("sends no Authorization header when signed out or without a token getter", async () => {
    const calls = stubFetch({ tasks: [] });
    const api = createApiClient({ getToken: async () => null });
    await api.getTasksForDay("2026-10-03");
    await createApiClient().getTasksForDay("2026-10-03");
    expect(headersOf(calls[0])).not.toHaveProperty("Authorization");
    expect(headersOf(calls[1])).not.toHaveProperty("Authorization");
  });

  it("unwraps the payload", async () => {
    stubFetch({ tasks: [{ id: "t1" }] });
    expect(await createApiClient().getTasksForDay("2026-10-03")).toEqual([{ id: "t1" }]);
    stubFetch({ categories: [{ id: "c1" }] });
    expect(await createApiClient().getCategories()).toEqual([{ id: "c1" }]);
    stubFetch({ dayNotes: { day: "2026-10-03", text: "hi" } });
    expect(await createApiClient().getDayNotes("2026-10-03")).toEqual({ day: "2026-10-03", text: "hi" });
    stubFetch({ templates: [{ id: "a1" }] });
    expect(await createApiClient().getTemplates()).toEqual([{ id: "a1" }]);
    stubFetch({ items: [{ id: "i1" }] });
    expect(await createApiClient().getChecklistItems()).toEqual([{ id: "i1" }]);
  });

  it("asks for an emoji with the text and what it is for, and passes on a missing one", async () => {
    const calls = stubFetch({ emoji: "🏋️" });
    expect(await createApiClient().suggestEmoji("Gym", "activity")).toBe("🏋️");
    expect(calls[0].url).toBe("/api/emoji");
    expect(calls[0].init.method).toBe("POST");
    expect(bodyOf(calls[0])).toEqual({ text: "Gym", kind: "activity" });

    stubFetch({ emoji: null });
    expect(await createApiClient().suggestEmoji("???", "category")).toBeNull();
  });

  it("posts a draft as JSON", async () => {
    const calls = stubFetch({ task: { id: "t1" } });
    const draft: TaskDraft = {
      day: "2026-10-03",
      title: "Write",
      emoji: "✍️",
      color: "indigo",
      category: "Work",
      startMinutes: 540,
      durationMinutes: 60,
    };
    await createApiClient().createTask(draft);
    expect(calls[0].url).toBe("/api/tasks");
    expect(calls[0].init.method).toBe("POST");
    expect(bodyOf(calls[0])).toEqual(draft);
  });

  it("patches only what it was given", async () => {
    const calls = stubFetch({ task: { id: "t1" } });
    await createApiClient().updateTask("t1", { lane: null });
    expect(calls[0].url).toBe("/api/tasks/t1");
    expect(calls[0].init.method).toBe("PATCH");
    expect(bodyOf(calls[0])).toEqual({ lane: null });
  });

  it("puts the day in the body when saving notes", async () => {
    const calls = stubFetch({ dayNotes: { day: "2026-10-03", text: "hi" } });
    await createApiClient().saveDayNotes("2026-10-03", "hi");
    expect(calls[0].init.method).toBe("PUT");
    expect(bodyOf(calls[0])).toEqual({ day: "2026-10-03", text: "hi" });
  });

  it("encodes the category a delete hands its activities to", async () => {
    const calls = stubFetch({ ok: true });
    const api = createApiClient();
    await api.deleteCategory("c1", { moveTo: "Home & Garden" });
    await api.deleteCategory("c1", { deleteActivities: true });
    await api.deleteCategory("c1");
    expect(calls.map((call) => call.url)).toEqual([
      "/api/categories/c1?moveTo=Home%20%26%20Garden",
      "/api/categories/c1?deleteActivities=1",
      "/api/categories/c1",
    ]);
  });

  it("sends the day with a one-off item delete", async () => {
    const calls = stubFetch({ dayChecklist: {} });
    await createApiClient().removeDayChecklistExtra("2026-10-03", "e1");
    expect(calls[0].url).toBe("/api/checklist/extras/e1?day=2026-10-03");
    expect(calls[0].init.method).toBe("DELETE");
  });

  it("deletes the account with a DELETE and no body", async () => {
    const calls = stubFetch({ ok: true });
    await createApiClient().deleteAccount();
    expect(calls[0].url).toBe("/api/account");
    expect(calls[0].init.method).toBe("DELETE");
    expect(calls[0].init.body).toBeUndefined();
  });
});

describe("failures", () => {
  it("prefers our own error field", async () => {
    stubFetch({ error: "Category already exists" }, { ok: false, status: 409 });
    await expect(createApiClient().getTemplates()).rejects.toThrow("Category already exists");
  });

  it("falls back to the framework's statusMessage", async () => {
    stubFetch({ error: true, statusMessage: "Sign in required" }, { ok: false, status: 401 });
    await expect(createApiClient().getTemplates()).rejects.toThrow("Sign in required");
  });

  it("falls back to the message, then to the status", async () => {
    stubFetch({ message: "Hmm" }, { ok: false, status: 400 });
    await expect(createApiClient().getTemplates()).rejects.toThrow("Hmm");
    stubFetch({}, { ok: false, status: 503 });
    await expect(createApiClient().getTemplates()).rejects.toThrow("Request failed (503)");
  });

  it("survives a body that isn't JSON", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("not json");
      },
    }));
    await expect(createApiClient().getTemplates()).rejects.toThrow("Request failed (502)");
  });
});
