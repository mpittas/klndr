import type { LiveChanges } from "@klndr/data";
import { doc, getFirestore, onSnapshot } from "@react-native-firebase/firestore";

import { clientId } from "./client-id";

/**
 * Hears about what the signed-in person changes on their other devices (the web app, another phone), in real
 * time: the same listener the web app runs (`apps/web-react/src/data/live-changes.ts`), on the native SDK.
 *
 * The API stamps `users/{uid}/meta/sync` with a field per kind of data whenever it saves something
 * (`apps/api/src/sync.ts`), as `"<device id>:<time>"`. Firestore pushes each change of that document to every
 * device listening, so this one learns of an edit within a moment of it being saved, at the cost of one small
 * read; the data itself is then fetched the usual way. The profile is written to Firestore by each device
 * directly, so its document is listened to as well.
 */
export function createLiveChanges(uid: string): LiveChanges {
  return {
    subscribe(onChange) {
      const db = getFirestore();

      // The first answer only says where things stand now; only what differs from it is news.
      let seen: Record<string, unknown> | null = null;
      const stopStamps = onSnapshot(
        doc(db, "users", uid, "meta", "sync"),
        (snapshot) => {
          const now = (snapshot.data() ?? {}) as Record<string, unknown>;
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
