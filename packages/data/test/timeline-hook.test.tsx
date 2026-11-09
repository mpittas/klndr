// @vitest-environment happy-dom
import type { ScheduledTask } from "@dayro/core";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useTimelineHistory } from "../src/hooks/history";
import { useTaskActions } from "../src/hooks/tasks";
import { useDayTimeline } from "../src/hooks/timeline";
import { useRangeTasks } from "../src/hooks/queries";
import { queryKeys } from "../src/keys";
import { harness } from "./harness";
import { DAY, useServer } from "./world";

const server = useServer();
const NEXT_DAY = "2031-04-15";

// TanStack Query tells React about cache changes a tick after they happen, so what a hook returns is
// checked with `waitFor`, not straight after `act`.

/** The hook mounted the way a day screen would, with the day's blocks loaded. */
async function mount(day = DAY) {
  const h = harness(server.current);
  const view = renderHook(({ day }) => useDayTimeline(day), { wrapper: h.wrapper, initialProps: { day } });
  await waitFor(() => expect(view.result.current.query.isSuccess).toBe(true));
  return { ...h, ...view };
}

describe("useDayTimeline", () => {
  it("loads the day's blocks, empty while loading", async () => {
    await server.current.seedTask(DAY, { title: "Seeded" });
    const h = harness(server.current);
    const { result } = renderHook(() => useDayTimeline(DAY), { wrapper: h.wrapper });

    expect(result.current.tasks).toEqual([]);
    expect(result.current.query.isPending).toBe(true);
    await waitFor(() => expect(result.current.tasks.map((t) => t.title)).toEqual(["Seeded"]));
  });

  it("adds a block from an activity, and undoes and redoes it against the server", async () => {
    const { result, messages } = await mount();
    const template = (await server.current.api.getTemplates())[0];

    await act(() => result.current.createFromTemplate(template, 600));
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));
    expect(result.current.tasks[0]).toMatchObject({ title: template.name, startMinutes: 600 });
    expect(messages).toEqual([`Added ${template.name}`]);
    await waitFor(() => expect(result.current.canUndo).toBe(true));
    expect(result.current.canRedo).toBe(false);

    await act(() => result.current.undo());
    await waitFor(() => expect(result.current.tasks).toEqual([]));
    expect(await server.current.api.getTasksForDay(DAY)).toEqual([]);
    await waitFor(() => expect(result.current.canRedo).toBe(true));
    expect(result.current.canUndo).toBe(false);
    expect(messages.at(-1)).toBe(`Undid: Add ${template.name}`);

    await act(() => result.current.redo());
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));
    expect((await server.current.api.getTasksForDay(DAY))[0].title).toBe(template.name);
  });

  it("brings a deleted block back under a new id, and keeps undoing steps made before it", async () => {
    const seeded = await server.current.seedTask(DAY, { title: "Keep me" });
    const { result } = await mount();
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));

    await act(() => result.current.toggleComplete(result.current.tasks[0]));
    await waitFor(() => expect(result.current.tasks[0].completed).toBe(true));
    await act(() => result.current.deleteTask(result.current.tasks[0]));
    await waitFor(() => expect(result.current.tasks).toEqual([]));

    await act(() => result.current.undo()); // the delete
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));
    expect(result.current.tasks[0].id).not.toBe(seeded.id); // the server made it again
    expect(result.current.tasks[0].completed).toBe(true);

    await act(() => result.current.undo()); // the tick, which still names the old id
    await waitFor(() => expect(result.current.tasks[0].completed).toBe(false));
    expect((await server.current.api.getTasksForDay(DAY))[0]).toMatchObject({ title: "Keep me", completed: false });
  });

  it("says whether a delete worked, and puts the block back when it did not", async () => {
    await server.current.seedTask(DAY, { title: "Stubborn" });
    const { result, messages } = await mount();
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));
    server.current.fail("DELETE /api/tasks/");

    let deleted: boolean | undefined;
    await act(async () => {
      deleted = await result.current.deleteTask(result.current.tasks[0]);
    });
    expect(deleted).toBe(false);
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));
    expect(messages).toContain("Could not delete that block");

    await act(async () => {
      deleted = await result.current.deleteTask(result.current.tasks[0]);
    });
    expect(deleted).toBe(true);
    await waitFor(() => expect(result.current.tasks).toEqual([]));
  });

  it("moves a block, saves its neighbours' columns with it and undoes the whole step", async () => {
    const a = await server.current.seedTask(DAY, { title: "A" });
    const b = await server.current.seedTask(DAY, { title: "B" });
    const { result } = await mount();
    await waitFor(() => expect(result.current.tasks).toHaveLength(2));

    await act(() => result.current.moveTask(a, 720, new Map([[a.id, 1], [b.id, 0]])));
    await waitFor(() =>
      expect(result.current.tasks.find((t) => t.id === a.id)).toMatchObject({ startMinutes: 720, lane: 1 }),
    );

    await act(() => result.current.undo());
    const onServer = await server.current.api.getTasksForDay(DAY);
    expect(onServer.find((t) => t.id === a.id)).toMatchObject({ startMinutes: 540 });
    expect(onServer.find((t) => t.id === a.id)).not.toHaveProperty("lane");
    expect(onServer.find((t) => t.id === b.id)).not.toHaveProperty("lane");
    await waitFor(() => expect(result.current.tasks.find((t) => t.id === a.id)?.startMinutes).toBe(540));
  });

  it("sends nothing when a drop changes nothing", async () => {
    const a = await server.current.seedTask(DAY, { title: "A" });
    const { result } = await mount();
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));
    const before = server.current.sent.length;

    await act(() => result.current.moveTask(a, a.startMinutes));
    await act(() => result.current.resizeTask(a, a.durationMinutes));

    expect(server.current.sent.length).toBe(before);
    expect(result.current.canUndo).toBe(false);
  });

  it("keeps the history when the day on screen changes, and undoes a change made on the other day", async () => {
    const { result, rerender, queryClient } = await mount();
    const template = (await server.current.api.getTemplates())[0];
    await act(() => result.current.createFromTemplate(template, 600));
    await waitFor(() => expect(result.current.canUndo).toBe(true));

    rerender({ day: NEXT_DAY });
    await waitFor(() => expect(result.current.day).toBe(NEXT_DAY));
    expect(result.current.canUndo).toBe(true);

    await act(() => result.current.undo());
    expect(await server.current.api.getTasksForDay(DAY)).toEqual([]);
    expect(queryClient.getQueryData(queryKeys.tasks.day(DAY))).toEqual([]); // and gone from that day's list too
    expect(result.current.canRedo).toBe(true);
  });

  it("brings a block moved to another day back at once, before the server has answered", async () => {
    const seeded = await server.current.seedTask(DAY, { title: "Later" });
    const { result } = await mount();
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));
    await act(() => result.current.changeTask(seeded, { day: NEXT_DAY }));
    await waitFor(() => expect(result.current.tasks).toEqual([]));

    const release = server.current.hold("PATCH /api/tasks/");
    let undone!: Promise<void>;
    act(() => {
      undone = result.current.undo();
    });
    await waitFor(() => expect(result.current.tasks.map((t) => t.title)).toEqual(["Later"]));
    release();
    await act(() => undone);
    expect((await server.current.api.getTasksForDay(DAY)).map((t) => t.title)).toEqual(["Later"]);
  });

  it("saves a change made straight after an undo after the undo, so the screen and the server agree", async () => {
    const a = await server.current.seedTask(DAY, { title: "A" });
    const { result } = await mount();
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));
    await act(() => result.current.moveTask(a, 600));
    await waitFor(() => expect(result.current.canUndo).toBe(true));

    const release = server.current.hold("PATCH /api/tasks/");
    let undone!: Promise<void>;
    act(() => {
      undone = result.current.undo();
    });
    await waitFor(() => expect(result.current.tasks[0].startMinutes).toBe(540));
    let moved!: Promise<void>;
    act(() => {
      moved = result.current.moveTask(result.current.tasks[0], 480);
    });
    release();
    await act(() => Promise.all([undone, moved]));

    await waitFor(() => expect(result.current.tasks[0].startMinutes).toBe(480));
    expect((await server.current.api.getTasksForDay(DAY))[0].startMinutes).toBe(480);
  });

  it("splits a block in one step, so one undo puts it back together", async () => {
    const a = await server.current.seedTask(DAY, { title: "Long", durationMinutes: 60 });
    const { result, messages } = await mount();
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));

    await act(() => result.current.splitTask(a, 30));
    await waitFor(() =>
      expect(result.current.tasks.map((t) => [t.startMinutes, t.durationMinutes])).toEqual([
        [540, 30],
        [570, 30],
      ]),
    );
    expect(await server.current.api.getTasksForDay(DAY)).toHaveLength(2);

    await act(() => result.current.undo());
    await waitFor(() => expect(result.current.tasks.map((t) => t.durationMinutes)).toEqual([60]));
    expect((await server.current.api.getTasksForDay(DAY)).map((t) => t.durationMinutes)).toEqual([60]);
    expect(messages.at(-1)).toBe("Undid: Split Long");
    expect(result.current.canUndo).toBe(false);
  });

  it("reports a failed save through notify and leaves the timeline as it was", async () => {
    const { result, messages } = await mount();
    const template = (await server.current.api.getTemplates())[0];
    server.current.fail("POST /api/tasks");

    await act(() => result.current.createFromTemplate(template, 600)); // does not throw

    await waitFor(() => expect(result.current.tasks).toEqual([]));
    expect(messages).toEqual(["Could not save that block"]);
    expect(result.current.canUndo).toBe(false);
  });

  it("saves from the editor, throwing the server's message to the form", async () => {
    const { result } = await mount();
    const payload = { day: DAY, title: "Edited", emoji: "✍️", color: "sky", category: "Work", startMinutes: 600, durationMinutes: 30 };

    await act(async () => {
      await result.current.saveTask({ id: null, payload });
    });
    await waitFor(() => expect(result.current.tasks.map((t) => t.title)).toEqual(["Edited"]));

    let error: unknown;
    await act(async () => {
      await result.current.saveTask({ id: null, payload: { ...payload, title: " " } }).catch((e) => (error = e));
    });
    expect((error as Error).message).toBe("Title is required");
    expect(result.current.tasks).toHaveLength(1);
  });

  it("takes an undone block off a month grid that shows the day, without fetching it again", async () => {
    const h = harness(server.current);
    const view = renderHook(
      () => ({ day: useDayTimeline(DAY), month: useRangeTasks("2031-04-01", "2031-04-30") }),
      { wrapper: h.wrapper },
    );
    await waitFor(() => expect(view.result.current.day.query.isSuccess && view.result.current.month.isSuccess).toBe(true));
    const template = (await server.current.api.getTemplates())[0];

    await act(() => view.result.current.day.createFromTemplate(template, 600));
    await waitFor(() => expect(view.result.current.month.data).toHaveLength(1)); // the add reached the month too

    const fetches = () => server.current.sent.filter((line) => line.startsWith("GET /api/tasks?from=")).length;
    const before = fetches();
    await act(() => view.result.current.day.undo());
    await waitFor(() => expect(view.result.current.month.data).toEqual([]));
    expect(fetches()).toBe(before);
  });

  it("shares one undo history between every screen that changes the day, like the timeline and the editor over it", async () => {
    const h = harness(server.current);
    const view = renderHook(() => ({ timeline: useDayTimeline(DAY), editor: useDayTimeline(DAY) }), { wrapper: h.wrapper });
    await waitFor(() => expect(view.result.current.timeline.query.isSuccess).toBe(true));
    const payload = { day: DAY, title: "From the editor", emoji: "✍️", color: "sky", category: "Work", startMinutes: 600, durationMinutes: 30 };

    await act(async () => {
      await view.result.current.editor.saveTask({ id: null, payload });
    });
    // The editor made the change; the timeline, a different instance of the hook, can undo it.
    await waitFor(() => expect(view.result.current.timeline.canUndo).toBe(true));
    await act(() => view.result.current.timeline.undo());
    await waitFor(() => expect(view.result.current.timeline.tasks).toEqual([]));
    expect(await server.current.api.getTasksForDay(DAY)).toEqual([]);
    await waitFor(() => expect(view.result.current.editor.canRedo).toBe(true));
  });

  it("undoes a change made from the week or the month (useTaskActions) too", async () => {
    const seeded = await server.current.seedTask(DAY, { title: "Stretch" });
    const h = harness(server.current);
    const view = renderHook(() => ({ actions: useTaskActions(), history: useTimelineHistory() }), { wrapper: h.wrapper });
    h.queryClient.setQueryData(queryKeys.tasks.range(DAY, DAY), [seeded]);

    await act(() => view.result.current.actions.changeTask(seeded, { startMinutes: 600 }));
    await waitFor(() => expect(view.result.current.history.canUndo).toBe(true));
    await act(() => view.result.current.history.undo());

    expect((await server.current.api.getTasksForDay(DAY))[0].startMinutes).toBe(540);
    expect(h.queryClient.getQueryData<ScheduledTask[]>(queryKeys.tasks.range(DAY, DAY))?.[0].startMinutes).toBe(540);
    expect(h.messages.at(-1)).toBe("Undid: Move Stretch");
  });

  it("asks the server again on refresh and says how it went", async () => {
    const { result, messages } = await mount();
    await act(() => result.current.refresh());
    expect(messages).toEqual(["Updated"]);
  });
});
