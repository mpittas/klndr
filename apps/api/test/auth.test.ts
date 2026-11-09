import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { createStoreFactory } from "../src/db";
import type { Session } from "../src/session";
import { call, devApp } from "./helpers";

const PROJECT = "klndr-test";

let privateKey: CryptoKey;
let keys: ReturnType<typeof createLocalJWKSet>;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(pair.publicKey)), alg: "RS256", kid: "test" }] });
});

const token = (claims: { sub?: string; iss?: string; aud?: string; exp?: string } = {}) =>
  new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: "test" })
    .setSubject(claims.sub ?? "user-1")
    .setIssuer(claims.iss ?? `https://securetoken.google.com/${PROJECT}`)
    .setAudience(claims.aud ?? PROJECT)
    .setIssuedAt()
    .setExpirationTime(claims.exp ?? "1h")
    .sign(privateKey);

/** An app that verifies real tokens and records who each request was served for. */
function verifyingApp() {
  const served: Session[] = [];
  const memory = createStoreFactory("");
  const app = createApp({
    firebaseProjectId: PROJECT,
    allowDevUser: false,
    keys,
    storeFor: (session) => {
      served.push(session);
      return memory({ ...session, idToken: null }); // no Firestore in tests
    },
  });
  return { app, served };
}

const bearer = (value: string) => ({ Authorization: `Bearer ${value}` });

describe("health", () => {
  it("answers without credentials and reveals nothing else", async () => {
    const { app } = verifyingApp();
    const res = await call(app, "GET", "/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("is still up when authentication isn't configured", async () => {
    const res = await call(createApp({ firebaseProjectId: "", allowDevUser: false }), "GET", "/api/health");
    expect(res.status).toBe(200);
  });

  it("is never cached, and never sniffed", async () => {
    const res = await call(devApp(), "GET", "/api/health");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });
});

describe("authentication", () => {
  it("refuses everything when Firebase isn't configured and dev mode is off (fails closed)", async () => {
    const app = createApp({ firebaseProjectId: "", allowDevUser: false });
    const res = await call(app, "GET", "/api/tasks?day=2026-10-05");
    expect(res.status).toBe(503);
    expect(res.body.statusMessage).toBe("Authentication is not configured");
  });

  it("requires a token once Firebase is configured", async () => {
    const { app } = verifyingApp();
    const res = await call(app, "GET", "/api/tasks?day=2026-10-05");
    expect(res.status).toBe(401);
    expect(res.body.statusMessage).toBe("Sign in required");
  });

  it("ignores an Authorization header that isn't a bearer token", async () => {
    const { app } = verifyingApp();
    const res = await call(app, "GET", "/api/tasks?day=2026-10-05", undefined, { Authorization: "Basic abc" });
    expect(res.status).toBe(401);
    expect(res.body.statusMessage).toBe("Sign in required");
  });

  it("serves the verified user, with their token kept to forward to Firestore", async () => {
    const { app, served } = verifyingApp();
    const jwt = await token({ sub: "alice" });
    const res = await call(app, "GET", "/api/tasks?day=2026-10-05", undefined, bearer(jwt));
    expect(res.status).toBe(200);
    expect(served).toEqual([{ userId: "alice", idToken: jwt }]);
  });

  it.each([
    ["garbage", async () => "not-a-jwt"],
    ["another project's token", async () => token({ aud: "other", iss: "https://securetoken.google.com/other" })],
    ["a wrong issuer", async () => token({ iss: "https://evil.example" })],
    ["a wrong audience", async () => token({ aud: "other" })],
    ["an expired token", async () => token({ exp: "-1m" })],
  ])("rejects %s", async (_name, make) => {
    const { app, served } = verifyingApp();
    const res = await call(app, "GET", "/api/tasks?day=2026-10-05", undefined, bearer(await make()));
    expect(res.status).toBe(401);
    expect(res.body.statusMessage).toBe("Invalid or expired session");
    expect(served).toEqual([]); // no store was ever built for them
  });

  it("rejects a token signed with a key Google doesn't publish", async () => {
    const { app } = verifyingApp();
    const other = await generateKeyPair("RS256");
    const forged = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setSubject("mallory")
      .setIssuer(`https://securetoken.google.com/${PROJECT}`)
      .setAudience(PROJECT)
      .setExpirationTime("1h")
      .sign(other.privateKey);
    const res = await call(app, "GET", "/api/tasks?day=2026-10-05", undefined, bearer(forged));
    expect(res.status).toBe(401);
  });

  it("lets a request without credentials act as local-dev only when dev mode is on", async () => {
    const res = await call(devApp(), "GET", "/api/tasks?day=2026-10-05");
    expect(res.status).toBe(200);

    const configuredButDev = createApp({ firebaseProjectId: PROJECT, allowDevUser: true, keys });
    expect((await call(configuredButDev, "GET", "/api/tasks?day=2026-10-05")).status).toBe(200);
    // ...but a bad token is still refused, even in dev
    const bad = await call(configuredButDev, "GET", "/api/tasks?day=2026-10-05", undefined, bearer("nope"));
    expect(bad.status).toBe(401);
  });

  it("keeps each dev user's data apart", async () => {
    const memory = createStoreFactory("");
    const a = memory({ userId: "a", idToken: null });
    const again = memory({ userId: "a", idToken: null });
    const b = memory({ userId: "b", idToken: null });
    expect(again).toBe(a);
    expect(b).not.toBe(a);
  });
});

describe("errors", () => {
  it("answers unknown routes with the usual error body, after checking who is asking", async () => {
    const { app } = verifyingApp();
    expect((await call(app, "GET", "/api/nope")).status).toBe(401);

    const res = await call(devApp(), "GET", "/api/nope");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: true, statusCode: 404, statusMessage: "Not Found", message: "Not Found" });
  });

  it("carries the message under every key the clients read", async () => {
    const res = await call(devApp(), "POST", "/api/tasks", { day: "bad" });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: true,
      statusCode: 400,
      statusMessage: "day must be YYYY-MM-DD",
      message: "day must be YYYY-MM-DD",
    });
  });

  it("hides the details of an unexpected failure", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = createApp({
      firebaseProjectId: "",
      allowDevUser: true,
      storeFor: () => {
        throw new Error("secret database detail");
      },
    });
    const res = await call(app, "GET", "/api/tasks?day=2026-10-05");
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("secret");
    expect(logged).toHaveBeenCalled(); // it is logged on the server, just not sent to the caller
    logged.mockRestore();
  });
});
