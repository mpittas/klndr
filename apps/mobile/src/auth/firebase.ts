import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  getAuth,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  OAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  revokeToken,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type AuthProvider,
  type User,
} from "@react-native-firebase/auth";
import { doc, getDoc, getFirestore, serverTimestamp, setDoc, updateDoc } from "@react-native-firebase/firestore";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { Platform } from "react-native";

import { toProfile } from "@klndr/core";

import { env } from "@/env";
import { createProfileLoader } from "./profile-loader";
import type { AuthService, AuthUser, DeleteAccountOptions, LinkableProvider, LinkResult, SignInResult } from "./types";

/**
 * The Firebase adapter for iOS and Android, on React Native Firebase: the native SDKs, which keep the
 * session in the keychain / account store and restore it before the first screen.
 *
 * It is only ever called when a Firebase project is configured (the provider skips it in demo mode),
 * and every SDK call is made lazily, so a checkout without the native config files still starts.
 */

const userOf = (user: User): AuthUser => ({
  uid: user.uid,
  email: user.email,
  displayName: user.displayName,
  photoURL: user.photoURL,
  providerIds: user.providerData.map((entry) => entry.providerId),
});

/** `users/{uid}` through the native Firestore SDK; the timestamps are the server's, as the rules demand. */
const profiles = createProfileLoader({
  async read(uid) {
    const snapshot = await getDoc(doc(getFirestore(), "users", uid));
    return snapshot.exists() ? (snapshot.data() ?? null) : null;
  },
  async create(uid, fields) {
    await setDoc(doc(getFirestore(), "users", uid), {
      ...fields,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  },
});

let googleConfigured = false;
function configureGoogle() {
  if (googleConfigured) return;
  if (!env.googleWebClientId) {
    throw new Error("Google sign-in is not set up: EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is empty.");
  }
  // Firebase wants an ID token minted for the *web* client, on iOS and Android alike.
  GoogleSignin.configure({ webClientId: env.googleWebClientId });
  googleConfigured = true;
}

/** A 32-hex-digit random string, which is what Firebase wants as the raw nonce. */
const newNonce = () => Crypto.randomUUID().replace(/-/g, "");

const isCancelled = (error: unknown) => {
  const code = (error as { code?: unknown } | null)?.code;
  return (
    code === "ERR_REQUEST_CANCELED" || // Sign in with Apple, iOS
    code === statusCodes.SIGN_IN_CANCELLED || // Google
    code === "auth/web-context-canceled" // Firebase's browser flow (Apple on Android)
  );
};

/** Google's account chooser, and Firebase's credential for the account picked; `null` when it is backed out of. */
async function googleCredential() {
  configureGoogle();
  if (Platform.OS === "android") await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const result = await GoogleSignin.signIn();
  if (result.type === "cancelled") return null;
  const idToken = result.data.idToken;
  if (!idToken) throw new Error("Google did not return an ID token. Please try again.");
  return GoogleAuthProvider.credential(idToken);
}

/**
 * Apple's system sheet (iOS): its identity token with the raw nonce Firebase checks it against (the token
 * carries the SHA-256 of it), as Firebase's credential, plus what Apple handed back for the profile and for
 * revoking the token when an account is deleted.
 */
async function appleCredentialOnIos() {
  const rawNonce = newNonce();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  const apple = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });
  if (!apple.identityToken) throw new Error("Apple did not return an identity token. Please try again.");
  const credential = new OAuthProvider("apple.com").credential({ idToken: apple.identityToken, rawNonce });
  return { apple, credential };
}

/** Apple's own web flow, which is how Android does it: Firebase opens the page and takes the answer. */
const appleWebProvider = () =>
  // The SDK types the class and its own AuthProvider interface apart; it accepts the class.
  new OAuthProvider("apple.com").addScope("email").addScope("name") as unknown as AuthProvider;

/** Throws the way Firebase's own flows do when a person backs out, so every screen words it the same. */
const cancelled = () => Object.assign(new Error("The sign-in window closed before it finished."), { code: "auth/popup-closed-by-user" });

async function signInWithGoogle(): Promise<SignInResult> {
  try {
    const credential = await googleCredential();
    if (!credential) return "cancelled";
    await signInWithCredential(getAuth(), credential);
    return "signed-in";
  } catch (error) {
    if (isCancelled(error)) return "cancelled";
    throw error;
  }
}

/**
 * Sign in with Apple. iOS uses the system sheet and hands Firebase the identity token with a nonce. Android
 * has no system sheet, so Firebase runs Apple's own web flow.
 */
async function signInWithApple(): Promise<SignInResult> {
  try {
    if (Platform.OS === "ios") {
      const { apple, credential } = await appleCredentialOnIos();
      // Apple shares the name once, on the very first authorisation, and Firebase does not read it from
      // the token: keep it for the profile this sign-in may be about to create.
      const given = apple.fullName?.givenName ?? "";
      const family = apple.fullName?.familyName ?? "";
      profiles.setPendingName(`${given} ${family}`.trim() || null);
      try {
        await signInWithCredential(getAuth(), credential);
      } finally {
        profiles.setPendingName(null);
      }
    } else {
      await signInWithPopup(getAuth(), appleWebProvider());
    }
    return "signed-in";
  } catch (error) {
    if (isCancelled(error)) return "cancelled";
    throw error;
  }
}

/** The sign-in methods attached to the account that is signed in. */
const providerIdsOf = (): readonly string[] => getAuth().currentUser?.providerData.map((entry) => entry.providerId) ?? [];

/**
 * Attach Google or Apple to the account that is signed in, so each of them opens the same data. Apple's
 * "Hide My Email" hands the app a relay address Firebase cannot match to the Google account, so signing in
 * with Apple alone makes a second, empty account: connecting it from inside the real one is how they join.
 * Throws `auth/credential-already-in-use` when that identity already has an account of its own.
 */
async function linkProvider(provider: LinkableProvider): Promise<LinkResult> {
  const current = getAuth().currentUser;
  if (!current) throw new Error("You must be signed in to connect another sign-in method.");
  try {
    if (provider === "google.com") {
      const credential = await googleCredential();
      if (!credential) return "cancelled";
      await linkWithCredential(current, credential);
    } else if (Platform.OS === "ios") {
      await linkWithCredential(current, (await appleCredentialOnIos()).credential);
    } else {
      await linkWithPopup(current, appleWebProvider());
    }
    return "linked";
  } catch (error) {
    if (isCancelled(error)) return "cancelled";
    throw error;
  }
}

/**
 * Delete the account, in the only order that cannot leave a mess behind: sign in again (Firebase asks for a
 * recent one), remove every document the person owns while the token is still good, revoke Apple's token when
 * one is attached (Apple requires it), and then the sign-in itself. A password account passes its password;
 * Google and Apple go through their own sheet again.
 */
async function deleteAccount({ password, deleteData }: DeleteAccountOptions): Promise<void> {
  const auth = getAuth();
  const current = auth.currentUser;
  if (!current) throw new Error("You must be signed in to delete your account.");

  const providers = current.providerData.map((entry) => entry.providerId);
  let appleCode: string | null = null;

  if (providers.includes("password")) {
    if (!current.email) throw new Error("You must be signed in to delete your account.");
    if (!password) throw new Error("Enter your password to confirm.");
    await reauthenticateWithCredential(current, EmailAuthProvider.credential(current.email, password));
  } else if (providers.includes("apple.com")) {
    try {
      if (Platform.OS === "ios") {
        const { apple, credential } = await appleCredentialOnIos();
        await reauthenticateWithCredential(current, credential);
        appleCode = apple.authorizationCode ?? null;
      } else {
        await reauthenticateWithPopup(current, appleWebProvider());
      }
    } catch (error) {
      if (isCancelled(error)) throw cancelled();
      throw error;
    }
  } else if (providers.includes("google.com")) {
    const credential = await googleCredential().catch((error) => {
      throw isCancelled(error) ? cancelled() : error;
    });
    if (!credential) throw cancelled();
    await reauthenticateWithCredential(current, credential);
  }

  await deleteData();

  if (appleCode) {
    await revokeToken(auth, appleCode).catch((error) => console.warn("Could not revoke the Apple token:", error));
  }

  await deleteUser(current);
  // Forget the Google account too, as signing out does.
  if (env.googleWebClientId) {
    configureGoogle();
    await GoogleSignin.signOut().catch(() => {});
  }
}

export const firebaseAuth: AuthService = {
  subscribe(listener) {
    return onAuthStateChanged(getAuth(), (user) => listener(user ? userOf(user) : null));
  },

  async getIdToken() {
    const user = getAuth().currentUser;
    return user ? await user.getIdToken() : null;
  },

  async signInWithEmail(email, password) {
    await signInWithEmailAndPassword(getAuth(), email, password);
  },

  async signUpWithEmail(email, password, name) {
    // Set first: the auth listener asks for the profile the moment the account exists.
    profiles.setPendingName(name);
    try {
      const { user } = await createUserWithEmailAndPassword(getAuth(), email, password);
      const display = name.trim();
      if (display) await updateProfile(user, { displayName: display }).catch(() => {});
      await profiles.load(userOf(user));
    } finally {
      profiles.setPendingName(null);
    }
  },

  async sendPasswordReset(email) {
    await sendPasswordResetEmail(getAuth(), email);
  },

  signInWithGoogle,
  signInWithApple,

  async signOut() {
    await signOut(getAuth());
    // Forget the Google account too, or the next "Continue with Google" silently reuses it. A session
    // restored after a relaunch never configured the SDK in this run, so do it now.
    if (env.googleWebClientId) {
      configureGoogle();
      await GoogleSignin.signOut().catch(() => {});
    }
  },

  loadProfile: (user) => profiles.load(user),

  async saveProfile(user, fields) {
    const reference = doc(getFirestore(), "users", user.uid);
    // `updatedAt` is the server's time, which `firestore.rules` insists on.
    await updateDoc(reference, { ...fields, updatedAt: serverTimestamp() });
    const snapshot = await getDoc(reference);
    const data = snapshot.exists() ? snapshot.data() : null;
    if (!data) throw new Error("Couldn't save your profile. Check your connection and try again.");
    return toProfile(user.uid, data);
  },

  providerIds: providerIdsOf,
  linkProvider,
  deleteAccount,
};
