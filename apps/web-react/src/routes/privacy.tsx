import { Link, createFileRoute } from "@tanstack/react-router";

import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { CONTACT_EMAIL, OPERATOR_NAME, POLICY_UPDATED } from "@/lib/legal";

/** The privacy policy. Facts stated here come from the code: Firebase Auth and Firestore, a token-passing API on Vercel, an emoji lookup at OpenAI, no ads. */
export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

type Section = {
  heading: string;
  body?: string[];
  items?: string[];
  after?: string[];
};

const sections: Section[] = [
  {
    heading: "The short version",
    body: [
      "klndr. is a day planner. We store what you put into it so you can see it on your devices, and nothing more. We do not show advertising, we do not use tracking or analytics tools, and we do not sell your data or share it for marketing.",
      "You can see, change and delete your data from inside the app, and you can delete your whole account in a few taps.",
    ],
  },
  {
    heading: "Who is responsible for your data",
    body: [
      `${OPERATOR_NAME}, an individual, operates klndr. (the “app”, including the website at klndr.xyz and the mobile apps) and decides how your personal data is used. In data-protection terms, that makes ${OPERATOR_NAME} the “controller”.`,
      `Contact: ${CONTACT_EMAIL}, for anything on this page.`,
    ],
  },
  {
    heading: "What we collect",
    body: ["Only what the app needs to work, in these groups:"],
    items: [
      "Account details. Your email address and, depending on how you sign in, the name and profile photo your Google or Apple account gives us. If you sign in with a password, Firebase Authentication stores a hash of it. We never see your password.",
      "What you plan. The activities and categories you create (names, emoji, colours, default length, notes), the blocks you schedule on a day (title, date, start time, length, notes, whether it is done), your daily checklist, and the notes you write for a day.",
      "Your profile settings. A display name, and optionally a short bio, phone number and location, plus your timezone, whether your week starts on Monday, and your default block length. Everything except the display name is optional and only stored if you fill it in.",
      "Technical data. When you use the app, our hosting and sign-in providers receive standard connection data such as your IP address, browser type and the time of the request. They use it to deliver the service and keep it secure, and they keep it in their own logs for a limited time.",
    ],
    after: [
      "We do not collect your precise location, contacts, photos, microphone, health data, payment details or advertising identifiers.",
    ],
  },
  {
    heading: "Signing in with Google or Apple",
    body: [
      "If you choose Google or Apple, we receive only your basic profile: your name, your email address and your profile photo (and an identifier your provider assigns to you). We do not request or access your Gmail, Drive, Calendar, contacts or any other data in your Google or Apple account.",
      "We use that information only to create and sign you in to your klndr. account and to show your name in the app. Our use of information received from Google follows the Google API Services User Data Policy, including its Limited Use requirements.",
    ],
  },
  {
    heading: "Why we use it, and our legal basis",
    body: [
      "We use your data to run the app: to sign you in, to save and show your plans, to sync them between your devices, and to keep the service secure and working.",
      "If you are in the European Economic Area, the United Kingdom or a similar region, the legal basis is that this is necessary to provide the service you asked for (performing our agreement with you), plus our legitimate interest in keeping the service secure and preventing abuse. Where we rely on your consent, you can withdraw it at any time.",
      "We do not use your plans to train AI models, to profile you, or to make automated decisions about you.",
    ],
  },
  {
    heading: "Who processes your data for us",
    body: [
      "We use a small number of service providers. Each one handles data only to provide its part of the service:",
    ],
    items: [
      "Google (Firebase Authentication and Cloud Firestore). Handles sign-in and stores your account and your data. Your data is held in Google’s European multi-region (eur3).",
      "Vercel. Hosts the website and runs the app’s server code that sits between the app and your database. Requests pass through it, and it keeps standard connection logs. Your plans are not stored there.",
      "OpenAI. Used only to suggest an emoji for a title (see below).",
      "Apple. If you choose Sign in with Apple, Apple authenticates you and tells us your name and email address (which may be a private relay address).",
      "Google Fonts. The website loads its typeface from Google’s servers, which means your browser contacts Google when a page loads.",
    ],
    after: [
      "We do not sell your personal data and we do not share it with advertisers or data brokers. We may disclose data if the law requires it.",
    ],
  },
  {
    heading: "Emoji suggestions (OpenAI)",
    body: [
      "When you save an activity, block or category, the app can ask an AI model to pick a fitting emoji. For this, the title you typed is sent through our server to OpenAI’s API, together with a note saying whether it is an activity or a category.",
      "Nothing else is sent: not your name, email address, account id, notes or any other part of your plan. The request asks OpenAI not to store it. Under OpenAI’s API terms, data sent through the API is not used to train its models by default, and OpenAI may keep requests for a limited period to detect abuse. Please do not put sensitive information in a title. If the lookup fails or is unavailable, the app uses a default emoji and saving carries on as normal.",
    ],
  },
  {
    heading: "Where your data goes",
    body: [
      "Your account and plans are stored in Google’s European region. Our server code runs on Vercel, and Vercel, Google and OpenAI may process data in the United States and other countries.",
      "When data is transferred outside the EEA or the UK, it relies on safeguards such as the European Commission’s Standard Contractual Clauses or the provider’s certification under the EU–US Data Privacy Framework.",
    ],
  },
  {
    heading: "How long we keep it",
    body: [
      "Your data stays until you delete it. Deleting an activity, category, block, checklist item or note removes it straight away.",
      "Deleting your account removes every document we hold for you and then the account itself. There is no backup and no waiting period, and it cannot be undone. See the deletion page for the exact steps. Connection logs kept by our providers are deleted on their own schedules, which we do not control.",
      "If you stop using the app but do not delete your account, we keep your data until you do.",
    ],
  },
  {
    heading: "Security",
    body: [
      "All traffic is encrypted with HTTPS. Your data is protected by Firestore security rules that let you read and write only your own documents, and our server passes your own sign-in token through on every request instead of holding administrative database credentials, so the same rules apply to it.",
      "No system is perfectly secure, and we cannot guarantee absolute security. If a breach that puts your rights at risk ever happens, we will tell you and the relevant authority as the law requires.",
    ],
  },
  {
    heading: "Your rights",
    body: ["Depending on where you live, you have the right to:"],
    items: [
      "Access the personal data we hold about you, and get a copy.",
      "Correct anything that is wrong. Most of it you can change yourself in Profile.",
      "Delete your data. Use the deletion page, or email us if you cannot sign in.",
      "Object to or restrict how we use your data, and withdraw consent where we rely on it.",
      "Receive your data in a portable format.",
      "Complain to your local data-protection authority.",
    ],
    after: [
      `To use any of these rights, email ${CONTACT_EMAIL} from the address on your account. We will answer within one month, and we may ask you to confirm who you are first.`,
    ],
  },
  {
    heading: "On your device, and guest mode",
    body: [
      "We do not use advertising or analytics cookies. We store a few things in your browser’s local storage: your light or dark choice, your recently used emoji, which groups you collapsed in the activity list, and the sign-in session that Firebase needs to keep you signed in. These stay on your device and are not used to track you.",
      "If you try the app as a guest, your planner is kept only in your browser’s local storage. It is not sent to our servers. Deleting the guest account in the app, or clearing your browser’s data, erases it.",
    ],
  },
  {
    heading: "Children",
    body: [
      "klndr. is not intended for anyone under 16, and we do not knowingly collect their data. If you believe a child has created an account, email us and we will delete it.",
    ],
  },
  {
    heading: "Changes to this policy",
    body: [
      "If we change how we handle data in a way that matters, we will update this page and its date, and for significant changes we will tell you in the app or by email before the change takes effect.",
    ],
  },
  {
    heading: "Contact",
    body: [`Questions, requests or complaints about your privacy: ${CONTACT_EMAIL}.`],
  },
];

function PrivacyPage() {
  useDocumentTitle("Privacy · klndr.");

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Privacy policy</h1>
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
            {section.after?.map((paragraph, index) => (
              <p key={index} className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-6 text-xs sm:text-sm">
        <Link to="/terms" className="font-medium text-foreground underline underline-offset-4">
          Terms of use
        </Link>
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
