import {
  cleanColor,
  cleanText,
  isColorFree,
  isColorKey,
  MAX_CATEGORY,
  MAX_EMOJI,
  nextCategoryColor,
  planDistinctColors,
  type Category,
} from "@klndr/core";
import { Hono } from "hono";
import type { Env } from "../env";
import { HttpError } from "../errors";
import { parseId, readJsonObject } from "../validation";

export const categories = new Hono<Env>();

/**
 * The categories, each with a color of its own. Two that share one (from before colors were kept apart) are
 * fixed here as they are read: the first by name keeps it, the other gets a free one. A failed fix is
 * skipped, so reading never fails because of it.
 */
categories.get("/", async (c) => {
  const store = c.get("store");
  const list = await store.listCategories();
  const recolored = new Map<string, string>();
  for (const change of planDistinctColors(list)) {
    try {
      await store.updateCategory(change.id, { color: change.color });
      recolored.set(change.id, change.color);
    } catch (err) {
      console.warn("Could not give a category a color of its own:", err instanceof Error ? err.message : err);
    }
  }
  return c.json({ categories: list.map((category) => ({ ...category, color: recolored.get(category.id) ?? category.color })) });
});

categories.post("/", async (c) => {
  const body = await readJsonObject(c);
  const name = cleanText(body.name, MAX_CATEGORY);
  if (!name) throw new HttpError(400, "Name is required");

  const store = c.get("store");
  const existing = await store.listCategories();
  // A color another category has (an older app, two devices at once) gives way to a free one.
  const wanted = cleanColor(body.color);
  const color = isColorFree(wanted, existing) ? wanted : nextCategoryColor(existing);
  const emoji = cleanText(body.emoji, MAX_EMOJI);
  const category = await store.createCategory({ name, color, ...(emoji ? { emoji } : {}) });
  return c.json({ category }, 201);
});

categories.patch("/:id", async (c) => {
  const id = parseId(c);
  const body = await readJsonObject(c);
  const store = c.get("store");
  const patch: Partial<Omit<Category, "id">> = {};

  if (body.name !== undefined) {
    const name = cleanText(body.name, MAX_CATEGORY);
    if (!name) throw new HttpError(400, "Name can't be empty");
    patch.name = name;
  }
  if (isColorKey(body.color)) {
    const list = await store.listCategories();
    if (!list.some((category) => category.id === id)) throw new HttpError(404, "Not found");
    const others = list.filter((category) => category.id !== id);
    if (!isColorFree(body.color, others)) throw new HttpError(409, "Another category already has that color");
    patch.color = body.color;
  }
  const emoji = cleanText(body.emoji, MAX_EMOJI);
  if (emoji) patch.emoji = emoji;

  const category = await store.updateCategory(id, patch);
  if (!category) throw new HttpError(404, "Not found");
  return c.json({ category });
});

categories.delete("/:id", async (c) => {
  const query = c.req.query();
  const moveTo = cleanText(query.moveTo, MAX_CATEGORY) || null;
  const deleteActivities = query.deleteActivities === "1";
  const ok = await c.get("store").deleteCategory(parseId(c), moveTo, deleteActivities);
  if (!ok) throw new HttpError(404, "Not found");
  return c.json({ ok: true });
});
