import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import type { Persister } from "@tanstack/react-query-persist-client";

/**
 * Keeping the query cache on the device, so the app opens with yesterday's data on screen and updates it
 * once the network answers. The store is injected: MMKV on the phone (`getString` / `set` / `remove`
 * behind these three methods), `localStorage` on the web if it is ever wanted.
 */
export type KeyValueStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

/** Bump when the shape of anything cached changes, so old caches are thrown away instead of misread. */
export const CACHE_VERSION = "1";

/** How long a saved cache is trusted. Queries also have to be kept in memory this long (`gcTime`). */
export const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Identifies whose data a saved cache holds. A cache saved for one person is discarded on restore for
 * anyone else, so signing out and in as someone different never shows the first person's schedule.
 */
export const cacheBuster = (userId: string) => `${CACHE_VERSION}:${userId}`;

export function createKeyValuePersister(
  storage: KeyValueStorage,
  options: { key?: string; throttleTime?: number } = {},
): Persister {
  return createSyncStoragePersister({
    // The persister only calls these three methods.
    storage: storage as unknown as Storage,
    key: options.key ?? "klndr-query-cache",
    throttleTime: options.throttleTime ?? 1000,
  });
}
