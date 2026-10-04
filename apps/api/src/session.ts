/**
 * A verified caller. `idToken` is the caller's Firebase ID token, forwarded to
 * Firestore so the security rules apply; it is `null` only in local dev mode
 * when Firebase isn't configured.
 */
export type Session = { userId: string; idToken: string | null };
