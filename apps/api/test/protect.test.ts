import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { createRateLimiter, MAX_BODY_BYTES } from "../src/protect";
import { call } from "./helpers";

const minute = 60_000;
const tight = (overrides: Partial<{ ip: number; user: number; ai: number }> = {}) =>
  createApp({
    firebaseProjectId: "",
    allowDevUser: true,
    suggestEmoji: async () => "🧹",
    rateLimits: {
      perIp: { limit: overrides.ip ?? 1000, windowMs: minute },
      perUser: { limit: overrides.user ?? 1000, windowMs: minute },
      ai: { limit: overrides.ai ?? 1000, windowMs: minute },
    },
  });

describe("createRateLimiter", () => {
  it("allows up to the limit in a window, then refuses with the time left", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 10_000 });
    expect(limiter("a", 0)).toEqual({ ok: true });
    expect(limiter("a", 1)).toEqual({ ok: true });
    expect(limiter("a", 2_000)).toEqual({ ok: false, retryAfterSeconds: 8 });
    // Another key has its own count.
    expect(limiter("b", 2_000)).toEqual({ ok: true });
    // A new window starts over.
    expect(limiter("a", 10_000)).toEqual({ ok: true });
  });

  it("stays bounded when flooded with distinct keys", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 10_000 }, 100);
    for (let i = 0; i < 10_000; i++) expect(limiter(`k${i}`, 0)).toEqual({ ok: true });
    // Recent keys are still counted after the sweeps.
    expect(limiter("k9999", 1).ok).toBe(false);
  });
});

describe("API protection", () => {
  it("limits each user and says when to retry", async () => {
    const app = tight({ user: 3 });
    for (let i = 0; i < 3; i++) expect((await call(app, "GET", "/api/tasks?day=2026-01-01")).status).toBe(200);
    const refused = await call(app, "GET", "/api/tasks?day=2026-01-01");
    expect(refused.status).toBe(429);
    expect(refused.body.message).toMatch(/too many requests/i);
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("limits the AI routes more tightly than the rest", async () => {
    const app = tight({ ai: 2 });
    for (let i = 0; i < 2; i++) expect((await call(app, "POST", "/api/emoji", { text: "Clean" })).status).toBe(200);
    expect((await call(app, "POST", "/api/emoji", { text: "Clean" })).status).toBe(429);
    // Other routes are unaffected.
    expect((await call(app, "GET", "/api/templates")).status).toBe(200);
  });

  it("limits by IP before the token is checked", async () => {
    const app = createApp({
      firebaseProjectId: "demo-project",
      allowDevUser: false,
      rateLimits: {
        perIp: { limit: 2, windowMs: minute },
        perUser: { limit: 1000, windowMs: minute },
        ai: { limit: 1000, windowMs: minute },
      },
    });
    const from = (ip: string) => ({ "x-real-ip": ip });
    expect((await call(app, "GET", "/api/tasks", undefined, from("1.1.1.1"))).status).toBe(401);
    expect((await call(app, "GET", "/api/tasks", undefined, from("1.1.1.1"))).status).toBe(401);
    expect((await call(app, "GET", "/api/tasks", undefined, from("1.1.1.1"))).status).toBe(429);
    expect((await call(app, "GET", "/api/tasks", undefined, from("2.2.2.2"))).status).toBe(401);
  });

  it("refuses bodies that are too large", async () => {
    const app = tight();
    const response = await call(app, "PUT", "/api/notes", { day: "2026-01-01", text: "x".repeat(MAX_BODY_BYTES) });
    expect(response.status).toBe(413);
    expect(response.body.error).toBe(true);
  });

  it("sends hardened headers on every response", async () => {
    const { headers } = await call(tight(), "GET", "/api/health");
    expect(headers.get("cache-control")).toBe("no-store");
    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(headers.get("x-frame-options")).toBe("DENY");
    expect(headers.get("strict-transport-security")).toContain("max-age=");
  });

  it("can be turned off", async () => {
    const app = createApp({ firebaseProjectId: "", allowDevUser: true, rateLimits: false });
    for (let i = 0; i < 5; i++) expect((await call(app, "GET", "/api/templates")).status).toBe(200);
  });
});
