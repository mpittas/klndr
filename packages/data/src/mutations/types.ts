import type { ApiClient, TimelineHistory } from "@dayro/core";
import type { QueryClient } from "@tanstack/react-query";

/** Where "Added Workout" and "Could not save that block" go: a flash on the web, a toast on the phone. */
export type Notify = (message: string) => void;

/** What every mutation needs from the app around it. */
export type MutationDeps = {
  api: ApiClient;
  queryClient: QueryClient;
  notify: Notify;
};

/**
 * Where undo steps are remembered. `resolve` gives the id a block has now, for a block that undo deleted and
 * made again (the server gave it a new id) while a change to it was on its way.
 */
export type HistoryRecorder = Pick<TimelineHistory, "record"> & Partial<Pick<TimelineHistory, "resolve">>;
