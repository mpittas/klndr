import { loadOrCreateProfile, type ProfileDb, type UserProfile } from "@klndr/core";

import type { AuthUser } from "./types";

/**
 * Loads the profile once per person at a time, and remembers the name typed on the sign-up form.
 *
 * Creating an account signs the person in, which makes the auth listener ask for their profile at the
 * same moment the sign-up flow does. Both must land on one `users/{uid}` write, or the second would see
 * a half-made document, so a load already in flight is shared — and the name typed on the form has to be
 * known when that one load runs. The web app does the same in `useAuth` (`profileLoads`,
 * `pendingSignUpName`); both adapters here use this instead of repeating it.
 */
export function createProfileLoader(db: ProfileDb) {
  const inFlight = new Map<string, Promise<UserProfile>>();
  let pendingName: string | null = null;

  return {
    /** The name to give a profile that is created next (sign-up form, or Apple's first-time name). */
    setPendingName(name: string | null) {
      pendingName = name?.trim() || null;
    },

    load(user: AuthUser): Promise<UserProfile> {
      const existing = inFlight.get(user.uid);
      if (existing) return existing;

      const run = loadOrCreateProfile(db, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        signUpName: pendingName,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }).finally(() => inFlight.delete(user.uid));

      inFlight.set(user.uid, run);
      return run;
    },
  };
}
