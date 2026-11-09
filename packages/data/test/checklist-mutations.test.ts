import type { ChecklistItem, DayChecklist } from "@klndr/core";
import { describe, expect, it, vi } from "vitest";
import { checklistItemsQuery, dayChecklistQuery } from "../src/hooks/queries";
import { queryKeys } from "../src/keys";
import { checklistMutationOptions } from "../src/mutations/checklist";
import { createDeps, DAY, run, useServer } from "./world";

const server = useServer();

async function setup() {
  const { deps, queryClient, messages } = createDeps(server.current);
  const { api } = server.current;
  await Promise.all([
    queryClient.fetchQuery(checklistItemsQuery(api)),
    queryClient.fetchQuery(dayChecklistQuery(api, DAY)),
  ]);
  return {
    options: checklistMutationOptions(deps),
    queryClient,
    messages,
    items: () => queryClient.getQueryData<ChecklistItem[]>(queryKeys.checklist.items) ?? [],
    day: () => queryClient.getQueryData<DayChecklist>(queryKeys.checklist.day(DAY))!,
  };
}

describe("ticking a routine", () => {
  it("ticks it at once and takes the server's copy when it answers", async () => {
    const { options, queryClient, items, day } = await setup();
    const id = items()[0].id;
    const release = server.current.hold("POST /api/checklist/toggle");

    const done = run(queryClient, options.toggle, { day: DAY, itemId: id, completed: true });
    await vi.waitFor(() => expect(day().completedItemIds).toEqual([id]));
    release();
    await done;

    expect(day().completedItemIds).toEqual([id]);
    expect((await server.current.api.getDayChecklist(DAY)).completedItemIds).toEqual([id]);
  });

  it("unticks it", async () => {
    const { options, queryClient, items, day } = await setup();
    const id = items()[0].id;
    await run(queryClient, options.toggle, { day: DAY, itemId: id, completed: true });
    await run(queryClient, options.toggle, { day: DAY, itemId: id, completed: false });
    expect(day().completedItemIds).toEqual([]);
  });

  it("puts it back and says so when saving fails", async () => {
    const { options, queryClient, messages, items, day } = await setup();
    server.current.fail("POST /api/checklist/toggle");
    await expect(run(queryClient, options.toggle, { day: DAY, itemId: items()[0].id, completed: true })).rejects.toThrow();
    expect(day().completedItemIds).toEqual([]);
    expect(messages).toEqual(["Could not update checklist item"]);
  });

  it("still saves when that day wasn't loaded, and stores the answer", async () => {
    const { options, queryClient, items } = await setup();
    const other = "2031-07-07";
    await run(queryClient, options.toggle, { day: other, itemId: items()[0].id, completed: true });
    expect(queryClient.getQueryData<DayChecklist>(queryKeys.checklist.day(other))?.completedItemIds).toEqual([
      items()[0].id,
    ]);
  });

  it("applies quick ticks in the order they were made", async () => {
    const { options, queryClient, items, day } = await setup();
    const id = items()[0].id;
    const release = server.current.hold("POST /api/checklist/toggle");

    const on = run(queryClient, options.toggle, { day: DAY, itemId: id, completed: true });
    const off = run(queryClient, options.toggle, { day: DAY, itemId: id, completed: false });
    release();
    await Promise.all([on, off]);

    expect(day().completedItemIds).toEqual([]);
    expect((await server.current.api.getDayChecklist(DAY)).completedItemIds).toEqual([]);
  });
});

describe("the routines for every day", () => {
  it("adds one at the end of the list", async () => {
    const { options, queryClient, items } = await setup();
    const created = await run(queryClient, options.create, { title: "Floss", emoji: "🦷", order: 99 });
    expect(items().at(-1)).toEqual(created);
  });

  it("edits one in place and keeps the order", async () => {
    const { options, queryClient, items } = await setup();
    const first = items()[0];
    const updated = await run(queryClient, options.update, { id: first.id, patch: { title: "Renamed" } });
    expect(items()[0]).toEqual(updated);
    expect(items()).toHaveLength(items().length);
  });

  it("deletes one, and it is no longer ticked or skipped on any day", async () => {
    const { options, queryClient, items, day } = await setup();
    const [a, b] = items();
    await run(queryClient, options.toggle, { day: DAY, itemId: a.id, completed: true });
    await run(queryClient, options.hide, { day: DAY, item: b, hidden: true });
    expect(day()).toMatchObject({ completedItemIds: [a.id], hiddenItemIds: [b.id] });

    await run(queryClient, options.remove, { id: a.id });
    await run(queryClient, options.remove, { id: b.id });

    expect(items().map((i) => i.id)).not.toContain(a.id);
    expect(day()).toMatchObject({ completedItemIds: [], hiddenItemIds: [] });
  });

  it("throws the server's message when it is refused", async () => {
    const { options, queryClient, items } = await setup();
    const before = items();
    await expect(run(queryClient, options.create, { title: " ", emoji: "🦷" })).rejects.toThrow("Title is required");
    expect(items()).toBe(before);
  });
});

describe("what differs on one day", () => {
  it("skips a routine for the day and brings it back, saying so", async () => {
    const { options, queryClient, messages, items, day } = await setup();
    const item = items()[0];

    await run(queryClient, options.hide, { day: DAY, item, hidden: true });
    expect(day().hiddenItemIds).toEqual([item.id]);
    await run(queryClient, options.hide, { day: DAY, item, hidden: false });
    expect(day().hiddenItemIds).toEqual([]);

    expect(messages).toEqual([`Skipped "${item.title}" for this day`, `Restored "${item.title}"`]);
  });

  it("adds a one-off item for the day and removes it", async () => {
    const { options, queryClient, messages, day } = await setup();

    await run(queryClient, options.addExtra, { day: DAY, title: "Call mum", emoji: "📞" });
    const [extra] = day().extraItems;
    expect(extra).toMatchObject({ title: "Call mum", emoji: "📞" });

    await run(queryClient, options.removeExtra, { day: DAY, item: extra });
    expect(day().extraItems).toEqual([]);
    expect(messages).toEqual(['Added "Call mum" for this day', 'Removed "Call mum"']);
  });

  it("throws the server's message and shows nothing when a one-off is refused", async () => {
    const { options, queryClient, messages, day } = await setup();
    await expect(run(queryClient, options.addExtra, { day: DAY, title: " ", emoji: "x" })).rejects.toThrow(
      "Title is required",
    );
    expect(day().extraItems).toEqual([]);
    expect(messages).toEqual([]);
  });
});
