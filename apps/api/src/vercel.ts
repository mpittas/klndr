/**
 * The klndr API as one Vercel function: `scripts/build-vercel.mjs` bundles this file into
 * `.vercel/output/functions/api.func`, and the route table sends every `/api/*` request to it. The Hono
 * app does its own routing from the original URL.
 *
 * Fail-closed like the container build: requests need a verified Firebase ID token for
 * `FIREBASE_PROJECT_ID`, and the credential-free `local-dev` user is never allowed.
 */
import { getRequestListener } from "@hono/node-server";
import { createApp } from "./app";

const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || "";
if (!firebaseProjectId) console.error("FIREBASE_PROJECT_ID is not set: every request will be refused.");

const openaiApiKey = process.env.OPENAI_API_KEY || undefined;
if (!openaiApiKey) console.warn("OPENAI_API_KEY is not set: new activities and categories get a neutral emoji instead of one picked by AI.");

export default getRequestListener(
  createApp({ firebaseProjectId, allowDevUser: false, openaiApiKey, emojiModel: process.env.EMOJI_MODEL || undefined }).fetch,
);
