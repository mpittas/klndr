import type { UserProfile } from "@klndr/core";

/** The signed-in person, as far as the app cares: no SDK type crosses this line. */
export type AuthUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  /** `password`, `google.com`, `apple.com`: which ways in this account has. */
  providerIds: readonly string[];
};

/** A provider sign-in either signs the person in or is backed out of; neither is an error. */
export type SignInResult = "signed-in" | "cancelled";

/**
 * Everything the app asks of the identity provider: Firebase through React Native Firebase, the iOS and
 * Android SDKs (`firebase.ts`). The screens only see this interface. Demo mode needs none of it
 * (see `provider.tsx`).
 */
export type AuthService = {
  /** Called with the restored session once Firebase has looked, and again on every change. */
  subscribe(listener: (user: AuthUser | null) => void): () => void;
  /** The bearer token for the API, or null when signed out. */
  getIdToken(): Promise<string | null>;

  signInWithEmail(email: string, password: string): Promise<void>;
  /** The name is kept for the profile document the first sign-in creates. */
  signUpWithEmail(email: string, password: string, name: string): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  signInWithGoogle(): Promise<SignInResult>;
  signInWithApple(): Promise<SignInResult>;
  signOut(): Promise<void>;

  /** Read `users/{uid}`, creating it on the first sign-in exactly as the web app does. */
  loadProfile(user: AuthUser): Promise<UserProfile>;
};
