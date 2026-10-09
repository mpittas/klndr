import { Link } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { isFirebaseConfigured, isSignedIn, useAuth } from "@/auth";
import { LandingLogo } from "@/components/landing/LandingLogo";
import type { LandingStart } from "@/components/landing/types";
import { useTheme } from "@/theme";

const LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#why", label: "Why a timeline" },
  { href: "#features", label: "Features" },
];

export function LandingNav({ start }: { start: LandingStart }) {
  const { state } = useAuth();
  const { toggle: toggleTheme } = useTheme();
  const signedIn = isSignedIn(state);

  // The bar is see-through over the hero and tucks into a floating pill once the page scrolls under it.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-40 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[env(safe-area-inset-top)]">
      {/* Unscrolled, 70.5rem plus the header's 0.75rem gutters lines the logo up with the sections' max-w-6xl column. */}
      <div
        className={[
          "mx-auto mt-2 flex h-14 items-center justify-between gap-3 rounded-2xl border transition-all duration-500 ease-[cubic-bezier(0.2,0.7,0.2,1)]",
          scrolled
            ? "max-w-4xl border-border/70 bg-background/80 pl-4 pr-2 shadow-[0_10px_32px_-14px_rgb(15_23_42/0.22)] backdrop-blur-xl dark:shadow-[0_10px_32px_-14px_rgb(0_0_0/0.6)]"
            : "max-w-[70.5rem] border-transparent px-2 sm:px-5",
        ].join(" ")}
      >
        <Link
          to="/"
          className="-mx-1 px-1 py-2 text-lg text-foreground transition hover:opacity-80 sm:text-xl"
          aria-label="klndr. home"
        >
          <LandingLogo />
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex" aria-label="Sections">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Both icons render; CSS picks one so the markup is the same either way. */}
          <button
            type="button"
            aria-label="Toggle light/dark theme"
            title="Toggle theme"
            className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:h-9 sm:w-9"
            onClick={toggleTheme}
          >
            <Moon className="h-4 w-4 dark:hidden" aria-hidden="true" />
            <Sun className="hidden h-4 w-4 dark:block" aria-hidden="true" />
          </button>

          {/* Without Firebase nobody signs in, so there is nothing to wait for. */}
          {state.status === "loading" && isFirebaseConfigured ? (
            <div className="h-10 w-28 animate-pulse rounded-lg bg-muted sm:h-9" />
          ) : (
            <>
              {!signedIn ? (
                <Link
                  to="/login"
                  className="inline-flex h-10 items-center whitespace-nowrap rounded-lg px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent sm:h-9"
                >
                  Log in
                </Link>
              ) : null}
              <Link
                to={start.to}
                className="btn-primary inline-flex h-10 items-center whitespace-nowrap rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 sm:h-9"
              >
                {signedIn ? "Open calendar" : "Get started"}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
