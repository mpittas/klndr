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
import { clearGuestData, GUEST_UID, isGuestSession, setGuestSession } from "@/guest/storage";
import { createProfileSource, profileLoader } from "./profile";
import * as service from "./service";
import { isSignedIn, type AuthState, type AuthUser } from "./types";

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
  /** Signs a guest out too; their planner stays in this browser for the next guest visit. */
  signOut(): Promise<void>;
  /** For a guest, this clears their planner from the browser; for an account, it deletes the account. */
  deleteAccount(options?: { password?: string }): Promise<void>;
  /** Use the app without an account. The planner is kept in this browser (see `src/guest/`). */
  continueAsGuest(): void;
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

/** The person a guest is shown as. Their data is keyed by `GUEST_UID`, which no Firebase account has. */
const GUEST_USER: AuthUser = { uid: GUEST_UID, email: null, displayName: "Guest", photoURL: null };

const guestState = (): AuthState => ({ status: "guest", user: GUEST_USER, profile: null, profileError: null });

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
} satisfies Omit<
  AuthContextValue,
  "state" | "profileSource" | "retryProfile" | "signOut" | "deleteAccount" | "continueAsGuest"
>;

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthState>(() => {
    if (isFirebaseConfigured) return { status: "loading" };
    if (isGuestSession()) return guestState();
    return { status: "unavailable", message: UNAVAILABLE_MESSAGE };
  });
  // Each sign-in change gets a number, so a slow profile read for someone who has since signed out (or in
  // as somebody else) cannot overwrite what is now on screen.
  const generation = useRef(0);
  // Who is on screen, as an account or as a guest, so the profile can be read again when it failed. Starts
  // as the initial state does: a guest from last time, in a build without Firebase, is already shown as one.
  const current = useRef<{ user: AuthUser; status: "signed-in" | "guest" } | null>(
    !isFirebaseConfigured && isGuestSession() ? { user: GUEST_USER, status: "guest" } : null,
  );

  const loadProfileFor = useCallback(async (user: AuthUser, status: "signed-in" | "guest") => {
    const mine = ++generation.current;
    try {
      const profile = await profileLoader.load(user);
      if (generation.current === mine) setState({ status, user, profile, profileError: null });
    } catch (error) {
      console.warn("Could not load the profile:", error);
      if (generation.current === mine) {
        setState({ status, user, profile: null, profileError: PROFILE_ERROR });
      }
    }
  }, []);

  const enterGuest = useCallback(() => {
    setGuestSession(true);
    current.current = { user: GUEST_USER, status: "guest" };
    setState(guestState());
    void loadProfileFor(GUEST_USER, "guest");
  }, [loadProfileFor]);

  // Leaves the signed-in screens. The caller decides what happens to the data.
  const leaveAccount = useCallback(() => {
    generation.current += 1;
    current.current = null;
    setState({ status: "signed-out" });
  }, []);

  useEffect(() => {
    // Without Firebase there is no sign-in to wait for; a guest from last time is already shown as one
    // (see the initial state). Their profile is loaded on demand by the profile screen.
    if (!isFirebaseConfigured) return;

    // Only the first answer keeps `loading` (until the profile is read). Every answer after that moves
    // straight between signed-in and signed-out, so the router never unmounts in the middle of a sign-in.
    let firstAnswer = true;

    return service.watchAuth((firebaseUser) => {
      const wasFirst = firstAnswer;
      firstAnswer = false;

      if (!firebaseUser) {
        // A guest who was in guest mode when the page opened goes back to being one.
        if (isGuestSession()) {
          enterGuest();
          return;
        }
        generation.current += 1;
        current.current = null;
        setState({ status: "signed-out" });
        return;
      }

      const user = service.toAuthUser(firebaseUser);
      setGuestSession(false);
      current.current = { user, status: "signed-in" };

      if (!wasFirst) {
        // Keep whatever is on screen for the person already shown; a different uid starts clean.
        setState((previous) =>
          previous.status === "signed-in" && previous.user.uid === user.uid
            ? previous
            : { status: "signed-in", user, profile: null, profileError: null },
        );
      }

      void loadProfileFor(user, "signed-in");
    });
  }, [loadProfileFor, enterGuest]);

  const retryProfile = useCallback(() => {
    if (current.current) void loadProfileFor(current.current.user, current.current.status);
  }, [loadProfileFor]);

  const signOut = useCallback(async () => {
    if (current.current?.status === "guest") {
      setGuestSession(false);
      leaveAccount();
      return;
    }
    await service.signOutUser();
  }, [leaveAccount]);

  const deleteAccount = useCallback(
    async (options?: { password?: string }) => {
      if (current.current?.status === "guest") {
        clearGuestData();
        leaveAccount();
        return;
      }
      await service.deleteAccount(options);
    },
    [leaveAccount],
  );

  const user = isSignedIn(state) ? state.user : null;
  const status = state.status;

  const profileSource = useMemo<ProfileSource | null>(() => {
    if (user) return createProfileSource(user);
    // Credential-free development has no account, but still somewhere to keep a profile.
    if (status === "unavailable") return createProfileSource(DEV_USER);
    return null;
  }, [status, user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      profileSource,
      ...actions,
      signOut,
      deleteAccount,
      continueAsGuest: enterGuest,
      retryProfile,
    }),
    [state, profileSource, signOut, deleteAccount, enterGuest, retryProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
