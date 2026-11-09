import { createApiClient } from "@klndr/core";

type GuestHandler = (request: Request) => Promise<Response>;

let handler: Promise<GuestHandler> | null = null;

/** The guest API, loaded the first time a guest needs it, so everyone else's download stays small. */
const guestHandler = (): Promise<GuestHandler> =>
  (handler ??= import("./guest-app").then((module) => module.createGuestHandler()));

/**
 * The same client the signed-in app uses, but its requests are answered in this tab (see `guest-app.ts`)
 * rather than sent over the network. Paths are relative, so they resolve against this page.
 */
export const guestApi = createApiClient({
  fetch: async (path, init) => (await guestHandler())(new Request(new URL(path, window.location.origin), init)),
});
