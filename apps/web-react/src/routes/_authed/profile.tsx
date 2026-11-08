import { PROFILE_LIMITS, authErrorMessage, type UserProfile } from "@klndr/core";
import { useProfile, useUpdateProfile } from "@klndr/data";
import { Link, createFileRoute, useBlocker, useNavigate } from "@tanstack/react-router";
import { Check, Mail } from "lucide-react";
import { useState, type FormEventHandler } from "react";

import { currentProviderIds, isSignedIn, useAuth, type AuthUser, type LinkableProvider } from "@/auth";
import { ErrorAlert } from "@/components/AuthCard";
import { Modal } from "@/components/Modal";
import { TextField } from "@/components/TextField";
import { AccountActionsCard } from "@/components/profile/AccountActionsCard";
import { AppearanceCard } from "@/components/profile/AppearanceCard";
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

  const saved = useTransientFlag(2600);
  const resetEmailSent = useTransientFlag(5000);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  // Unsaved: the form differs from the profile it was filled from. Appearance is not part of it: it applies
  // (and is kept) the moment it changes.
  const baseline = loaded ? formFromProfile(loaded) : null;
  const dirty = baseline !== null && (Object.keys(form) as (keyof ProfileForm)[]).some((key) => form[key] !== baseline[key]);
  const discard = () => {
    if (baseline) setForm(baseline);
    setSaveError(null);
  };
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
    if (!dirty || update.isPending) return;
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
      setSaveError((thrown as Error).message || "Couldn't save your changes.");
    }
  };

  const handleSendResetEmail = async () => {
    if (!user?.email) return;
    setResetError(null);
    try {
      await requestPasswordReset(user.email);
      resetEmailSent.flash();
    } catch (thrown) {
      setResetError((thrown as Error).message || "Failed to send reset email.");
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

  // Signing out and deleting the account leave on purpose, so they are let through.
  const blocker = useBlocker({
    shouldBlockFn: ({ next }) => dirty && !deleting && next.pathname !== "/login",
    enableBeforeUnload: dirty,
    withResolver: true,
  });

  const showBar = dirty || update.isPending || saved.on;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-32 pt-8 sm:px-6 sm:pt-10 lg:px-8">
      {!user ? (
        // Not authenticated. A signed-out visitor never reaches here (the route guard sends them to
        // /login); this is what a build with no Firebase configuration shows.
        <div className="card rounded-2xl p-8 text-center sm:p-10">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-xl">🔒</div>
          <h2 className="mt-4 text-xl font-semibold tracking-[-0.02em] text-foreground">Sign in to view your profile</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Your user profile and personal preferences are stored securely in your Firebase backend. Please sign in or
            create an account to view and edit this information.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/login"
              search={{ redirect: "/profile" }}
              className="btn btn-primary btn-md h-11 px-5 sm:h-9"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              className="btn btn-secondary btn-md h-11 px-5 sm:h-9"
            >
              Create Account
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <ProfileCard
            initials={initials}
            displayName={form.displayName || ""}
            email={user.email || ""}
            uid={user.uid}
            guest={guest}
          />

          {profileError ? (
            <div className="flex items-center justify-between gap-2.5 rounded-xl border border-destructive/20 bg-destructive/[0.06] p-3 text-[13px] font-medium text-destructive">
              <span>{profileError}</span>
              <button
                type="button"
                onClick={retryProfile}
                className="btn btn-secondary btn-xs h-10 sm:h-7"
              >
                Retry
              </button>
            </div>
          ) : null}

          {resetError ? <ErrorAlert message={resetError} /> : null}

          {resetEmailSent.on ? (
            <div
              role="status"
              className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/50 p-3 text-[13px] font-medium text-foreground"
            >
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>Password reset instructions sent to {user.email}.</span>
            </div>
          ) : null}

          <form id="profile-form" onSubmit={handleSave} className="space-y-5">
            <section className="card space-y-6 p-5 sm:p-7">
              <div className="border-b border-border pb-4">
                <h2 className="text-base font-semibold tracking-[-0.015em] text-foreground">Personal information</h2>
                <p className="mt-0.5 text-[13px] text-muted-foreground">Update your details and contact information.</p>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <TextField
                  id="displayName"
                  label="Display name"
                  value={form.displayName}
                  onChange={(value) => setForm((current) => ({ ...current, displayName: value }))}
                  required
                  maxLength={PROFILE_LIMITS.displayName}
                  placeholder="Your full name"
                />

                <div className="space-y-2">
                  <label htmlFor="email" className="field-label">
                    Account email
                  </label>
                  <input
                    id="email"
                    value={user.email ?? ""}
                    disabled
                    type="email"
                    className="field h-11 cursor-not-allowed text-muted-foreground hover:bg-muted/50 sm:h-10"
                  />
                </div>

                <TextField
                  id="phone"
                  label="Phone number"
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

                <div className="space-y-2 sm:col-span-2">
                  <label htmlFor="bio" className="field-label">
                    Bio / notes
                  </label>
                  <textarea
                    id="bio"
                    rows={3}
                    maxLength={PROFILE_LIMITS.bio}
                    value={form.bio}
                    onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
                    placeholder="Tell us a little about your scheduling goals..."
                    className="field h-auto py-2.5 leading-relaxed"
                  />
                </div>
              </div>

            </section>

            <section className="card space-y-6 p-5 sm:p-7">
              <div className="border-b border-border pb-4">
                <h2 className="text-base font-semibold tracking-[-0.015em] text-foreground">Preferences &amp; schedule</h2>
                <p className="mt-0.5 text-[13px] text-muted-foreground">Configure default planning options.</p>
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

                <div className="space-y-2">
                  <label htmlFor="defaultDuration" className="field-label">
                    Default block duration
                  </label>
                  <select
                    id="defaultDuration"
                    value={form.defaultTaskDuration}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, defaultTaskDuration: Number(event.target.value) }))
                    }
                    className="field h-11 cursor-pointer sm:h-10"
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
                      className="h-5 w-5 cursor-pointer rounded accent-[var(--primary)] sm:h-4 sm:w-4"
                    />
                    <span className="text-sm font-medium text-foreground">Week starts on Monday</span>
                  </label>
                </div>
              </div>

            </section>
          </form>

          <AppearanceCard />

          {guest ? (
            <div className="card p-5 sm:p-7">
              <h3 className="text-base font-semibold tracking-[-0.015em] text-foreground">Guest mode</h3>
              <p className="mt-1 text-[13px] text-muted-foreground">
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
              onResetPassword={user.email ? () => void handleSendResetEmail() : undefined}
            />
          )}

          <AccountActionsCard onLogout={() => void handleLogout()} />

          <DeleteAccountCard
            needsPassword={needsPassword}
            busy={deleting}
            error={deleteError}
            onDelete={(payload) => void handleDeleteAccount(payload)}
          />

          {/* Unsaved profile changes: one bar at the bottom of the screen, wherever the page is scrolled to */}
          {showBar ? (
            <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-6">
              <div
                role="region"
                aria-label="Unsaved changes"
                aria-live="polite"
                className="pointer-events-auto flex w-full max-w-xl items-center gap-3 rounded-2xl border border-border bg-popover/95 py-2.5 pl-4 pr-2.5 shadow-xl backdrop-blur-xl animate-in fade-in-0 slide-in-from-bottom-4 duration-200"
              >
                {dirty || update.isPending ? (
                  <>
                    <span
                      className={["h-2 w-2 shrink-0 rounded-full", saveError ? "bg-destructive" : "bg-warning"].join(" ")}
                      aria-hidden="true"
                    />
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {saveError ? (
                        <span className="text-destructive">{saveError}</span>
                      ) : (
                        <>
                          <span className="sm:hidden">Unsaved changes</span>
                          <span className="hidden sm:inline">You have unsaved changes</span>
                        </>
                      )}
                    </p>
                    <button
                      type="button"
                      disabled={update.isPending}
                      className="btn btn-ghost btn-sm h-10 sm:h-8"
                      onClick={discard}
                    >
                      Discard
                    </button>
                    <button
                      type="submit"
                      form="profile-form"
                      disabled={update.isPending}
                      className="btn btn-primary btn-sm h-10 px-4 sm:h-8"
                    >
                      {update.isPending ? "Saving…" : saveError ? "Try again" : (
                        <>
                          <span className="sm:hidden">Save</span>
                          <span className="hidden sm:inline">Save changes</span>
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <p className="flex h-10 flex-1 items-center gap-2 text-sm font-medium text-foreground sm:h-8">
                    <Check className="h-4 w-4 text-success" aria-hidden="true" />
                    Changes saved
                  </p>
                )}
              </div>
            </div>
          ) : null}

          <Modal
            open={blocker.status === "blocked"}
            title="Leave without saving?"
            subtitle="Your changes to your profile haven't been saved."
            onClose={() => blocker.reset?.()}
            footer={
              <div className="flex justify-end gap-2">
                <button type="button" className="btn btn-soft btn-md h-11 px-5 sm:h-10" onClick={() => blocker.reset?.()}>
                  Keep editing
                </button>
                <button type="button" className="btn btn-danger btn-md h-11 px-5 sm:h-10" onClick={() => blocker.proceed?.()}>
                  Discard changes
                </button>
              </div>
            }
          >
            <p className="text-sm text-muted-foreground">If you leave now, the edits you made on this page are lost.</p>
          </Modal>
        </div>
      )}
    </div>
  );
}
