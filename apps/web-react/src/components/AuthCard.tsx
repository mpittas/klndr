import { Link } from "@tanstack/react-router";
import { CircleAlert, Check } from "lucide-react";
import type { ReactNode } from "react";

import { Wordmark } from "@/components/Wordmark";

/** The card, logo, heading and policy links shared by `/login` and `/signup`. */
export function AuthCard({
  heading,
  subtitle,
  children,
}: {
  heading: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="flex w-full flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-14 lg:px-8">
      <div className="mx-auto w-full max-w-[25rem]">
        <div className="card space-y-6 rounded-2xl p-6 shadow-md sm:p-8">
          <div className="text-center">
            <Link to="/" className="inline-block rounded-md text-[1.75rem] leading-none text-foreground" aria-label="dayro. home">
              <Wordmark />
            </Link>
            <h1 className="mt-5 text-xl font-semibold tracking-[-0.02em] text-foreground">{heading}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>

          {children}
        </div>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          <Link to="/privacy" className="rounded-sm transition hover:text-foreground">
            Privacy
          </Link>
          <span aria-hidden="true" className="px-2 text-muted-foreground/50">
            ·
          </span>
          <Link to="/terms" className="rounded-sm transition hover:text-foreground">
            Terms
          </Link>
          <span aria-hidden="true" className="px-2 text-muted-foreground/50">
            ·
          </span>
          <Link to="/account-deletion" className="rounded-sm transition hover:text-foreground">
            Delete account
          </Link>
        </p>
      </div>
    </div>
  );
}

/** The "Firebase credentials required" banner both auth pages show when no project is configured. */
export function FirebaseNotice({ purpose }: { purpose: string }) {
  return (
    <div className="flex gap-2.5 rounded-xl border border-warning/25 bg-warning/[0.07] p-3 text-xs text-foreground">
      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" aria-hidden="true" />
      <div>
        <p className="font-medium">Firebase credentials required for cloud {purpose}</p>
        <p className="mt-0.5 text-muted-foreground">
          Set credentials in <code className="font-medium text-foreground">.env</code> to activate cloud auth.
        </p>
      </div>
    </div>
  );
}

export function ErrorAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/[0.06] p-3 text-[13px] font-medium text-destructive"
    >
      <CircleAlert className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

export function SuccessAlert({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="flex items-start gap-2.5 rounded-xl border border-success/25 bg-success/[0.07] p-3 text-[13px] font-medium text-foreground"
    >
      <Check className="mt-px h-4 w-4 shrink-0 text-success" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
