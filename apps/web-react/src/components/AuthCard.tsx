import { Link } from "@tanstack/react-router";
import { CircleAlert, Check } from "lucide-react";
import type { ReactNode } from "react";

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
    <div className="flex w-full flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="mx-auto w-full max-w-sm space-y-6 rounded-xl border border-border bg-card p-6 shadow-xs sm:p-7">
        <div className="text-center">
          <Link to="/" className="inline-block text-2xl font-bold tracking-tight text-foreground">
            klndr.
          </Link>
          <h2 className="mt-3 text-lg font-semibold tracking-tight text-foreground">{heading}</h2>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
        </div>

        {children}

        <p className="text-center text-[11px] text-muted-foreground">
          <Link to="/privacy" className="underline underline-offset-4 transition hover:text-foreground">
            Privacy
          </Link>
          <span aria-hidden="true" className="px-1.5">
            ·
          </span>
          <Link to="/account-deletion" className="underline underline-offset-4 transition hover:text-foreground">
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
    <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 p-3 text-xs text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
      <p className="font-medium">Firebase credentials required for cloud {purpose}</p>
      <p className="mt-0.5 text-amber-800 dark:text-amber-300">
        Set credentials in{" "}
        <code className="rounded bg-amber-100/70 px-1 py-0.5 font-mono text-[11px] dark:bg-amber-400/20">.env</code> to
        activate cloud auth.
      </p>
    </div>
  );
}

export function ErrorAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-center gap-2.5 rounded-lg border border-rose-200/80 bg-rose-50/80 p-3 text-xs font-medium text-rose-800 sm:text-sm dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-200"
    >
      <CircleAlert className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

export function SuccessAlert({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="flex items-center gap-2.5 rounded-lg border border-emerald-200/80 bg-emerald-50/80 p-3 text-xs font-medium text-emerald-800 sm:text-sm dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-200"
    >
      <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
