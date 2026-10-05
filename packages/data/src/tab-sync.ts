import type { QueryClient } from "@tanstack/react-query";

/**
 * Keeping every open copy of the app in step: other tabs of the same browser, and the person's other
 * devices. Each copy has its own query cache, so a change made in one is invisible to the others until they
 * ask the server again. So the copy that saves a change tells the others which kind of data changed, and
 * they mark it stale and refetch whatever they are showing. The data itself never travels that way — the
 * server stays the single source of truth — so the copies cannot disagree about it.
 *
 *  - Tabs of one browser hear each other at once over a `BroadcastChannel`.
 *  - Other devices are heard through `LiveChanges`, which the app provides (the web app listens to a small
 *    Firestore document that the API stamps whenever it saves something).
 */

/** A feed of changes made elsewhere: calls `onChange` with the query-key roots that changed (`["tasks"]`). */
export type LiveChanges = {
  /** Start listening; returns a function that stops. */
  subscribe(onChange: (roots: string[]) => void): () => void;
};

type Message = { from: string; roots: string[] };

/** What else a change reaches: a recolored category or activity recolors the blocks, a block may add a category. */
const ALSO_AFFECTS: Record<string, string[]> = {
  tasks: ["categories"],
  templates: ["tasks"],
  categories: ["templates", "tasks"],
};

/** The query-key roots to refresh after a change under `root` (see `queryKeys`). */
export function rootsAffectedBy(root: string): string[] {
  return [root, ...(ALSO_AFFECTS[root] ?? [])];
}

const announcers = new WeakMap<QueryClient, (roots: string[]) => void>();

/** Tell the other tabs that data under these query-key roots changed, e.g. `["notes"]`. No-op without sync. */
export function announceChange(client: QueryClient, roots: string[]): void {
  announcers.get(client)?.(roots);
}

type Channel = Pick<BroadcastChannel, "postMessage" | "close"> & { onmessage: ((event: MessageEvent) => void) | null };

export type TabSyncOptions = {
  /** Lets the data of different people on one browser stay apart. */
  channelName: string;
  /** Hear the other tabs of this browser. On by default. */
  tabs?: boolean;
  /** Hear the person's other devices. */
  remote?: LiveChanges;
  /** Replace for tests; defaults to the browser's `BroadcastChannel`. */
  createChannel?: (name: string) => Channel;
};

/** Start syncing `client` with the other tabs and devices. Returns a function that stops it. */
export function syncQueryClientAcrossTabs(client: QueryClient, options: TabSyncOptions): () => void {
  const create =
    options.tabs === false
      ? null
      : (options.createChannel ?? (typeof BroadcastChannel === "undefined" ? null : (name: string) => new BroadcastChannel(name)));
  const channel = create?.(`klndr-sync:${options.channelName}`) ?? null;
  const tabId = Math.random().toString(36).slice(2);
  const pending = new Set<string>();

  // Refetching under a change still on its way to the server could briefly bring back the old state, so
  // what others reported waits until this copy has nothing in flight.
  const flush = () => {
    if (client.isMutating() > 0 || pending.size === 0) return;
    const roots = [...pending];
    pending.clear();
    for (const root of roots) void client.invalidateQueries({ queryKey: [root] });
  };

  const receive = (roots: string[]) => {
    for (const root of roots) for (const affected of rootsAffectedBy(root)) pending.add(affected);
    flush();
  };

  const announce = (roots: string[]) => {
    if (!channel) return;
    const message: Message = { from: tabId, roots };
    try {
      channel.postMessage(message);
    } catch {
      // A closed channel or a value that can't be sent: the others catch up on their next refetch.
    }
  };
  announcers.set(client, announce);

  if (channel) {
    channel.onmessage = (event) => {
      const message = event.data as Partial<Message> | null;
      if (!message || message.from === tabId || !Array.isArray(message.roots)) return;
      receive(message.roots.filter((root): root is string => typeof root === "string"));
    };
  }

  const stopRemote = options.remote?.subscribe(receive);

  const unsubscribe = client.getMutationCache().subscribe((event) => {
    if (event.type !== "updated") return;
    const { action, mutation } = event;
    const root = mutation.options.mutationKey?.[0];
    // A failed write may still have partly saved, so it is reported as well.
    if (typeof root === "string" && (action.type === "success" || action.type === "error")) {
      announce(rootsAffectedBy(root));
    }
    flush();
  });

  return () => {
    unsubscribe();
    stopRemote?.();
    if (channel) {
      channel.onmessage = null;
      channel.close();
    }
    if (announcers.get(client) === announce) announcers.delete(client);
  };
}
