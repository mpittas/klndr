import { authErrorMessage, type AuthContext } from "@klndr/core";
import { useCallback, useState } from "react";

/**
 * The shape every auth form has: one request at a time, a spinner while it runs, and the failure
 * turned into the words the web app would have used. A provider sign-in that is backed out of is not a
 * failure, so the task simply returns without an error.
 */
export function useSubmit(context: AuthContext) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (task: () => Promise<void>) => {
      setError(null);
      setBusy(true);
      try {
        await task();
      } catch (failure) {
        setError(authErrorMessage(failure, context));
      } finally {
        setBusy(false);
      }
    },
    [context],
  );

  return { busy, error, setError, submit };
}
