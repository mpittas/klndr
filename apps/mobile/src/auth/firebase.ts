import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type AuthProvider,
  type User,
} from "@react-native-firebase/auth";
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from "@react-native-firebase/firestore";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { Platform } from "react-native";

import { env } from "@/env";
import { createProfileLoader } from "./profile-loader";
import type { AuthService, AuthUser, SignInResult } from "./types";

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

async function signInWithGoogle(): Promise<SignInResult> {
  configureGoogle();
  try {
    if (Platform.OS === "android") await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result = await GoogleSignin.signIn();
    if (result.type === "cancelled") return "cancelled";
    const idToken = result.data.idToken;
    if (!idToken) throw new Error("Google did not return an ID token. Please try again.");
    await signInWithCredential(getAuth(), GoogleAuthProvider.credential(idToken));
    return "signed-in";
  } catch (error) {
    if (isCancelled(error)) return "cancelled";
    throw error;
  }
}

/**
 * Sign in with Apple. iOS uses the system sheet and hands Firebase the identity token with a nonce (the
 * token carries the SHA-256 of it; Firebase checks it against the raw value). Android has no system
 * sheet, so Firebase runs Apple's own web flow.
 */
async function signInWithApple(): Promise<SignInResult> {
  try {
    if (Platform.OS === "ios") {
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

      // Apple shares the name once, on the very first authorisation, and Firebase does not read it from
      // the token: keep it for the profile this sign-in may be about to create.
      const given = apple.fullName?.givenName ?? "";
      const family = apple.fullName?.familyName ?? "";
      profiles.setPendingName(`${given} ${family}`.trim() || null);
      try {
        const credential = new OAuthProvider("apple.com").credential({ idToken: apple.identityToken, rawNonce });
        await signInWithCredential(getAuth(), credential);
      } finally {
        profiles.setPendingName(null);
      }
    } else {
      const provider = new OAuthProvider("apple.com").addScope("email").addScope("name");
      // The SDK types the class and its own AuthProvider interface apart; it accepts the class.
      await signInWithPopup(getAuth(), provider as unknown as AuthProvider);
    }
    return "signed-in";
  } catch (error) {
    if (isCancelled(error)) return "cancelled";
    throw error;
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
};
