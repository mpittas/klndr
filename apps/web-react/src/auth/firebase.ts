import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

import { firebaseConfig, isFirebaseConfigured } from "@/env";

/**
 * The app's Firebase handles, made once.
 *
 * Without a project configured — a fresh checkout with no `.env` — there is nothing to initialize, and
 * the app runs credential-free: the auth gate stays open and the API answers as its `local-dev` user.
 */

type FirebaseServices =
  | { isConfigured: true; app: FirebaseApp; auth: Auth; db: Firestore }
  | { isConfigured: false; app: null; auth: null; db: null };

let services: FirebaseServices | null = null;

export function getFirebaseServices(): FirebaseServices {
  if (services) return services;

  if (!isFirebaseConfigured) {
    services = { isConfigured: false, app: null, auth: null, db: null };
    return services;
  }

  try {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    services = { isConfigured: true, app, auth: getAuth(app), db: getFirestore(app) };
  } catch (error) {
    console.error("Firebase initialization failed:", error);
    services = { isConfigured: false, app: null, auth: null, db: null };
  }
  return services;
}

/**
 * The signed-in user's Firebase ID token for API calls, or null when there is nothing to authenticate
 * with. Waits for the initial auth check, so a call made during a cold start still carries the token of
 * a restored session.
 */
export async function getAuthToken(): Promise<string | null> {
  const { auth } = getFirebaseServices();
  if (!auth) return null;
  await auth.authStateReady();
  return (await auth.currentUser?.getIdToken()) ?? null;
}
