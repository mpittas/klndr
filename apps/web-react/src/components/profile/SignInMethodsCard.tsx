import { Check, KeyRound } from "lucide-react";
import type { ReactNode } from "react";

import type { LinkableProvider } from "@/auth";
import { AppleIcon, GoogleIcon } from "@/components/SocialIcons";

type Row = { id: string; label: string; icon: ReactNode; linkable: LinkableProvider | null };

const ROWS: Row[] = [
  { id: "google.com", label: "Google", icon: <GoogleIcon className="h-4 w-4" />, linkable: "google.com" },
  { id: "apple.com", label: "Apple", icon: <AppleIcon className="h-4 w-4" />, linkable: "apple.com" },
  { id: "password", label: "Email & password", icon: <KeyRound className="h-4 w-4" aria-hidden="true" />, linkable: null },
];

/**
 * The ways this account can be signed in to, and a button to attach the missing ones.
 *
 * Apple's "Hide My Email" gives the app a relay address that never matches the Google email, so signing in
 * with Apple alone makes a second, empty account. Connecting it from here — while signed in to the account
 * that already has the data — is how the two are joined.
 *
 * An email-and-password account can also ask for a password reset email from its row.
 */
export function SignInMethodsCard({
  providerIds,
  appleEnabled,
  busy,
  error,
  onConnect,
  onResetPassword,
}: {
  providerIds: string[];
  appleEnabled: boolean;
  busy: boolean;
  error: string | null;
  onConnect: (provider: LinkableProvider) => void;
  /** Sends a password reset email; offered on the email-and-password row once it is connected. */
  onResetPassword?: () => void;
}) {
  // Apple only shows when it is switched on, unless it is already connected.
  const rows = ROWS.filter(
    (row) => providerIds.includes(row.id) || (row.linkable !== null && (row.linkable !== "apple.com" || appleEnabled)),
  );

  return (
    <div className="card p-5 sm:p-7">
      <div className="border-b border-border pb-4">
        <h2 className="text-base font-semibold tracking-[-0.015em] text-foreground">Sign-in methods</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Connect more than one, and each of them opens this same account and calendar. If you use Apple with &ldquo;Hide
          My Email&rdquo;, connect it here — otherwise it starts a separate, empty account.
        </p>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-xs font-medium text-destructive sm:text-sm">
          {error}
        </p>
      ) : null}

      <ul className="mt-2 divide-y divide-border">
        {rows.map((row) => {
          const connected = providerIds.includes(row.id);
          return (
            <li key={row.id} className="flex min-h-14 items-center justify-between gap-3 py-2">
              <span className="flex items-center gap-2.5 text-sm font-medium text-foreground">
                {row.icon}
                {row.label}
              </span>
              {connected ? (
                <span className="flex items-center gap-3">
                  {row.id === "password" && onResetPassword ? (
                    <button type="button" onClick={onResetPassword} className="btn btn-ghost btn-sm h-11 sm:h-8">
                      Reset password
                    </button>
                  ) : null}
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-success">
                    <Check className="h-4 w-4" aria-hidden="true" />
                    Connected
                  </span>
                </span>
              ) : row.linkable ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onConnect(row.linkable as LinkableProvider)}
                  className="btn btn-secondary btn-sm h-11 px-4 sm:h-8"
                >
                  {busy ? "Connecting..." : "Connect"}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
