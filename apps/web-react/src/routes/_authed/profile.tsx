import { PROFILE_LIMITS, authErrorMessage, type UserProfile } from "@klndr/core";
import { useProfile, useUpdateProfile } from "@klndr/data";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { useState, type FormEventHandler } from "react";

import { currentProviderIds, isSignedIn, useAuth, type AuthUser, type LinkableProvider } from "@/auth";
import { ErrorAlert, SuccessAlert } from "@/components/AuthCard";
import { TextField } from "@/components/TextField";
import { AccountActionsCard } from "@/components/profile/AccountActionsCard";
import { DeleteAccountCard } from "@/components/profile/DeleteAccountCard";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { SignInMethodsCard } from "@/components/profile/SignInMethodsCard";
import { isAppleSignInEnabled } from "@/env";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useTransientFlag } from "@/hooks/useTransientFlag";

/**
 * The profile page. Reading and writing the profile goes through `@klndr/data` (`useProfile` /
 * `useUpdateProfile`), which keeps its own cache. The auth gate loads the profile as well, so there are
 * briefly two reads of the same document.
 */
export const Route = createFileRoute("/_authed/profile")({
  component: ProfilePage,
});

type ProfileForm = {
  displayName: string;
  bio: string;
  phone: string;
  location: string;
  timezone: string;
  weekStartsOnMonday: boolean;
  defaultTaskDuration: number;
};

const localTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

const formFromProfile = (profile: UserProfile): ProfileForm => ({
  displayName: profile.displayName || "",
  bio: profile.bio || "",
  phone: profile.phone || "",
  location: profile.location || "",
  timezone: profile.timezone || localTimeZone(),
  weekStartsOnMonday: profile.weekStartsOnMonday ?? true,
  defaultTaskDuration: profile.defaultTaskDuration ?? 60,
});

/** What the form shows while the profile is still loading: the account's own name, and this device's zone. */
const formFromAccount = (user: AuthUser | null): ProfileForm => ({
  displayName: user?.displayName || user?.email?.split("@")[0] || "",
  bio: "",
  phone: "",
  location: "",
  timezone: localTimeZone(),
  weekStartsOnMonday: true,
  defaultTaskDuration: 60,
});

/** Password accounts re-enter their password; the popup providers re-authenticate with a popup. */
function describeDeleteError(thrown: unknown): string {
  const code = String((thrown as { code?: unknown } | null)?.code ?? "");
  if (code.includes("wrong-password") || code.includes("invalid-credential")) return "That password doesn't match this account.";
  if (code.includes("requires-recent-login")) return "For safety, sign out and sign in again, then delete your account.";
  if (code.includes("popup-closed-by-user") || code.includes("cancelled-popup-request")) return "The sign-in window closed before it finished.";
  return (thrown as Error | null)?.message || "Could not delete your account.";
}

function ProfilePage() {
  useDocumentTitle("Profile · klndr.");
  const { state, signOut, requestPasswordReset, deleteAccount, linkProvider, retryProfile } = useAuth();
  const navigate = useNavigate();
  const profileQuery = useProfile();
  const update = useUpdateProfile();

  const user = isSignedIn(state) ? state.user : null;
  const profileError = isSignedIn(state) ? state.profileError : null;
  const guest = state.status === "guest";

  const loaded = profileQuery.data;
  const [form, setForm] = useState<ProfileForm>(() => (loaded ? formFromProfile(loaded) : formFromAccount(user)));
  // The profile the form was last filled from. When a different one arrives (the first load, or a save
  // coming back), the form follows it. Adjusting state while rendering avoids a render with stale values.
  const [filledFrom, setFilledFrom] = useState(loaded);
  if (loaded && loaded !== filledFrom) {
    setFilledFrom(loaded);
    setForm(formFromProfile(loaded));
  }

  const saved = useTransientFlag(4000);
  const resetEmailSent = useTransientFlag(5000);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const initials = (() => {
    const name = (form.displayName || user?.email || "U").trim();
    const parts = name.split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  })();

  const handleSave: FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    setSaveError(null);
    saved.clear();

    try {
      await update.mutateAsync({
        displayName: form.displayName.trim(),
        bio: form.bio.trim(),
        phone: form.phone.trim(),
        location: form.location.trim(),
        timezone: form.timezone,
        weekStartsOnMonday: form.weekStartsOnMonday,
        defaultTaskDuration: Number(form.defaultTaskDuration) || 60,
      });
      saved.flash();
    } catch (thrown) {
      setSaveError((thrown as Error).message || "Failed to save profile changes.");
    }
  };

  const handleSendResetEmail = async () => {
    if (!user?.email) return;
    try {
      await requestPasswordReset(user.email);
      resetEmailSent.flash();
    } catch (thrown) {
      setSaveError((thrown as Error).message || "Failed to send reset email.");
    }
  };

  const handleLogout = async () => {
    await signOut();
    void navigate({ to: "/login" });
  };

  const handleDeleteAccount = async (payload: { password?: string }) => {
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteAccount(payload);
      void navigate({ to: "/" });
    } catch (thrown) {
      setDeleteError(describeDeleteError(thrown));
    } finally {
      setDeleting(false);
    }
  };

  // Linking changes the account's providers without Firebase announcing a new sign-in, so they are read
  // again here after each connect rather than from the auth state.
  const [providerIds, setProviderIds] = useState(currentProviderIds);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

  const handleConnect = async (provider: LinkableProvider) => {
    setLinkError(null);
    setLinking(true);
    try {
      await linkProvider(provider);
      setProviderIds(currentProviderIds());
    } catch (thrown) {
      setLinkError(authErrorMessage(thrown));
    } finally {
      setLinking(false);
    }
  };

  const needsPassword = providerIds.includes("password");

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {!user ? (
        // Not authenticated. A signed-out visitor never reaches here (the route guard sends them to
        // /login); this is what a build with no Firebase configuration shows.
        <div className="rounded-xl border border-border bg-card p-8 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-xl">🔒</div>
          <h2 className="mt-4 text-xl font-bold tracking-tight text-foreground">Sign in to view your profile</h2>
          <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground sm:text-sm">
            Your user profile and personal preferences are stored securely in your Firebase backend. Please sign in or
            create an account to view and edit this information.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/login"
              search={{ redirect: "/profile" }}
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90 sm:h-9 sm:px-4"
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-5 py-2 text-sm font-medium text-foreground shadow-2xs transition hover:bg-accent sm:h-9 sm:px-4"
            >
              Create Account
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <ProfileCard
            initials={initials}
            displayName={form.displayName || ""}
            email={user.email || ""}
            uid={user.uid}
            guest={guest}
          />

          {profileError ? (
            <div className="flex items-center justify-between gap-2.5 rounded-lg border border-rose-200/80 bg-rose-50/80 p-3 text-xs font-medium text-rose-800 sm:text-sm dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-200">
              <span>{profileError}</span>
              <button
                type="button"
                onClick={retryProfile}
                className="h-10 shrink-0 cursor-pointer rounded-md border border-rose-300 bg-background px-3 text-xs text-rose-800 transition hover:bg-rose-50 sm:h-auto sm:px-2 sm:py-1 dark:border-rose-400/40 dark:text-rose-200 dark:hover:bg-rose-500/10"
              >
                Retry
              </button>
            </div>
          ) : null}

          {saved.on ? <SuccessAlert message="Profile saved successfully." /> : null}

          {saveError ? <ErrorAlert message={saveError} /> : null}

          {resetEmailSent.on ? (
            <div
              role="status"
              className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/40 p-3 text-xs font-medium text-foreground sm:text-sm"
            >
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>Password reset instructions sent to {user.email}.</span>
            </div>
          ) : null}

          <div className="rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
            <form onSubmit={handleSave} className="space-y-6">
              <div className="border-b border-border pb-3">
                <h2 className="text-sm font-semibold text-foreground sm:text-base">Personal Information</h2>
                <p className="text-xs text-muted-foreground sm:text-sm">Update your details and contact information.</p>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <TextField
                  id="displayName"
                  label="Display Name"
                  value={form.displayName}
                  onChange={(value) => setForm((current) => ({ ...current, displayName: value }))}
                  required
                  maxLength={PROFILE_LIMITS.displayName}
                  placeholder="Your full name"
                />

                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-xs font-medium text-foreground sm:text-sm">
                    Account Email
                  </label>
                  <input
                    id="email"
                    value={user.email ?? ""}
                    disabled
                    type="email"
                    className="h-11 w-full cursor-not-allowed rounded-md border border-input bg-muted/50 px-3 py-1 text-sm text-muted-foreground shadow-2xs sm:h-9"
                  />
                </div>

                <TextField
                  id="phone"
                  label="Phone Number"
                  type="tel"
                  value={form.phone}
                  onChange={(value) => setForm((current) => ({ ...current, phone: value }))}
                  maxLength={PROFILE_LIMITS.phone}
                  placeholder="+1 (555) 000-0000"
                />

                <TextField
                  id="location"
                  label="Location"
                  value={form.location}
                  onChange={(value) => setForm((current) => ({ ...current, location: value }))}
                  maxLength={PROFILE_LIMITS.location}
                  placeholder="City, Country"
                />

                <div className="space-y-1.5 sm:col-span-2">
                  <label htmlFor="bio" className="block text-xs font-medium text-foreground sm:text-sm">
                    Bio / Notes
                  </label>
                  <textarea
                    id="bio"
                    rows={3}
                    maxLength={PROFILE_LIMITS.bio}
                    value={form.bio}
                    onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
                    placeholder="Tell us a little about your scheduling goals..."
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-2xs transition-colors placeholder:text-muted-foreground focus-visible:border-foreground focus-visible:outline-none"
                  />
                </div>
              </div>

              <div className="border-b border-border pb-3 pt-3">
                <h2 className="text-sm font-semibold text-foreground sm:text-base">Preferences &amp; Schedule</h2>
                <p className="text-xs text-muted-foreground sm:text-sm">Configure default planning options.</p>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <TextField
                  id="timezone"
                  label="Timezone"
                  value={form.timezone}
                  onChange={(value) => setForm((current) => ({ ...current, timezone: value }))}
                  maxLength={PROFILE_LIMITS.timezone}
                  placeholder="e.g. America/New_York or UTC"
                />

                <div className="space-y-1.5">
                  <label htmlFor="defaultDuration" className="block text-xs font-medium text-foreground sm:text-sm">
                    Default Block Duration
                  </label>
                  <select
                    id="defaultDuration"
                    value={form.defaultTaskDuration}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, defaultTaskDuration: Number(event.target.value) }))
                    }
                    className="h-11 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-2xs transition-colors focus-visible:border-foreground focus-visible:outline-none sm:h-9"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes (1 hour)</option>
                    <option value={90}>90 minutes</option>
                    <option value={120}>120 minutes (2 hours)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 sm:min-h-0 sm:gap-2.5">
                    <input
                      type="checkbox"
                      checked={form.weekStartsOnMonday}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, weekStartsOnMonday: event.target.checked }))
                      }
                      className="h-5 w-5 rounded border-input accent-primary text-primary focus:ring-ring sm:h-4 sm:w-4"
                    />
                    <span className="text-xs font-medium text-foreground sm:text-sm">Week starts on Monday</span>
                  </label>
                </div>
              </div>

              <div className="flex flex-col-reverse items-stretch gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => void handleSendResetEmail()}
                  className="min-h-11 cursor-pointer text-sm font-medium text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline sm:min-h-0"
                >
                  Reset password via email
                </button>

                <button
                  type="submit"
                  disabled={update.isPending || !loaded}
                  className="inline-flex h-11 cursor-pointer items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90 disabled:opacity-50 sm:h-9"
                >
                  {update.isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>

          {guest ? (
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
              <h3 className="text-sm font-semibold text-foreground">Guest mode</h3>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                Your planner and profile are saved in this browser only. To create an account or sign in, sign out
                first.
              </p>
            </div>
          ) : (
            <SignInMethodsCard
              providerIds={providerIds}
              appleEnabled={isAppleSignInEnabled}
              busy={linking}
              error={linkError}
              onConnect={(provider) => void handleConnect(provider)}
            />
          )}

          <AccountActionsCard onLogout={() => void handleLogout()} />

          <DeleteAccountCard
            needsPassword={needsPassword}
            busy={deleting}
            error={deleteError}
            onDelete={(payload) => void handleDeleteAccount(payload)}
          />
        </div>
      )}
    </div>
  );
}
