import type { ProfileSource } from "@klndr/data";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

import { isFirebaseConfigured } from "@/env";
import { createProfileSource, profileLoader } from "./profile";
import * as service from "./service";
import type { AuthState, AuthUser } from "./types";

/**
 * Who is signed in, for the whole app, and the router gate's one question: signed in, or not.
 *
 * The Firebase calls themselves are in `service.ts`, and this holds the state they change. `loading` is
 * only ever the *first* answer (see `AuthState`), so nothing unmounts when a later sign-in lands.
 */
export type AuthContextValue = {
  state: AuthState;
  /** Reads and writes the signed-in person's profile; `@klndr/data`'s profile hooks need it. */
  profileSource: ProfileSource | null;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, name: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  signInWithApple(): Promise<void>;
  /** Attach Google or Apple to the signed-in account, so either one opens the same data. */
  linkProvider(provider: service.LinkableProvider): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(options?: { password?: string }): Promise<void>;
  /** Try the profile again after it failed to load. */
  retryProfile(): void;
};

const PROFILE_ERROR = "We couldn't load your profile. Check your connection and try again.";

const UNAVAILABLE_MESSAGE =
  "No Firebase configuration was found, so this build runs without signing in. Copy .env.example to .env and fill it in to use real accounts.";

/**
 * The person the API treats a credential-free request as (`apps/api/src/auth.ts`), so development
 * without Firebase still has somewhere to keep data.
 */
export const DEV_USER: AuthUser = { uid: "local-dev", email: null, displayName: "Local Dev", photoURL: null };

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * What the screens can ask Firebase to do. They never change, so they are made once rather than per
 * render; an email address is trimmed on the way in.
 */
const actions = {
  signIn: (email, password) => service.signIn(email.trim(), password),
  signUp: (email, password, name) => service.signUp(email.trim(), password, name),
  signInWithGoogle: () => service.signInWithGoogle(),
  signInWithApple: () => service.signInWithApple(),
  linkProvider: (provider) => service.linkProvider(provider),
  requestPasswordReset: (email) => service.requestPasswordReset(email.trim()),
  signOut: () => service.signOutUser(),
  deleteAccount: (options) => service.deleteAccount(options),
} satisfies Omit<AuthContextValue, "state" | "profileSource" | "retryProfile">;

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthState>(() =>
    isFirebaseConfigured ? { status: "loading" } : { status: "unavailable", message: UNAVAILABLE_MESSAGE },
  );
  // Each sign-in change gets a number, so a slow profile read for someone who has since signed out (or in
  // as somebody else) cannot overwrite what is now on screen.
  const generation = useRef(0);
  const currentUser = useRef<AuthUser | null>(null);

  const loadProfileFor = useCallback(async (user: AuthUser) => {
    const mine = ++generation.current;
    try {
      const profile = await profileLoader.load(user);
      if (generation.current === mine) setState({ status: "signed-in", user, profile, profileError: null });
    } catch (error) {
      console.warn("Could not load the profile:", error);
      if (generation.current === mine) {
        setState({ status: "signed-in", user, profile: null, profileError: PROFILE_ERROR });
      }
    }
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) return;

    // Only the first answer keeps `loading` (until the profile is read). Every answer after that moves
    // straight between signed-in and signed-out, so the router never unmounts in the middle of a sign-in.
    let firstAnswer = true;

    return service.watchAuth((firebaseUser) => {
      const wasFirst = firstAnswer;
      firstAnswer = false;

      if (!firebaseUser) {
        generation.current += 1;
        currentUser.current = null;
        setState({ status: "signed-out" });
        return;
      }

      const user = service.toAuthUser(firebaseUser);
      currentUser.current = user;

      if (!wasFirst) {
        // Keep whatever is on screen for the person already shown; a different uid starts clean.
        setState((previous) =>
          previous.status === "signed-in" && previous.user.uid === user.uid
            ? previous
            : { status: "signed-in", user, profile: null, profileError: null },
        );
      }

      void loadProfileFor(user);
    });
  }, [loadProfileFor]);

  const retryProfile = useCallback(() => {
    if (currentUser.current) void loadProfileFor(currentUser.current);
  }, [loadProfileFor]);

  const status = state.status;
  const user = state.status === "signed-in" ? state.user : null;

  const profileSource = useMemo<ProfileSource | null>(() => {
    if (user) return createProfileSource(user);
    // Credential-free development has no account, but still somewhere to keep a profile.
    if (status === "unavailable") return createProfileSource(DEV_USER);
    return null;
  }, [status, user]);

  const value = useMemo<AuthContextValue>(
    () => ({ state, profileSource, ...actions, retryProfile }),
    [state, profileSource, retryProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
