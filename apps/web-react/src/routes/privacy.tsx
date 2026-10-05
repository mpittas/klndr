import { Link, createFileRoute } from "@tanstack/react-router";

import { useDocumentTitle } from "@/hooks/useDocumentTitle";

/**
 * The privacy policy. Still a draft until the placeholders in `HUMAN_TODO.md` are filled in; that is why
 * the banner stays.
 */
export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

/** Facts stated here come from the code: Firebase Auth + Firestore, a token-passing server, no ads. */
const sections = [
  {
    heading: "Who we are",
    body: [
      "[COMPANY LEGAL NAME] runs klndr. (the \u201capp\u201d). This policy explains what the app stores, why, and how to get rid of it.",
      "Contact: [CONTACT EMAIL] for anything on this page.",
    ],
  },
  {
    heading: "What we store",
    body: [
      "Account: your email address, and the display name and profile photo your sign-in provider gives us. If you sign in with a password, Firebase Authentication stores the password hash \u2014 we never see your password.",
      "What you plan: the activities and categories you create, the blocks you schedule, your daily checklist, and the notes you write for a day.",
      "Your profile settings: display name, bio, phone, location, timezone, whether the week starts on Monday, and your default block length.",
      "On your device only: your light/dark choice and your recently used emojis are kept in your browser's local storage. They never reach our servers.",
    ],
  },
  {
    heading: "Where it is stored",
    body: [
      "Everything lives in Google Cloud Firestore, under a document named after your user id, and is protected by security rules that only let you read and write your own data.",
      "Sign-in is handled by Firebase Authentication with Google or Apple, or with an email and password.",
      "[COMPANY LEGAL NAME]'s servers hold no administrative database credentials: every request passes your own sign-in token through, so the same security rules apply to them.",
    ],
  },
  {
    heading: "What we don't do",
    body: [
      "No advertising, no tracking pixels, no third-party analytics, and no selling or sharing of your data with anyone.",
      "We don't read your plans to train anything or to profile you.",
    ],
  },
  {
    heading: "Keeping it and deleting it",
    body: [
      "Your data stays until you delete it. Deleting an account removes every document we hold for you and the account itself \u2014 see the deletion page for the exact steps.",
      "Deleting a single activity, category, block, checklist item or note removes it straight away.",
    ],
  },
  {
    heading: "Children",
    body: ["The app is not intended for children under 13, and we do not knowingly store their data."],
  },
  {
    heading: "Changes",
    body: ["If this policy changes, the date below changes with it and the app will point you at the new version."],
  },
];

function PrivacyPage() {
  useDocumentTitle("Privacy \u00b7 klndr.");

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 p-3 text-xs text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
        <p className="font-semibold">DRAFT — not reviewed yet</p>
        <p className="mt-1">
          The placeholders below (legal name, contact email) have to be filled in before this app is published.
        </p>
      </div>

      <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Privacy policy</h1>
      <p className="mt-2 text-xs text-muted-foreground sm:text-sm">Draft, last updated [DATE].</p>

      <div className="mt-8 space-y-8">
        {sections.map((section) => (
          <section key={section.heading} className="space-y-2">
            <h2 className="text-base font-semibold text-foreground sm:text-lg">{section.heading}</h2>
            {section.body.map((paragraph, index) => (
              <p key={index} className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-6 text-xs sm:text-sm">
        <Link to="/account-deletion" className="font-medium text-foreground underline underline-offset-4">
          Delete your account
        </Link>
        <Link to="/" className="text-muted-foreground underline underline-offset-4">
          Back to klndr.
        </Link>
      </div>
    </div>
  );
}
