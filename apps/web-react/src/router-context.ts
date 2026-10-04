import type { AuthContextValue } from "@/auth";

/**
 * What every route's guard and loader can read from the router context. `<RouterProvider>` receives the
 * live value from `useAuth()` in `main.tsx`, and `router.invalidate()` makes the guards re-run when it
 * changes.
 */
export type RouterContext = {
  auth: AuthContextValue;
};
