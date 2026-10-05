import type { Store } from "@klndr/core";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { JWTVerifyGetKey } from "jose";
import { firebaseKeys, requireSession } from "./auth";
import { createStoreFactory } from "./db";
import { createEmojiSuggester, type EmojiSuggester } from "./emoji";
import type { Env } from "./env";
import { errorBody, HttpError } from "./errors";
import { account } from "./routes/account";
import { categories } from "./routes/categories";
import { checklist } from "./routes/checklist";
import { emoji } from "./routes/emoji";
import { notes } from "./routes/notes";
import { tasks } from "./routes/tasks";
import { templates } from "./routes/templates";
import type { Session } from "./session";
import { createAnnouncer, deviceIdOf, rootOfPath, type Announce } from "./sync";

export type ApiConfig = {
  /** The Firebase project whose ID tokens are accepted; empty when Firebase isn't configured. */
  firebaseProjectId: string;
  /** Lets a request without credentials act as the `local-dev` user. Development only. */
  allowDevUser: boolean;
  /** Where to find the keys that sign the ID tokens. Defaults to Google's published ones. */
  keys?: JWTVerifyGetKey;
  /** Where each caller's data lives. Defaults to Firestore (or memory for the dev user). */
  storeFor?: (session: Session) => Store;
  /** Tells the caller's other devices that their data changed. Defaults to a stamp in Firestore. */
  announce?: Announce;
  /** Picks an emoji for a title. Defaults to OpenAI when `openaiApiKey` is set, and to none otherwise. */
  suggestEmoji?: EmojiSuggester;
  /** Key for the OpenAI API, which `suggestEmoji` uses. Without one the app falls back to a neutral emoji. */
  openaiApiKey?: string;
  /** The OpenAI model that picks emoji. Defaults to a small, cheap one. */
  emojiModel?: string;
};

/**
 * The klndr HTTP API as a fetch handler (`app.fetch(request)`), so the same code runs on plain Node and
 * on edge runtimes.
 *
 * Every route under `/api` except `/api/health` needs a verified Firebase ID token. The caller's token
 * is forwarded to Firestore, so `firestore.rules` is enforced for them and the server holds no admin
 * credentials.
 */
export function createApp(config: ApiConfig) {
  const keys = config.keys ?? firebaseKeys();
  const storeFor = config.storeFor ?? createStoreFactory(config.firebaseProjectId);
  const announce = config.announce ?? createAnnouncer(config.firebaseProjectId);
  const suggestEmoji =
    config.suggestEmoji ??
    (config.openaiApiKey ? createEmojiSuggester({ apiKey: config.openaiApiKey, model: config.emojiModel }) : null);

  const app = new Hono<Env>();

  app.use("*", async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
    c.header("X-Content-Type-Options", "nosniff");
  });

  // Liveness only: unauthenticated, so it deliberately reports nothing about the database.
  app.get("/api/health", (c) => c.json({ ok: true }));

  const api = new Hono<Env>();
  api.use("*", async (c, next) => {
    const session = await requireSession(c.req.header("authorization"), {
      firebaseProjectId: config.firebaseProjectId,
      allowDevUser: config.allowDevUser,
      keys,
    });
    c.set("session", session);
    c.set("store", storeFor(session));
    c.set("suggestEmoji", suggestEmoji);
    await next();

    // A saved change is announced so other devices refresh; failing to announce never fails the change.
    const root = c.req.method === "GET" ? null : rootOfPath(c.req.path);
    if (root && c.res.status < 400) {
      await announce(session, root, deviceIdOf(c.req.header("x-client-id"))).catch((err) => {
        console.error("Could not announce a change:", err);
      });
    }
  });
  api.route("/tasks", tasks);
  api.route("/templates", templates);
  api.route("/categories", categories);
  api.route("/emoji", emoji);
  api.route("/checklist", checklist);
  api.route("/notes", notes);
  api.route("/account", account);
  app.route("/api", api);

  app.notFound((c) => c.json(errorBody(404, "Not Found"), 404));
  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json(errorBody(err.status, err.message), err.status as ContentfulStatusCode);
    if (err instanceof HTTPException) return err.getResponse();
    console.error("Unhandled API error:", err);
    return c.json(errorBody(500, "Internal Server Error"), 500);
  });

  return app;
}

export type App = ReturnType<typeof createApp>;
