import { Outlet, createRootRouteWithContext, useRouterState } from "@tanstack/react-router";

import { AppHeader } from "@/components/AppHeader";
import type { RouterContext } from "@/router-context";

/**
 * The page frame: the canvas colour, the sans font and the antialiasing live here so no screen has to repeat them, the header sits above the `<main>` on every page but the
 * landing one, and the day planner locks the page's own scrolling (see `DayPlanner` — only its timeline
 * scrolls).
 */
export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  const path = useRouterState({ select: (state) => state.location.pathname });

  // The day planner is an app-like screen: the page itself never scrolls, only the timeline does.
  const isDayView = path.startsWith("/day");
  // The landing page brings its own header.
  const isLanding = path === "/";

  return (
    <div
      className={[
        "flex w-full flex-col bg-canvas font-sans text-foreground antialiased",
        isDayView ? "h-dvh overflow-hidden" : "min-h-dvh",
      ].join(" ")}
    >
      {!isLanding ? <AppHeader /> : null}
      <main className="flex min-h-0 w-full flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}

