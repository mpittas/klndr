import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { announceChange, rootsAffectedBy, syncQueryClientAcrossTabs } from "../src/tab-sync";

/** Channels of one name reach every other channel of that name, like `BroadcastChannel`. */
function fakeBus() {
  const open = new Map<string, Set<{ onmessage: ((event: MessageEvent) => void) | null }>>();
  return (name: string) => {
    const peer: { onmessage: ((event: MessageEvent) => void) | null; postMessage: (data: unknown) => void; close: () => void } = {
      onmessage: null,
      postMessage: (data) => {
        for (const other of open.get(name) ?? []) if (other !== peer) other.onmessage?.({ data } as MessageEvent);
      },
      close: () => open.get(name)?.delete(peer),
    };
    open.set(name, (open.get(name) ?? new Set()).add(peer));
    return peer;
  };
}

const twoTabs = () => {
  const createChannel = fakeBus();
  const a = new QueryClient();
  const b = new QueryClient();
  const stopA = syncQueryClientAcrossTabs(a, { channelName: "me", createChannel });
  const stopB = syncQueryClientAcrossTabs(b, { channelName: "me", createChannel });
  return { a, b, stop: () => (stopA(), stopB()) };
};

describe("tab sync", () => {
  it("refetches in the other tab after a change is saved in this one", async () => {
    const { a, b, stop } = twoTabs();
    const fetchTasks = vi.fn(async () => []);
    await b.fetchQuery({ queryKey: ["tasks", "day", "2031-04-14"], queryFn: fetchTasks, staleTime: Infinity });
    await a.getMutationCache().build(a, { mutationKey: ["tasks", "toggle"], mutationFn: async () => 1 }).execute(undefined);

    expect(b.getQueryState(["tasks", "day", "2031-04-14"])?.isInvalidated).toBe(true);
    expect(a.getQueryState(["tasks", "day", "2031-04-14"])).toBeUndefined();
    stop();
  });

  it("also refreshes what a change reaches: a category change refreshes the blocks", () => {
    expect(rootsAffectedBy("categories")).toEqual(["categories", "templates", "tasks"]);
    expect(rootsAffectedBy("notes")).toEqual(["notes"]);
  });

  it("announces changes that are not mutations, such as saved notes", () => {
    const { a, b, stop } = twoTabs();
    b.setQueryData(["notes", "2031-04-14"], { day: "2031-04-14", text: "old" });
    announceChange(a, ["notes"]);
    expect(b.getQueryState(["notes", "2031-04-14"])?.isInvalidated).toBe(true);
    stop();
  });

  it("holds the refresh back while this tab still has a change in flight", async () => {
    const { a, b, stop } = twoTabs();
    b.setQueryData(["tasks", "day", "d"], []);
    let finish!: () => void;
    const slow = b.getMutationCache().build(b, {
      mutationKey: ["tasks", "move"],
      mutationFn: () => new Promise<void>((resolve) => (finish = resolve)),
    });
    const running = slow.execute(undefined);
    await vi.waitFor(() => expect(b.isMutating()).toBe(1));
    announceChange(a, ["tasks"]);
    expect(b.getQueryState(["tasks", "day", "d"])?.isInvalidated).toBe(false);
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    finish();
    await running;
    expect(b.getQueryState(["tasks", "day", "d"])?.isInvalidated).toBe(true);
    stop();
  });

  it("stops listening once stopped", () => {
    const createChannel = fakeBus();
    const a = new QueryClient();
    const b = new QueryClient();
    syncQueryClientAcrossTabs(a, { channelName: "me", createChannel });
    syncQueryClientAcrossTabs(b, { channelName: "me", createChannel })();
    b.setQueryData(["notes", "d"], { day: "d", text: "" });
    announceChange(a, ["notes"]);
    expect(b.getQueryState(["notes", "d"])?.isInvalidated).toBe(false);
  });
});

describe("changes from other devices", () => {
  const liveFeed = () => {
    let push: (roots: string[]) => void = () => {};
    let stopped = false;
    return {
      remote: {
        subscribe(onChange: (roots: string[]) => void) {
          push = onChange;
          return () => void (stopped = true);
        },
      },
      push: (roots: string[]) => push(roots),
      get stopped() {
        return stopped;
      },
    };
  };

  it("refreshes what a device reports, and what that change reaches", () => {
    const feed = liveFeed();
    const client = new QueryClient();
    const stop = syncQueryClientAcrossTabs(client, { channelName: "me", tabs: false, remote: feed.remote });
    client.setQueryData(["tasks", "day", "d"], []);
    client.setQueryData(["templates"], []);
    client.setQueryData(["checklist", "items"], []);
    feed.push(["categories"]);

    expect(client.getQueryState(["tasks", "day", "d"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["templates"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["checklist", "items"])?.isInvalidated).toBe(false);
    stop();
    expect(feed.stopped).toBe(true);
  });

  it("works without a BroadcastChannel", () => {
    const feed = liveFeed();
    const client = new QueryClient();
    client.setQueryData(["notes", "d"], { day: "d", text: "" });
    const stop = syncQueryClientAcrossTabs(client, { channelName: "me", tabs: false, remote: feed.remote });
    feed.push(["notes"]);
    expect(client.getQueryState(["notes", "d"])?.isInvalidated).toBe(true);
    stop();
  });
});
