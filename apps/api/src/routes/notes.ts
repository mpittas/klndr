import { isValidISODate, MAX_NOTES_LENGTH, todayISO } from "@klndr/core";
import { Hono } from "hono";
import type { Env } from "../env";
import { HttpError } from "../errors";
import { readJsonObject } from "../validation";

export const notes = new Hono<Env>();

notes.get("/", async (c) => {
  const { day: asked } = c.req.query();
  const day = asked && isValidISODate(asked) ? asked : todayISO();
  return c.json({ dayNotes: await c.get("store").getDayNotes(day) });
});

notes.put("/", async (c) => {
  const body = await readJsonObject(c);
  const day = String(body.day ?? "");

  if (!isValidISODate(day)) throw new HttpError(400, "Invalid day format (YYYY-MM-DD)");
  if (typeof body.text !== "string") throw new HttpError(400, "Notes must be text");
  if (body.text.length > MAX_NOTES_LENGTH) {
    throw new HttpError(413, `Notes can be at most ${MAX_NOTES_LENGTH} characters`);
  }

  return c.json({ dayNotes: await c.get("store").setDayNotes(day, body.text) });
});
