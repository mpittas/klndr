import {
  EmailAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  linkWithPopup,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  revokeAccessToken,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile as updateAuthProfile,
  type User,
} from "firebase/auth";

import { api } from "@/api";
import { getFirebaseServices } from "./firebase";
import { profileLoader } from "./profile";
import type { AuthUser } from "./types";

/**
 * Everything the app asks Firebase Auth to do, without React in sight.
 *
 * The calls live here, and `provider.tsx` holds the state they change. Messages are not built here — the screens use core's `authErrorMessage`, so the wording
 * is the same on both apps.
 */

const NOT_CONFIGURED = "Firebase Auth is not initialized. Please configure Firebase credentials.";

function requireAuth() {
  const { auth } = getFirebaseServices();
  if (!auth) throw new Error(NOT_CONFIGURED);
  return auth;
}

/** The Apple provider, with the two scopes Firebase asks for on first sign-in. */
const appleProvider = () => {
  const provider = new OAuthProvider("apple.com");
  provider.addScope("email");
  provider.addScope("name");
  return provider;
};

/** The fields the rest of the app needs, so the SDK's `User` does not leak past `auth/`. */
export const toAuthUser = (user: User): AuthUser => ({
  uid: user.uid,
  email: user.email,
  displayName: user.displayName,
  photoURL: user.photoURL,
});

/** Watch who is signed in; returns the unsubscribe function. */
export function watchAuth(onChange: (user: User | null) => void): () => void {
  const { auth } = getFirebaseServices();
  if (!auth) return () => {};
  return onAuthStateChanged(auth, onChange);
}

/**
 * The sign-in methods linked to the signed-in account — `["password"]`, `["google.com"]`, and so on.
 * The profile screen uses it to decide whether deleting the account has to ask for a password
 * (`deleteAccount` re-authenticates, and only a password account can do that from the form).
 */
export function currentProviderIds(): string[] {
  const { auth } = getFirebaseServices();
  return auth?.currentUser?.providerData.map((entry) => entry.providerId) ?? [];
}

export async function signIn(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(requireAuth(), email, password);
}

export async function signUp(email: string, password: string, name: string): Promise<void> {
  const auth = requireAuth();
  const displayName = name.trim();

  // Set first: the auth listener creates the profile document the moment the account exists, and it has
  // to be the same write this call makes, or the second would see a half-made document.
  profileLoader.setPendingName(displayName);
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) await updateAuthProfile(credential.user, { displayName }).catch(() => {});
    // Done here, while the name is still known; the listener's concurrent load shares this one.
    await profileLoader.load(toAuthUser(credential.user));
  } finally {
    profileLoader.setPendingName(null);
  }
}

export async function signInWithGoogle(): Promise<void> {
  await signInWithPopup(requireAuth(), new GoogleAuthProvider());
}

export async function signInWithApple(): Promise<void> {
  await signInWithPopup(requireAuth(), appleProvider());
}

/** The sign-in providers a signed-in account can have attached. */
export type LinkableProvider = "google.com" | "apple.com";

/**
 * Attach another sign-in method to the account that is signed in, so Google and Apple open the same data.
 *
 * This is the fix for Apple's "Hide My Email": it gives the app a `…@privaterelay.appleid.com` address,
 * which Firebase cannot match to the Google account, so signing in with Apple on its own makes a second,
 * empty account. Linking from inside the real account is the only reliable way to join them.
 *
 * Throws `auth/credential-already-in-use` when that Apple or Google identity already has an account of its
 * own (an earlier sign-in with it); delete that empty account, then link.
 */
export async function linkProvider(provider: LinkableProvider): Promise<void> {
  const current = requireAuth().currentUser;
  if (!current) throw new Error("You must be signed in to connect another sign-in method.");
  await linkWithPopup(current, provider === "apple.com" ? appleProvider() : new GoogleAuthProvider());
}

export async function requestPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(requireAuth(), email);
}

export async function signOutUser(): Promise<void> {
  const { auth } = getFirebaseServices();
  if (auth) await signOut(auth);
}

/**
 * Delete the account, in the only order that cannot leave a mess behind: re-authenticate (Firebase asks
 * for a recent sign-in), remove every document the user owns, revoke the Apple token when one is linked
 * — Apple requires that when an account is deleted — and then the Auth user itself.
 *
 * A password account passes its password; the popup providers re-authenticate with a popup.
 */
export async function deleteAccount(options: { password?: string } = {}): Promise<void> {
  const { auth } = getFirebaseServices();
  const current = auth?.currentUser;
  if (!auth || !current) throw new Error("You must be signed in to delete your account.");

  const providers = current.providerData.map((entry) => entry.providerId);
  // Apple wants the token it handed over revoked when the account goes. The popup is also how we
  // re-authenticate an Apple account, so the token comes back from that same response.
  let appleToken: string | null = null;

  if (providers.includes("password")) {
    if (!current.email) throw new Error("You must be signed in to delete your account.");
    if (!options.password) throw new Error("Enter your password to confirm.");
    await reauthenticateWithCredential(current, EmailAuthProvider.credential(current.email, options.password));
  } else if (providers.includes("apple.com")) {
    const credential = await reauthenticateWithPopup(current, appleProvider());
    appleToken = OAuthProvider.credentialFromResult(credential)?.accessToken ?? null;
  } else if (providers.includes("google.com")) {
    await reauthenticateWithPopup(current, new GoogleAuthProvider());
  }

  // The data goes first: it is still authorized by the token we are holding.
  await api.deleteAccount();

  if (appleToken) {
    await revokeAccessToken(auth, appleToken).catch((error) =>
      console.warn("Could not revoke the Apple token:", error),
    );
  }

  await deleteUser(current);
}
