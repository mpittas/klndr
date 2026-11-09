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

/** The sign-in providers a signed-in account can have attached from Settings. */
export type LinkableProvider = "google.com" | "apple.com";

/** Connecting a provider either attaches it or is backed out of; neither is an error. */
export type LinkResult = "linked" | "cancelled";

export type DeleteAccountOptions = {
  /** Password accounts re-enter it: Firebase asks for a recent sign-in before it deletes anyone. */
  password?: string;
  /** Removes every document the person owns (the API's `DELETE /api/account`); it runs while the token is still good. */
  deleteData: () => Promise<void>;
};

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
  /** Merge fields (already checked by core's `cleanPatch`) into `users/{uid}` and hand back the saved profile. */
  saveProfile(user: AuthUser, fields: Record<string, string | number | boolean>): Promise<UserProfile>;

  /** The sign-in methods attached to the account right now (`password`, `google.com`, `apple.com`). */
  providerIds(): readonly string[];
  /** Attach another sign-in method to the signed-in account, so each of them opens the same data. */
  linkProvider(provider: LinkableProvider): Promise<LinkResult>;
  /**
   * Delete the account in the only order that leaves nothing behind: sign in again, remove the data, revoke
   * Apple's token when one is attached, then the sign-in itself.
   */
  deleteAccount(options: DeleteAccountOptions): Promise<void>;
};
