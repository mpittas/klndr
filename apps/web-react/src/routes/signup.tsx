import { MIN_PASSWORD_LENGTH, authErrorMessage, signUpProblem } from "@klndr/core";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";

import { isSignedIn, useAuth } from "@/auth";
import { AuthCard, ErrorAlert, FirebaseNotice } from "@/components/AuthCard";
import { ContinueAsGuest } from "@/components/ContinueAsGuest";
import { ProviderButton } from "@/components/ProviderButton";
import { AppleIcon, GoogleIcon } from "@/components/SocialIcons";
import { TextField } from "@/components/TextField";
import { isAppleSignInEnabled, isFirebaseConfigured } from "@/env";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

/**
 * Create an account. A new account lands on the profile screen. The form checks and the error wording
 * come from `@klndr/core` (`signUpProblem` / `authErrorMessage`), so the phone says the same things.
 */
export const Route = createFileRoute("/signup")({
  component: SignUpPage,
});

function SignUpPage() {
  useDocumentTitle("Create Account · klndr.");
  const auth = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signedIn = isSignedIn(auth.state);
  // A new account lands on its profile; a guest, who has nothing to set up yet, goes straight to the calendar.
  const guest = auth.state.status === "guest";

  // Wait for the auth state rather than navigating from the handler, as on `/login`.
  useEffect(() => {
    if (signedIn) void navigate({ to: guest ? "/calendar" : "/profile", replace: true });
  }, [signedIn, guest, navigate]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const problem = signUpProblem({ name, email, password, confirmPassword });
    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);
    try {
      await auth.signUp(email.trim(), password, name.trim());
    } catch (thrown) {
      setError(authErrorMessage(thrown, "sign-up"));
    } finally {
      setBusy(false);
    }
  };

  const withProvider = async (run: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await run();
    } catch (thrown) {
      setError(authErrorMessage(thrown, "sign-up"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard heading="Create an account" subtitle="Start time-blocking with klndr.">
      {!isFirebaseConfigured ? <FirebaseNotice purpose="signup" /> : null}
      {error ? <ErrorAlert message={error} /> : null}

      <form className="space-y-4" onSubmit={submit}>
        <TextField
          id="name"
          label="Full Name"
          type="text"
          value={name}
          onChange={setName}
          required
          autoComplete="name"
          autoCapitalize="words"
          placeholder="Jane Doe"
        />

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
          label={`Password (min ${MIN_PASSWORD_LENGTH} characters)`}
          type="password"
          value={password}
          onChange={setPassword}
          required
          autoComplete="new-password"
          placeholder="••••••••"
        />

        <TextField
          id="confirm-password"
          label="Confirm Password"
          type="password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          required
          autoComplete="new-password"
          placeholder="••••••••"
        />

        <button
          type="submit"
          disabled={busy}
          className="flex h-11 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90 disabled:opacity-50 sm:h-9"
        >
          {busy ? "Creating account..." : "Create Account"}
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
            Sign up with Apple
          </ProviderButton>
        ) : null}
        <ProviderButton
          icon={<GoogleIcon className="h-4 w-4" />}
          onClick={() => void withProvider(() => auth.signInWithGoogle())}
          disabled={busy}
        >
          Sign up with Google
        </ProviderButton>
      </div>

      <ContinueAsGuest disabled={busy} onContinue={auth.continueAsGuest} />

      <p className="text-center text-xs text-muted-foreground sm:text-sm">
        Already have an account?{" "}
        <Link
          to="/login"
          className="-my-2 inline-block py-2 font-medium text-foreground underline underline-offset-4 transition hover:text-primary"
        >
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
