import {
  cleanEmoji,
  cleanText,
  isDocId,
  isValidISODate,
  MAX_EMOJI,
  MAX_TITLE,
  todayISO,
  type ChecklistItem,
} from "@klndr/core";
import { Hono } from "hono";
import type { Env } from "../env";
import { HttpError } from "../errors";
import { parseId, readJsonObject } from "../validation";

export const checklist = new Hono<Env>();

const INVALID_DAY = "Invalid day format (YYYY-MM-DD)";

// ---- The default items, shown every day ----

checklist.get("/items", async (c) => c.json({ items: await c.get("store").listChecklistItems() }));

checklist.post("/items", async (c) => {
  const body = await readJsonObject(c);
  const title = cleanText(body.title, MAX_TITLE);
  if (!title) throw new HttpError(400, "Title is required");

  const item = await c.get("store").createChecklistItem({
    title,
    emoji: cleanEmoji(body.emoji),
    order: typeof body.order === "number" ? body.order : 0,
  });
  return c.json({ item }, 201);
});

checklist.patch("/items/:id", async (c) => {
  const id = parseId(c);
  const body = await readJsonObject(c);
  const patch: Partial<Omit<ChecklistItem, "id">> = {};

  const title = cleanText(body.title, MAX_TITLE);
  if (title) patch.title = title;
  if (cleanText(body.emoji, MAX_EMOJI)) patch.emoji = cleanEmoji(body.emoji);
  if (typeof body.order === "number") patch.order = body.order;
  if (typeof body.archived === "boolean") patch.archived = body.archived;

  const item = await c.get("store").updateChecklistItem(id, patch);
  if (!item) throw new HttpError(404, "Not found");
  return c.json({ item });
});

checklist.delete("/items/:id", async (c) => {
  const ok = await c.get("store").deleteChecklistItem(parseId(c));
  if (!ok) throw new HttpError(404, "Not found");
  return c.json({ ok: true });
});

// ---- One day's state on top of them ----

checklist.get("/day", async (c) => {
  const { day: asked } = c.req.query();
  const day = asked && isValidISODate(asked) ? asked : todayISO();
  return c.json({ dayChecklist: await c.get("store").getDayChecklist(day) });
});

checklist.post("/toggle", async (c) => {
  const body = await readJsonObject(c);
  const day = String(body.day ?? "");
  const itemId = String(body.itemId ?? "");

  if (!isValidISODate(day)) throw new HttpError(400, INVALID_DAY);
  if (!isDocId(itemId)) throw new HttpError(400, "Invalid itemId");

  const dayChecklist = await c.get("store").toggleDayChecklistItem(day, itemId, Boolean(body.completed));
  return c.json({ dayChecklist });
});

checklist.post("/hide", async (c) => {
  const body = await readJsonObject(c);
  const day = String(body.day ?? "");
  const itemId = String(body.itemId ?? "");

  if (!isValidISODate(day)) throw new HttpError(400, INVALID_DAY);
  if (!isDocId(itemId)) throw new HttpError(400, "Invalid itemId");

  const dayChecklist = await c.get("store").setDayChecklistItemHidden(day, itemId, Boolean(body.hidden));
  return c.json({ dayChecklist });
});

checklist.post("/extras", async (c) => {
  const body = await readJsonObject(c);
  const day = String(body.day ?? "");
  const title = cleanText(body.title, MAX_TITLE);

  if (!isValidISODate(day)) throw new HttpError(400, INVALID_DAY);
  if (!title) throw new HttpError(400, "Title is required");

  const dayChecklist = await c.get("store").addDayChecklistExtra(day, { title, emoji: cleanEmoji(body.emoji) });
  return c.json({ dayChecklist }, 201);
});

checklist.delete("/extras/:id", async (c) => {
  const id = parseId(c);
  const day = String(c.req.query("day") ?? "");
  if (!isValidISODate(day)) throw new HttpError(400, INVALID_DAY);

  return c.json({ dayChecklist: await c.get("store").removeDayChecklistExtra(day, id) });
});
