import { createApp, MemoryStore } from "@klndr/api";

import { loadGuestData, saveGuestData } from "./storage";

/**
 * The klndr API, running in this tab for guests: the same routes and rules as the server, with the planner
 * kept in `localStorage` instead of Firestore. Each request loads the saved planner first and saves it again
 * after a change, so every open tab of this browser sees the same data.
 *
 * Requests run one after another. Each one loads and saves the whole planner, so two at once could save
 * over each other's change.
 *
 * Loaded only when a guest first makes a request (see `api.ts`), so people with accounts never download it.
 */
export function createGuestHandler(): (request: Request) => Promise<Response> {
  let queue: Promise<unknown> = Promise.resolve();

  return (request) => {
    const run = queue.then(() => handle(request));
    queue = run.catch(() => {});
    return run;
  };
}

async function handle(request: Request): Promise<Response> {
  const store = loadStore();

  const app = createApp({
    firebaseProjectId: "",
    allowDevUser: true,
    // Guests have no one else to tell about a change, and no emoji service to ask; the app picks a neutral one.
    announce: async () => {},
    storeFor: () => store,
  });

  const response = await app.fetch(request);
  if (request.method !== "GET" && response.ok) saveGuestData(store.snapshot());
  return response;
}

function loadStore(): MemoryStore {
  const saved = loadGuestData();
  if (saved) return new MemoryStore(saved);

  // First visit: start from the demo planner, and save it at once so its ids stay the same on the next visit.
  const fresh = new MemoryStore();
  saveGuestData(fresh.snapshot());
  return fresh;
}
