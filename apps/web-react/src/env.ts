/**
 * The build-time environment, read once and typed.
 *
 * Vite inlines `import.meta.env.VITE_*` when it builds the bundle, so these are constants, not runtime
 * settings: read them here instead of at the point of use. Local values go in `apps/web-react/.env`,
 * which is gitignored; `.env.example` lists the names.
 */

const read = (value: string | undefined) => (value ?? "").trim();

/** The Firebase web config (Firebase console > Project settings > Your apps). */
export const firebaseConfig = {
  apiKey: read(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: read(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: read(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: read(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: read(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: read(import.meta.env.VITE_FIREBASE_APP_ID),
} as const;

/**
 * A project is usable once these two are set. Without them the app runs credential-free against the
 * API's `local-dev` fallback, which is what a fresh checkout without an `.env` gets.
 */
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

/**
 * Whether to offer "Sign in with Apple". The provider has to be set up in the Firebase console first
 * (Apple developer account, services ID, key); until then the button could only fail, so it is off by
 * default.
 */
export const isAppleSignInEnabled = read(import.meta.env.VITE_ENABLE_APPLE_SIGN_IN) === "true";

/**
 * The API's address, without a trailing slash. Empty means "this origin", which is what the dev server
 * proxies `/api` to (see `vite.config.ts`) and what production serves the API from.
 */
export const apiBaseUrl = read(import.meta.env.VITE_API_BASE_URL).replace(/\/+$/, "");
