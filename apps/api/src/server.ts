/**
 * Runs the API on its own as a Node server: `npm run dev -w apps/api` (watching) or
 * `npm start -w apps/api`. Configuration comes from environment variables, see `.env.example`.
 */
import { serve } from "@hono/node-server";
import { createApp } from "./app";

const env = process.env;
const firebaseProjectId = env.FIREBASE_PROJECT_ID || "";
const production = env.NODE_ENV === "production";
const port = Number(env.PORT) || 3001;

if (!firebaseProjectId && production) {
  console.error("FIREBASE_PROJECT_ID is not set: every request would be refused. Set it and start again.");
  process.exit(1);
}

const app = createApp({ firebaseProjectId, allowDevUser: !production });

serve({ fetch: app.fetch, port }, ({ port: listening }) => {
  const mode = firebaseProjectId ? `Firebase project ${firebaseProjectId}` : "no Firebase: in-memory data for the local-dev user";
  console.log(`klndr API listening on http://localhost:${listening} (${mode})`);
});
