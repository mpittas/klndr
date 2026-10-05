import { demoMode } from "@/env";
import { firebaseAuth } from "./firebase";
import type { AuthService } from "./types";

/**
 * The identity provider this build uses: Firebase, or nothing at all in demo mode, where there is no
 * sign-in and the API is called without a token (the web server answers a tokenless call with its own
 * local data, which is what makes the app usable before a Firebase project exists).
 */
export const authService: AuthService | null = demoMode ? null : firebaseAuth;

/** The bearer token for the API; null in demo mode and when signed out. */
export const getAuthToken = async (): Promise<string | null> => (authService ? authService.getIdToken() : null);
