import { Link, createFileRoute } from "@tanstack/react-router";

import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { CONTACT_EMAIL, OPERATOR_NAME, POLICY_UPDATED } from "@/lib/legal";

/** The terms of use. Plain language on purpose; the privacy policy covers personal data. */
export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

type Section = {
  heading: string;
  body?: string[];
  items?: string[];
};

const sections: Section[] = [
  {
    heading: "Agreeing to these terms",
    body: [
      `These terms are the agreement between you and ${OPERATOR_NAME} (“we”, “us”) about your use of klndr., the day planner at klndr.xyz and its mobile apps (the “service”). By creating an account or using the service you agree to them. If you do not agree, please do not use it.`,
      "You must be at least 16 years old to use klndr.",
    ],
  },
  {
    heading: "What klndr. is",
    body: [
      "klndr. lets you plan your days: you create activities, schedule them as blocks on a timeline, keep a daily checklist and write notes. It is a personal planning tool, offered free of charge. We may add, change or remove features at any time.",
    ],
  },
  {
    heading: "Your account",
    items: [
      "Give us accurate information, and keep your sign-in details safe. You are responsible for what happens under your account.",
      "One person, one account. Please do not share an account or create accounts to get around a suspension.",
      `If you think someone else has used your account, tell us at ${CONTACT_EMAIL} and change your password.`,
      "You can delete your account at any time from Profile, or by following the steps on the account deletion page.",
    ],
  },
  {
    heading: "Your content",
    body: [
      "What you put into klndr. (your activities, blocks, checklist, notes and profile) stays yours. We do not claim any ownership of it.",
      "You give us permission to store, process and display it, but only as needed to run the service for you: to save it, show it back to you, sync it between your devices and suggest an emoji. The privacy policy explains exactly what that involves.",
      "You are responsible for your content. Please do not store anything unlawful or anything you do not have the right to store.",
    ],
  },
  {
    heading: "Acceptable use",
    body: ["Please do not:"],
    items: [
      "break the law or infringe anyone else’s rights while using the service;",
      "try to access other people’s accounts or data, or to get past the security of the service;",
      "attack, overload or disrupt the service, or use bots or scrapers on it;",
      "reverse engineer the service or its mobile apps, except where the law allows it regardless of this clause;",
      "send malware, spam or anything harmful through it.",
    ],
  },
  {
    heading: "Emoji suggestions and AI",
    body: [
      "The service can use an AI model to suggest an emoji for a title. Suggestions are automatic and may be wrong or odd, and you can always change them. Please do not put sensitive information into a title. See the privacy policy for what is sent.",
    ],
  },
  {
    heading: "Availability, and keeping your own copy",
    body: [
      "We try to keep klndr. running, but we do not promise it will always be available, error-free or free of data loss. It may be interrupted for maintenance, by problems at our providers, or for reasons we cannot control.",
      "Because of that, do not rely on klndr. as the only place something important is written down. Keep your own copy of anything you cannot afford to lose.",
    ],
  },
  {
    heading: "No warranty",
    body: [
      "The service is provided “as is” and “as available”, free of charge, without promises about quality, reliability or fitness for a particular purpose. This does not take away any rights you have by law that cannot be excluded.",
    ],
  },
  {
    heading: "Limit of our liability",
    body: [
      `To the fullest extent the law allows, ${OPERATOR_NAME} is not liable for indirect or consequential losses, lost data, lost profits, missed appointments or missed deadlines arising from your use of, or inability to use, the service. Because the service is free, our total liability for any claim is limited to a hundred euros (EUR 100).`,
      "Nothing in these terms limits liability that cannot lawfully be limited, such as liability for death or personal injury caused by negligence, or for fraud, and it does not affect the mandatory consumer rights you have where you live.",
    ],
  },
  {
    heading: "Suspension and ending",
    body: [
      "You can stop using klndr. and delete your account whenever you like. We may suspend or close an account, or stop the service, if you break these terms, if we must by law, or if we decide to discontinue klndr. If we end the service we will give reasonable notice where we can, so you have time to take a copy of your data.",
    ],
  },
  {
    heading: "Intellectual property",
    body: [
      "The klndr. name, logo, design and code belong to us or our licensors. These terms give you the right to use the service, not to copy or resell it. Third-party software in the service stays under its own licences.",
    ],
  },
  {
    heading: "Changes to these terms",
    body: [
      "We may update these terms, for example when the service changes. The date at the top shows the latest version. If a change matters, we will tell you in the app or by email before it takes effect. If you keep using klndr. after that, you accept the new terms.",
    ],
  },
  {
    heading: "General",
    body: [
      "These terms and the privacy policy are the whole agreement between us about the service. If a part of them turns out to be unenforceable, the rest still applies. If we do not enforce something straight away, we have not given up the right to do so later.",
      `If you have a problem, please email ${CONTACT_EMAIL} first and we will do our best to sort it out.`,
    ],
  },
  {
    heading: "Contact",
    body: [`Questions about these terms: ${CONTACT_EMAIL}.`],
  },
];

function TermsPage() {
  useDocumentTitle("Terms · klndr.");

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Terms of use</h1>
      <p className="mt-2 text-xs text-muted-foreground sm:text-sm">Last updated {POLICY_UPDATED}.</p>

      <div className="mt-8 space-y-8">
        {sections.map((section) => (
          <section key={section.heading} className="space-y-2">
            <h2 className="text-base font-semibold text-foreground sm:text-lg">{section.heading}</h2>
            {section.body?.map((paragraph, index) => (
              <p key={index} className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                {paragraph}
              </p>
            ))}
            {section.items && (
              <ul className="space-y-2">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-2.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                    <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/40" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-6 text-xs sm:text-sm">
        <Link to="/privacy" className="font-medium text-foreground underline underline-offset-4">
          Privacy policy
        </Link>
        <Link to="/" className="text-muted-foreground underline underline-offset-4">
          Back to klndr.
        </Link>
      </div>
    </div>
  );
}
