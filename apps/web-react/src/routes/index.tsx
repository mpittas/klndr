import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { isFirebaseConfigured, useAuth } from "@/auth";
import { LandingCompare } from "@/components/landing/LandingCompare";
import { LandingCta } from "@/components/landing/LandingCta";
import { LandingFeatures } from "@/components/landing/LandingFeatures";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingMarquee } from "@/components/landing/LandingMarquee";
import { LandingNav } from "@/components/landing/LandingNav";
import { LandingSteps } from "@/components/landing/LandingSteps";
import type { LandingStart } from "@/components/landing/types";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

/**
 * The landing page. `/` is a public path, so a signed-in visitor stays here and the calls to action
 * simply change wording; this page does *not* bounce them to the calendar. The static description and OG
 * tags live in `index.html`: a Vite SPA has no head manager to set them per route, and only the title
 * ever changes.
 */
export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  useDocumentTitle("klndr. · Plan your day, block by block");

  const { state } = useAuth();
  const signedIn = state.status === "signed-in";

  // Signed-in visitors get the calendar wording. Without Firebase (local development) there are no
  // accounts, so the calendar is the place to start as well.
  const start: LandingStart =
    signedIn || !isFirebaseConfigured
      ? { to: "/calendar", label: "Open your calendar" }
      : { to: "/signup", label: "Start planning" };

  // Sections fade up as they scroll into view. Nothing is hidden until this runs, so the page
  // still reads fine without JavaScript.
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );

    // Anything already on screen at load is shown straight away; only content below the fold fades in.
    el.querySelectorAll("[data-reveal]").forEach((node) => {
      if (node.getBoundingClientRect().top < window.innerHeight) node.classList.add("is-revealed");
      else observer.observe(node);
    });
    el.classList.add("reveal-ready");

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} data-landing className="flex w-full flex-col bg-background">
      <LandingNav start={start} />
      <LandingHero start={start} signedIn={signedIn} />
      <LandingMarquee />
      <LandingSteps />
      <LandingCompare />
      <LandingFeatures />
      <LandingCta start={start} signedIn={signedIn} />
      <LandingFooter start={start} signedIn={signedIn} />
    </div>
  );
}
