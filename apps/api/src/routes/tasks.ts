import {
  clampDuration,
  clampLane,
  clampStart,
  cleanColor,
  cleanEmoji,
  cleanNotes,
  cleanText,
  isColorKey,
  isDocId,
  isNumeric,
  isValidISODate,
  MAX_CATEGORY,
  MAX_EMOJI,
  MAX_TITLE,
  type ScheduledTask,
} from "@klndr/core";
import { Hono } from "hono";
import { canonicalCategory } from "../categories";
import type { Env } from "../env";
import { HttpError } from "../errors";
import { parseId, readJsonObject } from "../validation";

export const tasks = new Hono<Env>();

tasks.get("/", async (c) => {
  const { day, from, to } = c.req.query();
  const store = c.get("store");

  if (day && isValidISODate(day)) {
    return c.json({ tasks: await store.listTasksForDay(day) });
  }
  if (from && to && isValidISODate(from) && isValidISODate(to)) {
    return c.json({ tasks: await store.listTasksBetween(from, to) });
  }
  throw new HttpError(400, "Provide ?day=YYYY-MM-DD or ?from=&to=");
});

tasks.post("/", async (c) => {
  const body = await readJsonObject(c);
  const store = c.get("store");
  const day = body.day;
  if (!isValidISODate(day)) throw new HttpError(400, "day must be YYYY-MM-DD");

  const title = cleanText(body.title, MAX_TITLE);
  if (!title) throw new HttpError(400, "Title is required");

  const task = await store.createTask({
    templateId: isDocId(body.templateId) ? body.templateId : null,
    title,
    emoji: cleanEmoji(body.emoji),
    color: cleanColor(body.color),
    category: await canonicalCategory(store, body.category),
    day,
    startMinutes: clampStart(body.startMinutes),
    durationMinutes: clampDuration(body.durationMinutes),
    notes: cleanNotes(body.notes),
    completed: body.completed === true,
    // Set when a deleted block is brought back by undo, so it returns to its column.
    ...(isNumeric(body.lane) ? { lane: clampLane(body.lane) } : {}),
  });

  return c.json({ task }, 201);
});

tasks.patch("/:id", async (c) => {
  const id = parseId(c);
  const body = await readJsonObject(c);
  const store = c.get("store");
  const patch: Partial<Omit<ScheduledTask, "id" | "templateId">> = {};

  const title = cleanText(body.title, MAX_TITLE);
  if (title) patch.title = title;
  if (cleanText(body.emoji, MAX_EMOJI)) patch.emoji = cleanEmoji(body.emoji);
  if (isColorKey(body.color)) patch.color = body.color;
  if (cleanText(body.category, MAX_CATEGORY)) patch.category = await canonicalCategory(store, body.category);
  if (isValidISODate(body.day)) patch.day = body.day;
  if (isNumeric(body.startMinutes)) patch.startMinutes = clampStart(body.startMinutes);
  if (isNumeric(body.durationMinutes)) patch.durationMinutes = clampDuration(body.durationMinutes);
  if (body.notes !== undefined) patch.notes = cleanNotes(body.notes);
  if (typeof body.completed === "boolean") patch.completed = body.completed;
  if (isNumeric(body.lane)) patch.lane = clampLane(body.lane);
  else if (body.lane === null) patch.lane = undefined; // back to being placed automatically

  const task = await store.updateTask(id, patch);
  if (!task) throw new HttpError(404, "Not found");
  return c.json({ task });
});

tasks.delete("/:id", async (c) => {
  const ok = await c.get("store").deleteTask(parseId(c));
  if (!ok) throw new HttpError(404, "Not found");
  return c.json({ ok: true });
});
