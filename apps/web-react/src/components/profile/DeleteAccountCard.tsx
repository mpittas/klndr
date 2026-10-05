import { CircleAlert, Trash2 } from "lucide-react";
import { useState } from "react";

import { FIELD_CLASS } from "@/components/TextField";

/** The phrase to type. Long enough that it cannot happen by accident. */
const CONFIRMATION = "delete my account";

export function DeleteAccountCard({
  needsPassword,
  busy,
  error,
  onDelete,
}: {
  /** Password accounts must type their password: Firebase asks for a recent sign-in before deleting. */
  needsPassword: boolean;
  /** True while the deletion runs; the button says so and nothing can be pressed twice. */
  busy: boolean;
  error: string | null;
  onDelete: (payload: { password?: string }) => void;
}) {
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");

  const confirmed = typed.trim().toLowerCase() === CONFIRMATION;
  const ready = confirmed && (!needsPassword || password.length > 0) && !busy;

  return (
    <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 shadow-xs sm:p-6">
      <h3 className="text-sm font-semibold text-foreground">Delete account</h3>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
        This erases your activities, categories, timeline blocks, checklist, notes and profile for good. There is no
        way to undo it.
      </p>

      <div className="mt-4 space-y-3">
        <label className="block space-y-1.5">
          <span className="block text-xs font-medium text-foreground">
            Type <span className="font-mono font-semibold">{CONFIRMATION}</span> to confirm
          </span>
          <input
            type="text"
            autoComplete="off"
            disabled={busy}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={CONFIRMATION}
            className={FIELD_CLASS}
          />
        </label>

        {needsPassword ? (
          <label className="block space-y-1.5">
            <span className="block text-xs font-medium text-foreground">Your password</span>
            <input
              type="password"
              autoComplete="current-password"
              disabled={busy}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className={FIELD_CLASS}
            />
          </label>
        ) : null}

        {error ? (
          <p className="flex items-start gap-1.5 text-xs text-destructive">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </p>
        ) : null}

        <button
          type="button"
          disabled={!ready}
          onClick={() => {
            if (ready) onDelete(needsPassword ? { password } : {});
          }}
          className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-4 text-xs font-medium text-destructive transition hover:bg-destructive hover:text-destructive-foreground disabled:cursor-not-allowed disabled:opacity-50 sm:h-9 sm:w-auto sm:text-sm"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          <span>{busy ? "Deleting…" : "Delete my account"}</span>
        </button>
      </div>
    </section>
  );
}
