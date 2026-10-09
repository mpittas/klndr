import { authErrorMessage, signInProblem } from "@klndr/core";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";

import { isSignedIn, useAuth } from "@/auth";
import { AuthCard, ErrorAlert, FirebaseNotice, SuccessAlert } from "@/components/AuthCard";
import { ContinueAsGuest } from "@/components/ContinueAsGuest";
import { ProviderButton } from "@/components/ProviderButton";
import { AppleIcon, GoogleIcon } from "@/components/SocialIcons";
import { TextField } from "@/components/TextField";
import { isAppleSignInEnabled, isFirebaseConfigured } from "@/env";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { safeRedirect } from "@/lib/safeRedirect";

/**
 * Sign in with email and password, Apple or Google, with a password reset. The form checks and the error
 * wording come from `@klndr/core` (`signInProblem` / `authErrorMessage`), so the phone says the same things.
 */
export const Route = createFileRoute("/login")({
  // `?redirect=` is set by the `_authed` guard. Validated here so the router knows the shape.
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: LoginPage,
});

const RESET_SENT = "Password reset email sent. Check your inbox.";

function LoginPage() {
  useDocumentTitle("Log In · klndr.");
  const auth = useAuth();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const signedIn = isSignedIn(auth.state);

  // The auth state, not the submit handler, decides where we land: `signIn` resolves before Firebase's
  // listener has moved the app to signed-in, so navigating from the handler would race the guard.
  useEffect(() => {
    if (signedIn) void navigate({ to: safeRedirect(redirect), replace: true });
  }, [signedIn, redirect, navigate]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const problem = signInProblem({ email, password });
    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);
    try {
      await auth.signIn(email.trim(), password);
    } catch (thrown) {
      setError(authErrorMessage(thrown));
    } finally {
      setBusy(false);
    }
  };

  const withProvider = async (run: () => Promise<void>) => {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      await run();
    } catch (thrown) {
      setError(authErrorMessage(thrown));
    } finally {
      setBusy(false);
    }
  };

  const sendReset = async () => {
    setError(null);
    setSuccess(null);
    if (!email) {
      setError("Please enter your email address to receive password reset instructions.");
      return;
    }
    try {
      await auth.requestPasswordReset(email.trim());
      setSuccess(RESET_SENT);
      setShowForgot(false);
    } catch (thrown) {
      setError(authErrorMessage(thrown, "reset"));
    }
  };

  return (
    <AuthCard heading="Welcome back" subtitle="Sign in to your klndr. account">
      {!isFirebaseConfigured ? <FirebaseNotice purpose="login" /> : null}
      {error ? <ErrorAlert message={error} /> : null}
      {success ? <SuccessAlert message={success} /> : null}

      <form className="space-y-4" onSubmit={submit}>
        <TextField
          id="email"
          label="Email address"
          type="email"
          value={email}
          onChange={setEmail}
          required
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="you@example.com"
        />

        <TextField
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          required
          autoComplete="current-password"
          placeholder="••••••••"
          labelAccessory={
            <button
              type="button"
              onClick={() => setShowForgot((shown) => !shown)}
              className="-my-2.5 -mr-2 cursor-pointer px-2 py-2.5 text-xs text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline"
            >
              Forgot password?
            </button>
          }
        />

        {showForgot ? (
          <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">
              Send password reset link to <span className="font-medium text-foreground">{email || "entered email"}</span>?
            </p>
            <button
              type="button"
              onClick={() => void sendReset()}
              className="h-11 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-2xs transition hover:bg-accent sm:h-9 sm:text-xs"
            >
              Send Reset Email
            </button>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="flex h-11 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90 disabled:opacity-50 sm:h-9"
        >
          {busy ? "Signing in..." : "Sign In"}
        </button>
      </form>

      <div className="relative my-3">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-card px-2 text-muted-foreground">or</span>
        </div>
      </div>

      <div className="space-y-3">
        {isAppleSignInEnabled ? (
          <ProviderButton
            icon={<AppleIcon className="h-4 w-4" />}
            onClick={() => void withProvider(() => auth.signInWithApple())}
            disabled={busy}
          >
            Sign in with Apple
          </ProviderButton>
        ) : null}
        <ProviderButton
          icon={<GoogleIcon className="h-4 w-4" />}
          onClick={() => void withProvider(() => auth.signInWithGoogle())}
          disabled={busy}
        >
          Sign in with Google
        </ProviderButton>
      </div>

      <ContinueAsGuest disabled={busy} onContinue={auth.continueAsGuest} />

      <p className="text-center text-xs text-muted-foreground sm:text-sm">
        Don't have an account?{" "}
        <Link
          to="/signup"
          className="-my-2 inline-block py-2 font-medium text-foreground underline underline-offset-4 transition hover:text-primary"
        >
          Sign up
        </Link>
      </p>
    </AuthCard>
  );
}
