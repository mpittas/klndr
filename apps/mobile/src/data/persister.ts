import { createKeyValuePersister, type KeyValueStorage } from "@klndr/data";

import { storage } from "@/lib/storage";

/** MMKV behind the three methods the cache persister needs. */
const mmkv: KeyValueStorage = {
  getItem: (key) => storage.getString(key) ?? null,
  setItem: (key, value) => void storage.set(key, value),
  removeItem: (key) => void storage.remove(key),
};

/**
 * The query cache, kept on the phone so the app opens with the last data on screen and refreshes it once
 * the network answers. It belongs to whoever is signed in (see `DataProvider`'s `userId`) and is wiped on
 * sign-out.
 */
export const queryPersister = createKeyValuePersister(mmkv);
