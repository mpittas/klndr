/** Signed-in state for the whole app, and the Firebase calls the sign-in screens use. */
export { AuthProvider, useAuth, DEV_USER, type AuthContextValue } from "./provider";
export { getFirebaseServices } from "./firebase";
export {
  currentProviderIds,
  deleteAccount,
  linkProvider,
  requestPasswordReset,
  signIn,
  signInWithApple,
  signInWithGoogle,
  signOutUser,
  signUp,
  toAuthUser,
} from "./service";
export { isFirebaseConfigured } from "@/env";
export type { LinkableProvider } from "./service";
export { isSignedIn } from "./types";
export type { AuthState, AuthUser, SignedInState } from "./types";
