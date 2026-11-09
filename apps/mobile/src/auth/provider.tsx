import type { UserProfile } from "@klndr/core";
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

import { demoMode } from "@/env";
import { DEMO_USER, demoProfile } from "./demo";
import { authService } from "./service";
import type { AuthService, AuthUser } from "./types";

/**
 * Who is signed in, for the whole app, and the gate's one question: signed in, or not.
 *
 * - `loading`: Firebase has not yet said whether a session was restored, or the profile is being read.
 *   The root layout keeps the splash up (or shows nothing) for this, so no signed-out screen flashes for
 *   someone who is signed in.
 * - `signed-out` / `signed-in`: the two halves of the router.
 * - `unavailable`: the build has no usable Firebase configuration (and is not in demo mode). It says so
 *   instead of crashing in a native call, which is what a fresh checkout without the config files hits.
 *
 * A signed-in person can have no profile for a moment (it failed to load, say): `profileError` says why
 * and `retryProfile` tries again, as the web app's profile error does.
 */
export type AuthState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "unavailable"; message: string }
  | { status: "signed-in"; user: AuthUser; profile: UserProfile | null; profileError: string | null };

type AuthContextValue = {
  state: AuthState;
  /** The provider calls, for the sign-in screens. Absent in demo mode, where there is no sign-in. */
  service: AuthService | null;
  signOut: () => Promise<void>;
  retryProfile: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const PROFILE_ERROR = "We couldn't load your profile. Check your connection and try again.";

const DEMO_STATE: AuthState = {
  status: "signed-in",
  user: DEMO_USER,
  profile: demoProfile(),
  profileError: null,
};

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthState>(demoMode || !authService ? DEMO_STATE : { status: "loading" });
  // Each sign-in change gets a number, so a slow profile read for someone who has since signed out (or
  // in as somebody else) cannot overwrite what is now on screen.
  const generation = useRef(0);
  const currentUser = useRef<AuthUser | null>(null);

  const loadProfileFor = useCallback(async (service: AuthService, user: AuthUser) => {
    const mine = ++generation.current;
    try {
      const profile = await service.loadProfile(user);
      if (generation.current === mine) setState({ status: "signed-in", user, profile, profileError: null });
    } catch (error) {
      console.warn("Could not load the profile:", error);
      if (generation.current === mine) setState({ status: "signed-in", user, profile: null, profileError: PROFILE_ERROR });
    }
  }, []);

  useEffect(() => {
    if (!authService) return;
    const service = authService;
    try {
      return service.subscribe((user) => {
        currentUser.current = user;
        if (!user) {
          generation.current += 1;
          setState({ status: "signed-out" });
          return;
        }
        // The gate opens only once the profile is read, as the web app's does.
        setState((previous) =>
          previous.status === "signed-in" && previous.user.uid === user.uid ? previous : { status: "loading" },
        );
        void loadProfileFor(service, user);
      });
    } catch (error) {
      // A native Firebase call with no google-services.json / GoogleService-Info.plist behind it.
      console.warn("Firebase is not available:", error);
      setState({
        status: "unavailable",
        message:
          "This build has no Firebase configuration. Add the native config files (see apps/mobile/README.md), or set EXPO_PUBLIC_DEMO_MODE=1 to try the app without signing in.",
      });
    }
  }, [loadProfileFor]);

  const signOut = useCallback(async () => {
    if (authService) await authService.signOut();
  }, []);

  const retryProfile = useCallback(() => {
    if (authService && currentUser.current) void loadProfileFor(authService, currentUser.current);
  }, [loadProfileFor]);

  const value = useMemo<AuthContextValue>(
    () => ({ state, service: authService, signOut, retryProfile }),
    [state, signOut, retryProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
