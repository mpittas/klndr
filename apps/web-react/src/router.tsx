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
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
