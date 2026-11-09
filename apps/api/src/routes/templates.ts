import {
  clampDuration,
  cleanColor,
  cleanEmoji,
  cleanNotes,
  cleanText,
  isColorKey,
  isNumeric,
  MAX_CATEGORY,
  MAX_EMOJI,
  MAX_NAME,
  type ActivityTemplate,
} from "@klndr/core";
import { Hono } from "hono";
import { canonicalCategory } from "../categories";
import type { Env } from "../env";
import { HttpError } from "../errors";
import { parseId, readJsonObject } from "../validation";

export const templates = new Hono<Env>();

templates.get("/", async (c) => c.json({ templates: await c.get("store").listTemplates() }));

templates.post("/", async (c) => {
  const body = await readJsonObject(c);
  const store = c.get("store");
  const name = cleanText(body.name, MAX_NAME);
  if (!name) throw new HttpError(400, "Name is required");

  const template = await store.createTemplate({
    name,
    emoji: cleanEmoji(body.emoji),
    color: cleanColor(body.color),
    category: await canonicalCategory(store, body.category),
    defaultDuration: clampDuration(body.defaultDuration),
    notes: cleanNotes(body.notes),
  });
  return c.json({ template }, 201);
});

templates.patch("/:id", async (c) => {
  const id = parseId(c);
  const body = await readJsonObject(c);
  const store = c.get("store");
  const patch: Partial<Omit<ActivityTemplate, "id">> = {};

  const name = cleanText(body.name, MAX_NAME);
  if (name) patch.name = name;
  if (cleanText(body.emoji, MAX_EMOJI)) patch.emoji = cleanEmoji(body.emoji);
  if (isColorKey(body.color)) patch.color = body.color;
  if (cleanText(body.category, MAX_CATEGORY)) patch.category = await canonicalCategory(store, body.category);
  if (isNumeric(body.defaultDuration)) patch.defaultDuration = clampDuration(body.defaultDuration);
  if (body.notes !== undefined) patch.notes = cleanNotes(body.notes);
  if (typeof body.archived === "boolean") patch.archived = body.archived;

  const template = await store.updateTemplate(id, patch);
  if (!template) throw new HttpError(404, "Not found");
  return c.json({ template });
});

templates.delete("/:id", async (c) => {
  const ok = await c.get("store").deleteTemplate(parseId(c));
  if (!ok) throw new HttpError(404, "Not found");
  return c.json({ ok: true });
});
