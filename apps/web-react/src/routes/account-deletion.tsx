import { Link, createFileRoute } from "@tanstack/react-router";

import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { CONTACT_EMAIL } from "@/lib/legal";

export const Route = createFileRoute("/account-deletion")({
  component: AccountDeletionPage,
});

/** Written for someone who cannot sign in any more, so the email route is first-class. */
const steps = [
  "Sign in to klndr.",
  "Open Profile (your name in the header) and scroll to \u201cDelete account\u201d.",
  "Type \u201cdelete my account\u201d into the box to confirm, and enter your password if you sign in with one \u2014 or approve the pop-up if you sign in with Google or Apple.",
  "Press \u201cDelete my account\u201d. Everything goes at once: your activities, categories, blocks, checklist, notes and profile, and then the account itself.",
];

const removed = [
  "Your profile: display name, bio, phone, location, timezone and planning preferences.",
  "Every activity and category you created.",
  "Every scheduled block, in the past or the future.",
  "Your daily checklist \u2014 the items you keep, the ones you skipped, and the one-off items.",
  "Every day's notes.",
  "The account itself, with its email address, and the Apple token we were given if you signed in with Apple.",
];

function AccountDeletionPage() {
  useDocumentTitle("Delete your account \u00b7 klndr.");

  return (
    <div className="mx-auto my-6 w-[calc(100%-2rem)] max-w-3xl rounded-2xl border border-border bg-card px-6 py-9 shadow-xs sm:my-12 sm:px-12 sm:py-14">
      <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.03em] text-foreground sm:text-[2.25rem]">Delete your account</h1>
      <p className="mt-3 text-[15px] leading-7 text-foreground/75">
        You can delete your klndr. account and everything in it at any time, from the app, without asking anyone.
      </p>

      <section className="mt-10">
        <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-foreground">In the app</h2>
        <ol className="mt-3 space-y-2">
          {steps.map((step, index) => (
            <li
              key={index}
              className="flex gap-3 text-[15px] leading-7 text-foreground/75"
            >
              <span className="shrink-0 font-semibold text-foreground">{index + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[15px] leading-7 text-foreground/75">
          Deleting cannot be undone: there is no backup and no waiting period.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-foreground">What gets deleted</h2>
        <ul className="mt-3 space-y-2">
          {removed.map((item) => (
            <li key={item} className="flex gap-2.5 text-[15px] leading-7 text-foreground/75">
              <span aria-hidden="true" className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand/60" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-foreground">If you can't sign in</h2>
        <p className="mt-3 text-[15px] leading-7 text-foreground/75">
          Email{" "}
          <a
            className="rounded-sm font-medium text-foreground underline decoration-foreground/25 underline-offset-4 transition hover:decoration-foreground"
            href={`mailto:${CONTACT_EMAIL}?subject=Delete%20my%20klndr.%20account`}
          >
            {CONTACT_EMAIL}
          </a>{" "}
          from the address on the account and ask us to delete it. We delete the account and its data within 30 days
          of confirming that the request comes from the account's owner, and we reply when it is done.
        </p>
      </section>

      <div className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-6 text-sm">
        <Link to="/privacy" className="rounded-sm font-medium text-foreground underline decoration-foreground/25 underline-offset-4 transition hover:decoration-foreground">
          Privacy policy
        </Link>
        <Link to="/" className="rounded-sm text-muted-foreground transition hover:text-foreground">
          Back to klndr.
        </Link>
      </div>
    </div>
  );
}
