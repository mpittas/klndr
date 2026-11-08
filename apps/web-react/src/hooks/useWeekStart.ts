import { isSignedIn, useAuth } from "@/auth";

/**
 * Whether weeks start on Monday, from the profile (Profile & settings), Monday when it isn't set. The month
 * grid, the week and the date picker all read it here, so their columns always line up the same way.
 */
export function useWeekStartsOnMonday(): boolean {
  const { state } = useAuth();
  return (isSignedIn(state) ? state.profile?.weekStartsOnMonday : undefined) ?? true;
}
