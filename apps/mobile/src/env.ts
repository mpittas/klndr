/**
 * The build-time environment, read once and typed.
 *
 * Expo inlines `process.env.EXPO_PUBLIC_*` when it builds the bundle, so these are constants, not
 * runtime settings: read them here instead of at the point of use, and a typo becomes a compile
 * error rather than an `undefined` somewhere in a screen. Values that are *not* `EXPO_PUBLIC_`
 * (the Firebase native config files) belong to the build and live in app.config.ts.
 *
 * Local values go in `apps/mobile/.env`, which is gitignored; `.env.example` lists the names.
 */

export type DataMode = "api" | "firestore";

/** The web API, without a trailing slash. Empty means "not configured" (demo mode without a server). */
export const apiBaseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");

/**
 * The public website (privacy policy, account deletion). It is where the web app is deployed, which is
 * not the API address on a developer machine, so it has its own value; it falls back to the API base.
 */
export const webBaseUrl = (process.env.EXPO_PUBLIC_WEB_URL || apiBaseUrl).replace(/\/+$/, "");

/** Google sign-in needs the *web* client id on every platform, iOS and Android included. */
export const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";

/** Demo mode skips sign-in and calls the API without a token. Development only. */
export const demoMode = process.env.EXPO_PUBLIC_DEMO_MODE === "1";

/** Where the data comes from: the web API (the default) or Firestore directly (Phase 3). */
export const dataMode: DataMode = process.env.EXPO_PUBLIC_DATA_MODE === "firestore" ? "firestore" : "api";

export const env = { apiBaseUrl, webBaseUrl, googleWebClientId, demoMode, dataMode } as const;
