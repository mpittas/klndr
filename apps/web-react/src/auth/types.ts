import type { UserProfile } from "@klndr/core";

/** Who is signed in, as the rest of the app sees them (no Firebase SDK type leaks past `auth/`). */
export type AuthUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};

/**
 * What the app knows about the signed-in person:
 *
 * - `loading` — Firebase has not yet said whether a session was restored. The app renders nothing but
 *   the splash, so no signed-out screen flashes before a signed-in person. It happens **once**: a later
 *   sign-in moves straight to `signed-in` (with the profile arriving a moment later), which is what keeps
 *   the router from unmounting mid-navigation.
 * - `unavailable` — the build has no usable Firebase configuration (and no `.env`): development without
 *   Firebase. The gate stays open and the API answers as its `local-dev` user.
 * - `signed-out` / `signed-in` — the two halves of the router.
 *
 * A signed-in person can have no profile for a moment (it failed to load, say): `profileError` says why
 * and `retryProfile` tries again, as the web app's profile error does.
 */
export type AuthState =
  | { status: "loading" }
  | { status: "unavailable"; message: string }
  | { status: "signed-out" }
  | { status: "signed-in"; user: AuthUser; profile: UserProfile | null; profileError: string | null };
