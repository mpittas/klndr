import { Hono } from "hono";
import type { Env } from "../env";

export const account = new Hono<Env>();

/**
 * Delete every document the caller owns: the collections, the one-time seed markers, then the profile
 * document. The client deletes the Auth user itself afterwards, because Firebase only lets the signed
 * in user do that (and asks for a recent sign-in, which is why the UI re-authenticates first).
 */
account.delete("/", async (c) => {
  await c.get("store").deleteAccount();
  return c.json({ ok: true });
});
