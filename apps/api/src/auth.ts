import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { HttpError } from "./errors";
import type { Session } from "./session";

// Google publishes the public keys that sign Firebase ID tokens here.
export const firebaseKeys = (): JWTVerifyGetKey =>
  createRemoteJWKSet(
    new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
  );

/** Identity used only when Firebase isn't configured in development. */
export const DEV_USER_ID = "local-dev";

export type AuthOptions = {
  /** The Firebase project that issues the tokens; empty when Firebase isn't configured. */
  firebaseProjectId: string;
  /** Lets a request without credentials act as `local-dev` (development only). */
  allowDevUser: boolean;
  /** Where to find the keys that sign the tokens. */
  keys: JWTVerifyGetKey;
};

/**
 * Verify the caller's Firebase ID token and return their session, or throw 401/503.
 * Fails closed: without Firebase config the API is only usable in dev mode.
 */
export async function requireSession(authorization: string | undefined, options: AuthOptions): Promise<Session> {
  const { firebaseProjectId: projectId, allowDevUser, keys } = options;

  if (!projectId) {
    if (allowDevUser) return { userId: DEV_USER_ID, idToken: null };
    throw new HttpError(503, "Authentication is not configured");
  }

  const header = authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    if (allowDevUser) return { userId: DEV_USER_ID, idToken: null };
    throw new HttpError(401, "Sign in required");
  }

  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ["RS256"],
    });
    if (!payload.sub) throw new Error("missing subject");
    return { userId: payload.sub, idToken: token };
  } catch {
    throw new HttpError(401, "Invalid or expired session");
  }
}
