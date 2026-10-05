// @vitest-environment happy-dom
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { useTemplates } from "../src/hooks/queries";
import { cacheBuster, createKeyValuePersister, type KeyValueStorage } from "../src/persistence";
import { DataProvider, useData } from "../src/provider";
import { tick, useServer } from "./world";

const server = useServer();

const memoryStorage = (): KeyValueStorage & { items: Map<string, string> } => {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
};

/** The provider the way an app mounts it: no client of its own to hand in, so it makes (and drops) them. */
function mount(options: { userId: string | null; storage?: ReturnType<typeof memoryStorage> }) {
  const persister = options.storage ? createKeyValuePersister(options.storage, { throttleTime: 0 }) : undefined;
  let userId = options.userId;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <DataProvider api={server.current.api} userId={userId} persister={persister}>
      {children}
    </DataProvider>
  );
  const view = renderHook(() => useTemplates(), { wrapper });
  return {
    ...view,
    signInAs: (next: string | null) => {
      userId = next;
      view.rerender();
    },
  };
}

describe("DataProvider", () => {
  it("is required by the hooks", () => {
    const quiet = () => undefined;
    const original = console.error;
    console.error = quiet; // React logs the error it is about to throw
    try {
      expect(() => renderHook(() => useData())).toThrow("useData must be used inside <DataProvider>");
    } finally {
      console.error = original;
    }
  });

  it("gives the screens their data", async () => {
    const view = mount({ userId: "a" });
    await waitFor(() => expect(view.result.current.data?.length).toBeGreaterThan(5));
  });

  it("starts a new person with an empty cache, never the previous person's", async () => {
    const view = mount({ userId: "a" });
    await waitFor(() => expect(view.result.current.data).toBeDefined());

    const release = server.current.hold("GET /api/templates");
    view.signInAs("b");

    await tick();
    expect(view.result.current.data).toBeUndefined(); // while b's own request is out
    release();
    await waitFor(() => expect(view.result.current.data).toBeDefined());
  });

  it("drops the data when signed out", async () => {
    const view = mount({ userId: "a" });
    await waitFor(() => expect(view.result.current.data).toBeDefined());

    const release = server.current.hold("GET /api/templates");
    view.signInAs(null);
    await tick();
    expect(view.result.current.data).toBeUndefined();
    release();
  });
});

describe("a cache kept on the device", () => {
  it("opens with the saved data on screen while it asks the server again", async () => {
    const storage = memoryStorage();
    const first = mount({ userId: "a", storage });
    await waitFor(() => expect(first.result.current.data).toBeDefined());
    await waitFor(() => expect(storage.items.get("klndr-query-cache")).toBeDefined());
    first.unmount();

    // The app was last open an hour ago, so what was saved is old enough that it must be refreshed.
    const saved = JSON.parse(storage.items.get("klndr-query-cache")!);
    for (const query of saved.clientState.queries) query.state.dataUpdatedAt -= 60 * 60 * 1000;
    storage.items.set("klndr-query-cache", JSON.stringify(saved));

    const release = server.current.hold("GET /api/templates"); // the network is slow
    const second = mount({ userId: "a", storage });

    await waitFor(() => expect(second.result.current.data?.length).toBeGreaterThan(5));
    expect(second.result.current.isFetching).toBe(true); // shown from the device, still being refreshed
    release();
    await waitFor(() => expect(second.result.current.isFetching).toBe(false));
  });

  it("trusts what was saved a moment ago without asking again", async () => {
    const storage = memoryStorage();
    const first = mount({ userId: "a", storage });
    await waitFor(() => expect(first.result.current.data).toBeDefined());
    await waitFor(() => expect(storage.items.get("klndr-query-cache")).toBeDefined());
    first.unmount();
    const requestsSoFar = server.current.sent.filter((line) => line === "GET /api/templates").length;

    const second = mount({ userId: "a", storage });
    await waitFor(() => expect(second.result.current.data).toBeDefined());
    await tick();

    expect(second.result.current.isFetching).toBe(false);
    expect(server.current.sent.filter((line) => line === "GET /api/templates")).toHaveLength(requestsSoFar);
  });

  it("never shows one person's saved data to another", async () => {
    const storage = memoryStorage();
    const first = mount({ userId: "a", storage });
    await waitFor(() => expect(first.result.current.data).toBeDefined());
    await waitFor(() => expect(storage.items.get("klndr-query-cache")).toBeDefined());
    first.unmount();
    expect(storage.items.get("klndr-query-cache")).toContain(cacheBuster("a"));

    const release = server.current.hold("GET /api/templates");
    const other = mount({ userId: "b", storage });

    await tick();
    await tick();
    expect(other.result.current.data).toBeUndefined(); // a's templates were not restored
    release();
    await waitFor(() => expect(other.result.current.data).toBeDefined());
  });

  it("wipes what was saved when the person signs out", async () => {
    const storage = memoryStorage();
    const view = mount({ userId: "a", storage });
    await waitFor(() => expect(view.result.current.data).toBeDefined());
    await waitFor(() => expect(storage.items.get("klndr-query-cache")).toBeDefined());

    view.signInAs(null);

    await waitFor(() => expect(storage.items.has("klndr-query-cache")).toBe(false));
  });

  it("saves nothing while signed out", async () => {
    const storage = memoryStorage();
    const view = mount({ userId: null, storage });
    await waitFor(() => expect(view.result.current.data).toBeDefined());
    await tick();
    expect(storage.items.size).toBe(0);
  });
});
