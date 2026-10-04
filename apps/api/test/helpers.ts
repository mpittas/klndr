import { createApp } from "../src/app";

/** An API with no Firebase, as in local development: every request is the `local-dev` user. */
export const devApp = () => createApp({ firebaseProjectId: "", allowDevUser: true });

type Json = Record<string, any>;

/** Call the app like a client would and parse the JSON answer. */
export async function call(
  app: ReturnType<typeof createApp>,
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: Json; headers: Headers }> {
  const response = await app.request(path, {
    method,
    headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : {}, headers: response.headers };
}
