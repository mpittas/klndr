// @vitest-environment happy-dom
import type { ScheduledTask } from "@klndr/core";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useTaskActions } from "../src/hooks/tasks";
import { queryKeys } from "../src/keys";
import { harness } from "./harness";
import { DAY, useServer } from "./world";

const server = useServer();

describe("useTaskActions", () => {
  it("ticks a block off in every list that holds it, and reopens it", async () => {
    const seeded = await server.current.seedTask(DAY, { title: "Stretch" });
    const h = harness(server.current);
    h.queryClient.setQueryData(queryKeys.tasks.range(DAY, DAY), [seeded]);
    h.queryClient.setQueryData(queryKeys.tasks.day(DAY), [seeded]);
    const { result } = renderHook(() => useTaskActions(), { wrapper: h.wrapper });
    const completed = () => h.queryClient.getQueryData<ScheduledTask[]>(queryKeys.tasks.range(DAY, DAY))?.[0]?.completed;

    await act(() => result.current.toggleComplete(seeded));
    expect(completed()).toBe(true);
    expect(h.queryClient.getQueryData<ScheduledTask[]>(queryKeys.tasks.day(DAY))?.[0]?.completed).toBe(true);
    expect((await server.current.api.getTasksForDay(DAY))[0]?.completed).toBe(true);

    await act(() => result.current.toggleComplete({ ...seeded, completed: true }));
    expect(completed()).toBe(false);
  });

  it("puts a failed tick back and reports it without throwing", async () => {
    const seeded = await server.current.seedTask(DAY);
    const h = harness(server.current);
    h.queryClient.setQueryData(queryKeys.tasks.range(DAY, DAY), [seeded]);
    const { result } = renderHook(() => useTaskActions(), { wrapper: h.wrapper });
    server.current.fail(`PATCH /api/tasks/${seeded.id}`);

    await act(() => result.current.toggleComplete(seeded));
    await waitFor(() => expect(h.messages).toContain("Could not update that block"));
    expect(h.queryClient.getQueryData<ScheduledTask[]>(queryKeys.tasks.range(DAY, DAY))?.[0]?.completed).toBe(false);
  });

  it("saves a new block and deletes it", async () => {
    const h = harness(server.current);
    const { result } = renderHook(() => useTaskActions(), { wrapper: h.wrapper });

    let saved!: ScheduledTask;
    await act(async () => {
      saved = await result.current.saveTask({
        id: null,
        payload: { day: DAY, title: "Dentist", emoji: "🦷", color: "sky", category: "Health", startMinutes: 600, durationMinutes: 45 },
      });
    });
    expect((await server.current.api.getTasksForDay(DAY)).map((task) => task.title)).toContain("Dentist");

    let deleted = false;
    await act(async () => {
      deleted = await result.current.deleteTask(saved);
    });
    expect(deleted).toBe(true);
    expect(await server.current.api.getTasksForDay(DAY)).toEqual([]);
  });
});
