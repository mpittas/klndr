import {
  cleanText,
  MAX_CATEGORY,
  MAX_CATEGORY_EXAMPLE,
  MAX_CATEGORY_EXAMPLES,
  MAX_CATEGORY_OPTIONS,
  MAX_TITLE,
  type CategoryOption,
} from "@dayro/core";
import { Hono } from "hono";
import type { Env } from "../env";
import { HttpError } from "../errors";
import { readJsonObject } from "../validation";

export const suggestCategory = new Hono<Env>();

/** The categories as sent, cut down to what a suggestion needs; anything malformed is left out. */
function cleanOptions(value: unknown): CategoryOption[] {
  if (!Array.isArray(value)) return [];
  const options: CategoryOption[] = [];
  for (const raw of value.slice(0, MAX_CATEGORY_OPTIONS)) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Record<string, unknown>;
    const name = cleanText(entry.name, MAX_CATEGORY);
    if (!name) continue;
    const examples = Array.isArray(entry.examples)
      ? entry.examples
          .slice(0, MAX_CATEGORY_EXAMPLES)
          .map((example) => cleanText(example, MAX_CATEGORY_EXAMPLE))
          .filter(Boolean)
      : [];
    options.push({ name, examples });
  }
  return options;
}

/**
 * Suggest which of the caller's categories a block belongs in. The app sends the categories (with a few
 * examples of each), so this costs no database read. Best effort, like `/api/emoji`: no model, a failure or no
 * good fit all answer `{ category: null }`, and the app leaves the block unsorted.
 */
suggestCategory.post("/", async (c) => {
  const body = await readJsonObject(c);
  const text = cleanText(body.text, MAX_TITLE);
  if (!text) throw new HttpError(400, "Text is required");
  const categories = cleanOptions(body.categories);

  const suggest = c.get("suggestCategory");
  return c.json({ category: suggest && categories.length ? await suggest(text, categories) : null });
});
