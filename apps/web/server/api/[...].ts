import { createApp, type App } from "@klndr/api";

// The whole HTTP API lives in `apps/api` (a Hono app). While Nuxt still serves the web app, one
// catch-all hands every `/api/**` request to it, so the API has a single implementation whether it runs
// here or on its own (`npm run dev -w apps/api`).
let app: App | undefined;

export default defineEventHandler((event) => {
  app ??= createApp({
    firebaseProjectId: String(useRuntimeConfig(event).public.firebaseProjectId || ""),
    allowDevUser: Boolean(import.meta.dev),
  });
  return app.fetch(toWebRequest(event));
});
