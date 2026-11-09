import { cleanText, isEmojiKind, MAX_TITLE } from "@klndr/core";
import { Hono } from "hono";
import type { Env } from "../env";
import { HttpError } from "../errors";
import { readJsonObject } from "../validation";

export const emoji = new Hono<Env>();

/**
 * Suggest an emoji for a title. Best effort by design: when there is no model configured, or it fails, the
 * answer is `{ emoji: null }` rather than an error, and the app picks one itself.
 */
emoji.post("/", async (c) => {
  const body = await readJsonObject(c);
  const text = cleanText(body.text, MAX_TITLE);
  if (!text) throw new HttpError(400, "Text is required");
  const kind = isEmojiKind(body.kind) ? body.kind : "activity";

  const suggest = c.get("suggestEmoji");
  return c.json({ emoji: suggest ? await suggest(text, kind) : null });
});
