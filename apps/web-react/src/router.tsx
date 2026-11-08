import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";

/**
 * One router for the app. `routeTree.gen.ts` is generated from `src/routes/**` by the TanStack Router Vite
 * plugin (`vite.config.ts`) and is checked in, so `npm run typecheck` works on a fresh checkout.
 */
export const router = createRouter({
  routeTree,
  // Replaced by <RouterProvider context={...}> in main.tsx; declared here so the guards can read it.
  context: { auth: undefined! },
  defaultPreload: "intent",
  // Everywhere but the planner. The month, the week and the day place their own scroll (a timeline opens on now
  // or on its first block, and paging weeks keeps the hour in view); the router would put an old position back
  // over that, carried over from the page before.
  scrollRestoration: ({ location }) => !/^\/(calendar|week|day)(\/|$)/.test(location.pathname),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
