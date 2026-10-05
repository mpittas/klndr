import type { ApiClient, TimelineHistory } from "@klndr/core";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider, type Persister } from "@tanstack/react-query-persist-client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type PropsWithChildren } from "react";
import { createQueryClient } from "./client";
import type { Notify } from "./mutations/types";
import { cacheBuster, CACHE_MAX_AGE_MS } from "./persistence";
import type { ProfileSource } from "./hooks/profile";

/** The undo history of the day on screen. */
export type HistoryHolder = { current: { day: string; history: TimelineHistory } | null };

type DataContextValue = {
  api: ApiClient;
  notify: Notify;
  profile: ProfileSource | null;
  /**
   * Where the day's undo history lives, so that every screen that changes that day's blocks (the timeline, the
   * editor opened over it) records into, and undoes from, the same one. It starts afresh for a new person.
   */
  histories: HistoryHolder;
  /** The emoji already suggested this session, by title (see `useEmojiSuggester`). Starts empty for a new person. */
  emojiCache: Map<string, string>;
};

const DataContext = createContext<DataContextValue | null>(null);

export type DataProviderProps = PropsWithChildren<{
  /** The HTTP API, with the signed-in user's token attached (see `createApiClient`). */
  api: ApiClient;
  /**
   * Whose data this is, or null once it is known that no one is signed in. Everything cached belongs to this
   * person: the cache is started afresh when it changes, and a cache saved on the device is only restored for
   * the same person. `null` also wipes the saved cache, so don't mount the provider while the app is still
   * finding out who is signed in (a restored session takes a moment): that is not the same as signed out.
   */
  userId: string | null;
  /** Where messages such as "Added Workout" go. */
  notify?: Notify;
  /** Reads and writes the signed-in user's profile; only needed by screens that show it. */
  profile?: ProfileSource;
  /** Keep the cache on the device with this (see `createKeyValuePersister`). Off by default. */
  persister?: Persister;
  /** Bring your own client, for tests. */
  queryClient?: QueryClient;
}>;

/**
 * Gives the screens below it their data: the API, the query cache and the place messages go. Put it inside
 * whatever knows who is signed in, and pass that person's id as `userId`.
 */
export function DataProvider({ api, userId, notify, profile, persister, queryClient, children }: DataProviderProps) {
  // A new person gets a new cache, never the previous person's.
  const client = useMemo(() => queryClient ?? createQueryClient(), [queryClient, userId]);
  // Drop the previous person's data (and its timers) when the cache is replaced or the provider goes away.
  useEffect(
    () => () => {
      if (!queryClient) client.clear();
    },
    [client, queryClient],
  );

  // Nobody signed in: nothing of the last person's stays on the device.
  useEffect(() => {
    if (persister && !userId) void persister.removeClient();
  }, [persister, userId]);

  // `notify` often changes identity on every render of its owner; the hooks below keep one function.
  const latestNotify = useRef(notify);
  latestNotify.current = notify;
  const stableNotify = useCallback<Notify>((message) => latestNotify.current?.(message), []);

  const histories = useMemo<HistoryHolder>(() => ({ current: null }), [client]);
  const emojiCache = useMemo(() => new Map<string, string>(), [client]);
  const value = useMemo<DataContextValue>(
    () => ({ api, notify: stableNotify, profile: profile ?? null, histories, emojiCache }),
    [api, stableNotify, profile, histories, emojiCache],
  );
  const tree = <DataContext.Provider value={value}>{children}</DataContext.Provider>;

  if (!persister || !userId) return <QueryClientProvider client={client}>{tree}</QueryClientProvider>;
  return (
    <PersistQueryClientProvider
      key={userId}
      client={client}
      persistOptions={{ persister, maxAge: CACHE_MAX_AGE_MS, buster: cacheBuster(userId) }}
    >
      {tree}
    </PersistQueryClientProvider>
  );
}

/** The API, the notifier and the profile source of the nearest `DataProvider`. */
export function useData(): DataContextValue {
  const value = useContext(DataContext);
  if (!value) throw new Error("useData must be used inside <DataProvider>");
  return value;
}
