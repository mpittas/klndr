import { cleanColor, cleanText, isColorKey, MAX_CATEGORY, type Category } from "@klndr/core";
import { Hono } from "hono";
import type { Env } from "../env";
import { HttpError } from "../errors";
import { parseId, readJsonObject } from "../validation";

export const categories = new Hono<Env>();

categories.get("/", async (c) => c.json({ categories: await c.get("store").listCategories() }));

categories.post("/", async (c) => {
  const body = await readJsonObject(c);
  const name = cleanText(body.name, MAX_CATEGORY);
  if (!name) throw new HttpError(400, "Name is required");

  const category = await c.get("store").createCategory({ name, color: cleanColor(body.color) });
  return c.json({ category }, 201);
});

categories.patch("/:id", async (c) => {
  const id = parseId(c);
  const body = await readJsonObject(c);
  const patch: Partial<Omit<Category, "id">> = {};

  if (body.name !== undefined) {
    const name = cleanText(body.name, MAX_CATEGORY);
    if (!name) throw new HttpError(400, "Name can't be empty");
    patch.name = name;
  }
  if (isColorKey(body.color)) patch.color = body.color;

  const category = await c.get("store").updateCategory(id, patch);
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
