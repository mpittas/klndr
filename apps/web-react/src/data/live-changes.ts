import type { LiveChanges } from "@klndr/data";
import { doc, onSnapshot, type DocumentSnapshot } from "firebase/firestore";

import { getFirebaseServices } from "@/auth/firebase";

import { clientId } from "./client-id";

/**
 * Hears about what the signed-in person changes on their other devices, in real time.
 *
 * The API stamps `users/{uid}/meta/sync` with a field per kind of data whenever it saves something
 * (`apps/api/src/sync.ts`), as `"<device id>:<time>"`. Firestore pushes each change of that document to
 * every device listening, so a device learns of an edit within a moment of it being saved — at the cost of
 * one small read, not a read of the data. The data itself is then fetched the usual way.
 *
 * The profile is written to Firestore by each device directly, so its document is listened to as well.
 *
 * Returns `undefined` without a Firebase project (credential-free development), where there is no one else.
 */
export function createLiveChanges(uid: string): LiveChanges | undefined {
  const { db } = getFirebaseServices();
  if (!db) return undefined;

  return {
    subscribe(onChange) {
      // The first answer only says where things stand now; only what differs from it is news.
      let seen: Record<string, unknown> | null = null;
      const stopStamps = onSnapshot(
        doc(db, "users", uid, "meta", "sync"),
        (snapshot: DocumentSnapshot) => {
          const now = snapshot.data() ?? {};
          const before = seen;
          seen = now;
          if (!before) return;
          const changed = Object.keys(now).filter(
            (root) => now[root] !== before[root] && !String(now[root]).startsWith(`${clientId}:`),
          );
          if (changed.length) onChange(changed);
        },
        (error) => console.warn("Not hearing about changes from other devices:", error.message),
      );

      let profileSeen = false;
      const stopProfile = onSnapshot(
        doc(db, "users", uid),
        (snapshot) => {
          // This device's own save shows up at once as a pending write; the profile is already up to date.
          if (snapshot.metadata.hasPendingWrites) return;
          if (profileSeen) onChange(["profile"]);
          profileSeen = true;
        },
        () => {},
      );

      return () => {
        stopStamps();
        stopProfile();
      };
    },
  };
}
