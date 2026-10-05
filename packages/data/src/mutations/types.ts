import type { ApiClient, TimelineHistory } from "@klndr/core";
import type { QueryClient } from "@tanstack/react-query";

/** Where "Added Workout" and "Could not save that block" go: a flash on the web, a toast on the phone. */
export type Notify = (message: string) => void;

/** What every mutation needs from the app around it. */
export type MutationDeps = {
  api: ApiClient;
  queryClient: QueryClient;
  notify: Notify;
};

/** Where undo steps are remembered; absent when no timeline is on screen to undo on. */
export type HistoryRecorder = Pick<TimelineHistory, "record">;
