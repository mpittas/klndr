import { Link } from "@tanstack/react-router";

import { LandingLogo } from "@/components/landing/LandingLogo";
import type { LandingStart } from "@/components/landing/types";

/** The two in-page anchors; the rest of the footer's links are real routes. */
const ANCHORS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
];

export function LandingFooter({ start, signedIn }: { start: LandingStart; signedIn: boolean }) {
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden bg-background pt-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <Link to="/" className="text-lg text-foreground transition hover:opacity-80" aria-label="klndr. home">
            <LandingLogo />
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">A tactile planner for people who time-block.</p>
        </div>
        <nav className="-mx-2 flex flex-wrap items-center text-sm" aria-label="Footer">
          {ANCHORS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-2 py-2 text-muted-foreground transition hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
          <Link to="/privacy" className="rounded-md px-2 py-2 text-muted-foreground transition hover:text-foreground">
            Privacy
          </Link>
          <Link
            to="/account-deletion"
            className="rounded-md px-2 py-2 text-muted-foreground transition hover:text-foreground"
          >
            Delete account
          </Link>
          {!signedIn ? (
            <Link to="/login" className="rounded-md px-2 py-2 text-muted-foreground transition hover:text-foreground">
              Log in
            </Link>
          ) : null}
          <Link
            to={start.to}
            className="rounded-md px-2 py-2 font-medium text-foreground transition hover:opacity-80"
          >
            {start.label}
          </Link>
        </nav>
      </div>
      <p className="mx-auto mt-8 max-w-6xl px-5 text-xs text-muted-foreground sm:px-8">© {year} klndr.</p>

      {/* The wordmark, large and fading into the page */}
      <p
        aria-hidden="true"
        className="footer-wordmark pointer-events-none mx-auto -mb-[0.2em] mt-4 max-w-6xl select-none px-5 text-center text-[clamp(5.5rem,25vw,19rem)] font-bold leading-[0.9] tracking-[-0.065em] sm:px-8"
      >
        klndr.
      </p>
    </footer>
  );
}
