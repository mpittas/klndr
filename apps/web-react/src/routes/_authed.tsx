import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The signed-in half of the app: a pathless layout, so everything under `src/routes/_authed/` is behind
 * this one check:
 *
 * - `signed-out` → send them to `/login`, remembering where they were headed (`?redirect=`).
 * - `unavailable` (a build with no Firebase configuration) → let everyone through, which is what makes
 *   credential-free development possible.
 * - `loading` cannot be reached: `main.tsx` does not mount the router until the first auth answer.
 *
 * The API enforces auth independently, whatever this decides.
 */
export const Route = createFileRoute("/_authed")({
  beforeLoad: ({ context, location }) => {
    if (context.auth.state.status !== "signed-out") return;

    throw redirect({
      to: "/login",
      search: { redirect: `${location.pathname}${location.searchStr}` },
    });
  },
  component: Outlet,
});
