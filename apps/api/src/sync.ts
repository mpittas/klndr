import { Firestore } from "./firestore";
import type { Session } from "./session";

/**
 * Telling the person's other devices that something changed. Each write the API makes on someone's behalf
 * stamps one small document, `users/{uid}/meta/sync`, with a field per kind of data. Devices listen to that
 * document (a single cheap read per change) and re-fetch the data they are showing; the data itself never
 * goes through it. The stamp starts with the id of the device that wrote, so that device can skip its own.
 */

/** The kinds of data a device can be told changed: the first segment of the route, as `queryKeys` names them. */
const ROOTS: Record<string, string> = {
  tasks: "tasks",
  templates: "templates",
  categories: "categories",
  checklist: "checklist",
  notes: "notes",
};

/** The kind of data a request to `path` (e.g. `/api/tasks/abc`) changes, or null when it changes none. */
export function rootOfPath(path: string): string | null {
  const [, api, segment] = path.split("/");
  return api === "api" && segment ? (ROOTS[segment] ?? null) : null;
}

/** Only ever the id the web app generates; anything else is treated as an unknown device. */
export function deviceIdOf(header: string | undefined): string {
  return header && /^[A-Za-z0-9-]{1,40}$/.test(header) ? header : "unknown";
}

export type Announce = (session: Session, root: string, deviceId: string) => Promise<void>;

/** Writes the stamp as the caller, so `firestore.rules` applies. Does nothing without Firebase (local dev). */
export function createAnnouncer(firebaseProjectId: string): Announce {
  return async (session, root, deviceId) => {
    if (!session.idToken || !firebaseProjectId) return;
    await new Firestore(firebaseProjectId, session.idToken).commit([
      {
        op: "upsert",
        path: `users/${session.userId}/meta/sync`,
        data: { [root]: `${deviceId}:${Date.now()}` },
      },
    ]);
  };
}
