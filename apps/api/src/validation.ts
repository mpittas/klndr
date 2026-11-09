import { isDocId } from "@klndr/core";
import type { Context } from "hono";
import { HttpError } from "./errors";

/** The `:id` segment of the route, which must be a plain document id (it ends up in database paths). */
export function parseId(c: Context): string {
  const id = c.req.param("id") ?? "";
  if (!isDocId(id)) throw new HttpError(400, "Invalid id");
  return id;
}

/** The JSON body of the request, which must be an object. */
export async function readJsonObject(c: Context): Promise<Record<string, unknown>> {
  const body: unknown = await c.req.json().catch(() => undefined);
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Expected a JSON object body");
  }
  return body as Record<string, unknown>;
}
