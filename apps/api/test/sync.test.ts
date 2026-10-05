import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { deviceIdOf, rootOfPath } from "../src/sync";
import { call } from "./helpers";

const appWithAnnouncer = (announce: (root: string, deviceId: string) => Promise<void>) =>
  createApp({ firebaseProjectId: "", allowDevUser: true, announce: (_session, root, id) => announce(root, id) });

const task = { day: "2031-01-15", title: "Sync", startMinutes: 540, durationMinutes: 60 };

describe("announcing changes to other devices", () => {
  it("announces each saved change, as the device that made it", async () => {
    const sent: string[] = [];
    const app = appWithAnnouncer(async (root, id) => void sent.push(`${root}:${id}`));

    const created = await call(app, "POST", "/api/tasks", task, { "X-Client-Id": "device-1" });
    await call(app, "PATCH", `/api/tasks/${created.body.task.id}`, { completed: true }, { "X-Client-Id": "device-1" });
    await call(app, "PUT", "/api/notes", { day: task.day, text: "hi" });
    await call(app, "DELETE", `/api/tasks/${created.body.task.id}`);

    expect(sent).toEqual(["tasks:device-1", "tasks:device-1", "notes:unknown", "tasks:unknown"]);
  });

  it("stays quiet for reads and for changes that failed", async () => {
    const sent: string[] = [];
    const app = appWithAnnouncer(async (root) => void sent.push(root));

    await call(app, "GET", "/api/tasks?day=2031-01-15");
    const bad = await call(app, "POST", "/api/tasks", { title: "no day" });
    expect(bad.status).toBe(400);
    expect(sent).toEqual([]);
  });

  it("never fails the change when announcing fails", async () => {
    const app = appWithAnnouncer(async () => {
      throw new Error("firestore is down");
    });
    const res = await call(app, "POST", "/api/tasks", task);
    expect(res.status).toBe(201);
  });

  it("maps routes to the kind of data they change", () => {
    expect(rootOfPath("/api/tasks/abc")).toBe("tasks");
    expect(rootOfPath("/api/checklist/items")).toBe("checklist");
    expect(rootOfPath("/api/emoji")).toBeNull();
    expect(rootOfPath("/api/account")).toBeNull();
    expect(rootOfPath("/api/health")).toBeNull();
  });

  it("only accepts a device id of the expected shape", () => {
    expect(deviceIdOf("3f2b-ab12")).toBe("3f2b-ab12");
    expect(deviceIdOf("a:b")).toBe("unknown");
    expect(deviceIdOf(undefined)).toBe("unknown");
  });
});
