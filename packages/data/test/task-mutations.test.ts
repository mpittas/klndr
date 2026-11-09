import type { ScheduledTask } from "@klndr/core";
import { describe, expect, it, vi } from "vitest";
import { draftFromTemplate, isTempId, planMove } from "../src/blocks";
import { queryKeys } from "../src/keys";
import { categoriesQuery, dayTasksQuery, rangeTasksQuery, templatesQuery } from "../src/hooks/queries";
import { taskMutationOptions } from "../src/mutations/tasks";
import { createDeps, DAY, run, tick, useServer } from "./world";

const server = useServer();
const key = queryKeys.tasks.day(DAY);

/** Everything a test needs: caches loaded as a day screen would have them, and the mutations over them. */
async function setup(seed: Array<Partial<ScheduledTask>> = []) {
  const { deps, queryClient, messages, history } = createDeps(server.current);
  const seeded: ScheduledTask[] = [];
  for (const extra of seed) seeded.push(await server.current.seedTask(DAY, extra));
  await queryClient.fetchQuery(dayTasksQuery(server.current.api, DAY));
  const options = taskMutationOptions({ ...deps, history });
  const list = () => queryClient.getQueryData<ScheduledTask[]>(key) ?? [];
  return { options, queryClient, messages, history, seeded, list };
}

describe("adding a block", () => {
  it("shows it at once under a temporary id, then swaps in the saved block", async () => {
    const { options, queryClient, messages, history, list } = await setup();
    const release = server.current.hold("POST /api/tasks");

    const template = (await server.current.api.getTemplates())[0];
    const draft = draftFromTemplate(DAY, template, 600, "sky");
    const done = run(queryClient, options.create, { draft });

    await vi.waitFor(() => expect(list()).toHaveLength(1));
    expect(isTempId(list()[0].id)).toBe(true);
    expect(list()[0]).toMatchObject({ title: template.name, startMinutes: 600, templateId: template.id });
    expect(messages).toEqual([]); // nothing to say yet

    release();
    const created = await done;

    expect(list()).toEqual([created]); // the temporary block is gone, not duplicated
    expect(isTempId(created.id)).toBe(false);
    expect(messages).toEqual([`Added ${template.name}`]);
    expect(history.record).toHaveBeenCalledWith(`Add ${template.name}`, [[null, created]]);
  });

  it("also appears in a month that covers the day", async () => {
    const { options, queryClient } = await setup();
    await queryClient.fetchQuery(rangeTasksQuery(server.current.api, "2031-04-01", "2031-04-30"));
    const release = server.current.hold("POST /api/tasks");

    const done = run(queryClient, options.create, {
      draft: { day: DAY, title: "Quick", emoji: "⚡", color: "sky", category: "Work", startMinutes: 480, durationMinutes: 30 },
    });
    await vi.waitFor(() =>
      expect(queryClient.getQueryData<ScheduledTask[]>(queryKeys.tasks.range("2031-04-01", "2031-04-30"))).toHaveLength(1),
    );
    release();
    await done;
  });

  it("takes the block off again, and says so, when saving fails", async () => {
    const { options, queryClient, messages, history, list } = await setup();
    server.current.fail("POST /api/tasks");

    await expect(
      run(queryClient, options.create, {
        draft: { day: DAY, title: "Nope", emoji: "⚡", color: "sky", category: "Work", startMinutes: 480, durationMinutes: 30 },
      }),
    ).rejects.toThrow("boom");

    expect(list()).toEqual([]);
    expect(messages).toEqual(["Could not save that block"]);
    expect(history.record).not.toHaveBeenCalled();
  });
});

describe("moving a block", () => {
  it("moves it at once, along with the columns of its neighbours, and saves them all", async () => {
    const { options, queryClient, messages, history, seeded, list } = await setup([{ title: "A" }, { title: "B" }]);
    const [a, b] = seeded;
    const changes = planMove(list(), a, 660, new Map([[a.id, 1], [b.id, 0]]));
    const release = server.current.hold("PATCH /api/tasks");

    const done = run(queryClient, options.move, { task: a, start: 660, changes });

    await vi.waitFor(() => expect(list().find((t) => t.id === a.id)?.startMinutes).toBe(660));
    expect(list().find((t) => t.id === a.id)?.lane).toBe(1);
    expect(list().find((t) => t.id === b.id)?.lane).toBe(0);
    expect(server.current.sent.filter((line) => line.startsWith("PATCH"))).toHaveLength(2); // both are on their way

    release();
    await done;

    const onServer = await server.current.api.getTasksForDay(DAY);
    expect(onServer.find((t) => t.id === a.id)).toMatchObject({ startMinutes: 660, lane: 1 });
    expect(onServer.find((t) => t.id === b.id)).toMatchObject({ lane: 0 });
    expect(messages).toEqual(["A → 11:00 AM"]);

    const [label, pairs] = history.record.mock.calls[0];
    expect(label).toBe("Move A");
    expect(pairs).toHaveLength(2);
    expect(pairs[0][0]).toMatchObject({ id: a.id, startMinutes: 540 }); // before
    expect(pairs[0][1]).toMatchObject({ id: a.id, startMinutes: 660, lane: 1 }); // after
  });

  it("says 'Moved' when only a neighbour's column changed", async () => {
    const { options, queryClient, messages, seeded, list } = await setup([{ title: "A" }, { title: "B" }]);
    const [a, b] = seeded;
    const changes = planMove(list(), a, a.startMinutes, new Map([[b.id, 1]]));
    await run(queryClient, options.move, { task: a, start: a.startMinutes, changes });
    expect(messages).toEqual(["Moved A"]);
  });

  it("puts everything back and asks the server again when saving fails", async () => {
    const { options, queryClient, messages, history, seeded, list } = await setup([{ title: "A" }, { title: "B" }]);
    const [a, b] = seeded;
    const before = structuredClone(list());
    const changes = planMove(list(), a, 660, new Map([[b.id, 1]]));
    server.current.fail(`PATCH /api/tasks/${b.id}`); // a is saved, b is not

    await expect(run(queryClient, options.move, { task: a, start: 660, changes })).rejects.toThrow("boom");

    expect(list()).toEqual(before);
    expect(messages).toEqual(["Could not move that block"]);
    expect(history.record).not.toHaveBeenCalled();
    // `a` did reach the server, so what is shown can't be trusted until it is fetched again
    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
    expect((await server.current.api.getTasksForDay(DAY)).find((t) => t.id === a.id)?.startMinutes).toBe(660);
  });
});

describe("resizing a block", () => {
  it("shows the new length at once and records the step", async () => {
    const { options, queryClient, history, seeded, list } = await setup([{ title: "A", durationMinutes: 60 }]);
    const [a] = seeded;
    const release = server.current.hold("PATCH /api/tasks");

    const done = run(queryClient, options.resize, { task: a, durationMinutes: 90 });
    await vi.waitFor(() => expect(list()[0].durationMinutes).toBe(90));
    release();
    const saved = await done;

    expect(saved.durationMinutes).toBe(90);
    const [label, pairs] = history.record.mock.calls[0];
    expect(label).toBe("Resize A");
    expect(pairs[0][0]).toMatchObject({ durationMinutes: 60 });
    expect(pairs[0][1]).toMatchObject({ durationMinutes: 90 });
  });

  it("goes back to the old length when saving fails", async () => {
    const { options, queryClient, messages, history, seeded, list } = await setup([{ title: "A", durationMinutes: 60 }]);
    server.current.fail("PATCH /api/tasks");
    await expect(run(queryClient, options.resize, { task: seeded[0], durationMinutes: 90 })).rejects.toThrow();
    expect(list()[0].durationMinutes).toBe(60);
    expect(messages).toEqual(["Could not resize that block"]);
    expect(history.record).not.toHaveBeenCalled();
  });
});

describe("ticking a block off", () => {
  it("ticks at once, and labels the step by what it did", async () => {
    const { options, queryClient, history, seeded, list } = await setup([{ title: "A" }]);
    const [a] = seeded;

    const release = server.current.hold("PATCH /api/tasks");
    const done = run(queryClient, options.toggle, { task: a, completed: true });
    await vi.waitFor(() => expect(list()[0].completed).toBe(true));
    release();
    await done;
    expect(history.record.mock.calls[0][0]).toBe("Complete A");

    await run(queryClient, options.toggle, { task: list()[0], completed: false });
    expect(history.record.mock.calls[1][0]).toBe("Reopen A");
    expect(list()[0].completed).toBe(false);
  });

  it("unticks and says so when saving fails", async () => {
    const { options, queryClient, messages, seeded, list } = await setup([{ title: "A" }]);
    server.current.fail("PATCH /api/tasks");
    await expect(run(queryClient, options.toggle, { task: seeded[0], completed: true })).rejects.toThrow();
    expect(list()[0].completed).toBe(false);
    expect(messages).toEqual(["Could not update that block"]);
  });
});

describe("deleting a block", () => {
  it("removes it at once and records the step so it can be brought back", async () => {
    const { options, queryClient, messages, history, seeded, list } = await setup([{ title: "A" }, { title: "B" }]);
    const [a] = seeded;
    const release = server.current.hold("DELETE /api/tasks");

    const done = run(queryClient, options.remove, { task: a });
    await vi.waitFor(() => expect(list().map((t) => t.title)).toEqual(["B"]));
    release();
    await done;

    expect(messages).toEqual(["Deleted A"]);
    expect(history.record).toHaveBeenCalledWith("Delete A", [[a, null]]);
    expect((await server.current.api.getTasksForDay(DAY)).map((t) => t.title)).toEqual(["B"]);
  });

  it("brings it back when deleting fails", async () => {
    const { options, queryClient, messages, history, seeded, list } = await setup([{ title: "A" }]);
    server.current.fail("DELETE /api/tasks");
    await expect(run(queryClient, options.remove, { task: seeded[0] })).rejects.toThrow();
    expect(list()).toEqual(seeded);
    expect(messages).toEqual(["Could not delete that block"]);
    expect(history.record).not.toHaveBeenCalled();
  });
});

describe("changes made in quick succession", () => {
  it("show at once but reach the server in the order they were made", async () => {
    const { options, queryClient, seeded, list } = await setup([{ title: "A", startMinutes: 540 }]);
    const [a] = seeded;
    const release = server.current.hold(/^PATCH .*$/);

    // Drag the block, then tick it, before the server has answered the drag.
    const move = run(queryClient, options.move, { task: a, start: 600, changes: planMove(list(), a, 600) });
    const toggle = run(queryClient, options.toggle, { task: a, completed: true });

    await vi.waitFor(() => expect(list()[0]).toMatchObject({ startMinutes: 600, completed: true }));
    await tick();
    expect(server.current.sent.filter((line) => line.startsWith("PATCH"))).toHaveLength(1); // the tick waits its turn

    release();
    await Promise.all([move, toggle]);
    expect(server.current.sent.filter((line) => line.startsWith("PATCH"))).toHaveLength(2);
    expect(await server.current.api.getTasksForDay(DAY)).toMatchObject([{ startMinutes: 600, completed: true }]);
  });
});

describe("saving from the editor", () => {
  const payload = (extra: Record<string, unknown> = {}) => ({
    day: DAY,
    title: "Written",
    emoji: "✍️",
    color: "sky",
    category: "Work",
    startMinutes: 600,
    durationMinutes: 45,
    notes: null,
    ...extra,
  });

  it("waits for the server before showing a new block, then records it", async () => {
    const { options, queryClient, messages, history, list } = await setup();
    const release = server.current.hold("POST /api/tasks");

    const done = run(queryClient, options.save, { id: null, payload: payload() });
    await tick();
    expect(list()).toEqual([]); // nothing optimistic: the form is still waiting

    release();
    const saved = await done;
    expect(list()).toEqual([saved]);
    expect(history.record).toHaveBeenCalledWith("Add Written", [[null, saved]]);
    expect(messages).toEqual([]);
  });

  it("records an edit with the block as it was", async () => {
    const { options, queryClient, history, seeded, list } = await setup([{ title: "Old" }]);
    const saved = await run(queryClient, options.save, { id: seeded[0].id, payload: payload({ title: "New" }) });

    expect(list()).toEqual([saved]);
    const [label, pairs] = history.record.mock.calls[0];
    expect(label).toBe("Edit New");
    expect(pairs[0][0]).toMatchObject({ title: "Old" });
    expect(pairs[0][1]).toMatchObject({ title: "New" });
  });

  it("takes a block off the day when it was moved to another", async () => {
    const { options, queryClient, seeded, list } = await setup([{ title: "A" }]);
    await run(queryClient, options.save, { id: seeded[0].id, payload: payload({ day: "2031-04-15" }) });
    expect(list()).toEqual([]);
  });

  it("doesn't record an edit it couldn't undo", async () => {
    const { options, queryClient, history } = await setup();
    const elsewhere = await server.current.seedTask("2031-06-01", { title: "Not loaded" }); // not in any cache
    await run(queryClient, options.save, { id: elsewhere.id, payload: payload({ day: "2031-06-01" }) });
    expect(history.record).not.toHaveBeenCalled();
  });

  it("asks for the categories again, since a new one may have been made", async () => {
    const { options, queryClient } = await setup();
    await queryClient.fetchQuery(categoriesQuery(server.current.api));
    await run(queryClient, options.save, { id: null, payload: payload({ category: "Brand new" }) });
    expect(queryClient.getQueryState(queryKeys.categories)?.isInvalidated).toBe(true);
    await queryClient.fetchQuery(templatesQuery(server.current.api)); // unrelated, stays valid
    expect(queryClient.getQueryState(queryKeys.templates)?.isInvalidated).toBe(false);
  });

  it("throws the server's message and changes nothing when it refuses", async () => {
    const { options, queryClient, messages, history, list } = await setup();
    await expect(run(queryClient, options.save, { id: null, payload: payload({ title: "  " }) })).rejects.toThrow(
      "Title is required",
    );
    expect(list()).toEqual([]);
    expect(messages).toEqual([]); // the form shows it, not a toast
    expect(history.record).not.toHaveBeenCalled();
  });
});
