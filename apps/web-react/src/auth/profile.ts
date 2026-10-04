import {
  loadOrCreateProfile,
  toProfile,
  type NewProfileSource,
  type ProfileDb,
  type UserProfile,
} from "@klndr/core";
import type { ProfileSource } from "@klndr/data";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";

import { getFirebaseServices } from "./firebase";
import type { AuthUser } from "./types";

/**
 * `users/{uid}` behind core's two-method port, plus the merge an edit needs.
 *
 * With a project configured this is the Firestore document the phone also uses; without
 * one (development) it is an in-memory stand-in — the same thing the API does for its `local-dev` user —
 * so the profile screen works without credentials too.
 *
 * `create` and `update` stamp the timestamps themselves: `firestore.rules` insists they are server time,
 * and `toProfile` reads them back through `toDate()`.
 */
export type ProfileStore = ProfileDb & {
  /** Merge fields into `users/{uid}`; the implementation stamps `updatedAt` with the server time. */
  update(uid: string, fields: Record<string, string | number | boolean>): Promise<void>;
};

/** The development stand-in for Firestore, keyed by uid like the real collection. */
const devProfiles = new Map<string, Record<string, unknown>>();

const serverNow = () => new Date().toISOString();

export const profileStore: ProfileStore = {
  async read(uid) {
    const { db } = getFirebaseServices();
    if (!db) return devProfiles.get(uid) ?? null;
    const snapshot = await getDoc(doc(db, "users", uid));
    return snapshot.exists() ? snapshot.data() : null;
  },

  async create(uid, fields) {
    const { db } = getFirebaseServices();
    if (!db) {
      devProfiles.set(uid, { ...fields, createdAt: serverNow(), updatedAt: serverNow() });
      return;
    }
    await setDoc(doc(db, "users", uid), {
      ...fields,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  },

  async update(uid, fields) {
    const { db } = getFirebaseServices();
    if (!db) {
      devProfiles.set(uid, { ...(devProfiles.get(uid) ?? {}), ...fields, updatedAt: serverNow() });
      return;
    }
    await updateDoc(doc(db, "users", uid), { ...fields, updatedAt: serverTimestamp() });
  },
};

/** What a first profile is built from, for the person signing in. */
const sourceOf = (user: AuthUser): NewProfileSource => ({
  uid: user.uid,
  email: user.email,
  displayName: user.displayName,
  photoURL: user.photoURL,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
});

/**
 * Loads the profile once per person at a time, and remembers the name typed on the sign-up form.
 *
 * Creating an account signs the person in, which makes the auth listener ask for their profile at the
 * same moment the sign-up flow does. Both must land on one `users/{uid}` write, or the second would see
 * a half-made document, so a load already in flight is shared — and the name typed on the form has to be
 * known when that one load runs. The mobile app does the same.
 */
export function createProfileLoader(store: ProfileStore) {
  const inFlight = new Map<string, Promise<UserProfile>>();
  let pendingSignUpName: string | null = null;

  return {
    /** The name to give a profile that is created next (the sign-up form). */
    setPendingName(name: string | null): void {
      pendingSignUpName = name?.trim() || null;
    },

    load(user: AuthUser): Promise<UserProfile> {
      const existing = inFlight.get(user.uid);
      if (existing) return existing;

      const run = loadOrCreateProfile(store, { ...sourceOf(user), signUpName: pendingSignUpName }).finally(() =>
        inFlight.delete(user.uid),
      );

      inFlight.set(user.uid, run);
      return run;
    },
  };
}

export const profileLoader = createProfileLoader(profileStore);

/** The profile as `@klndr/data`'s `useProfile` and `useUpdateProfile` read and write it. */
export function createProfileSource(user: AuthUser): ProfileSource {
  return {
    load: () => profileLoader.load(user),

    async save(fields) {
      await profileStore.update(user.uid, fields);
      const data = await profileStore.read(user.uid);
      if (!data) throw new Error("Couldn't save your profile. Check your connection and try again.");
      return toProfile(user.uid, data);
    },
  };
}
