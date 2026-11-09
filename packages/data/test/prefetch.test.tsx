// @vitest-environment happy-dom
import type { ScheduledTask } from "@klndr/core";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePrefetchAroundDay } from "../src/hooks/prefetch";
import { queryKeys } from "../src/keys";
import { harness } from "./harness";
import { DAY, useServer } from "./world";

const server = useServer();
const NEXT_DAY = "2031-04-15";
const THREE_AFTER = "2031-04-17";
const FOUR_AFTER = "2031-04-18";

describe("usePrefetchAroundDay", () => {
  it("loads the days around the one on screen, so stepping to them needs no request", async () => {
    await server.current.seedTask(NEXT_DAY, { title: "Tomorrow" });
    const h = harness(server.current);
    renderHook(() => usePrefetchAroundDay(DAY), { wrapper: h.wrapper });

    await waitFor(() => expect(h.queryClient.getQueryData(queryKeys.tasks.day(THREE_AFTER))).toEqual([]));
    const tomorrow = h.queryClient.getQueryData<ScheduledTask[]>(queryKeys.tasks.day(NEXT_DAY));
    expect(tomorrow?.map((task) => task.title)).toEqual(["Tomorrow"]);
    expect(h.queryClient.getQueryData(queryKeys.tasks.day(FOUR_AFTER))).toBeUndefined();

    await waitFor(() => expect(h.queryClient.getQueryData(queryKeys.checklist.day(NEXT_DAY))).toBeDefined());
    expect(h.queryClient.getQueryData(queryKeys.notes(NEXT_DAY))).toBeDefined();
    // One request carried the week's blocks; the range itself is not kept.
    expect(server.current.sent.filter((line) => line.startsWith("GET /api/tasks"))).toHaveLength(1);
    expect(h.queryClient.getQueryCache().findAll({ queryKey: queryKeys.tasks.ranges })).toHaveLength(0);
  });

  it("only asks for what is missing when the day moves on", async () => {
    const h = harness(server.current);
    const view = renderHook(({ day }) => usePrefetchAroundDay(day), { wrapper: h.wrapper, initialProps: { day: DAY } });
    await waitFor(() => expect(h.queryClient.getQueryData(queryKeys.tasks.day(THREE_AFTER))).toBeDefined());
    server.current.sent.length = 0;

    view.rerender({ day: NEXT_DAY });
    await waitFor(() => expect(h.queryClient.getQueryData(queryKeys.tasks.day(FOUR_AFTER))).toBeDefined());
    const ranges = server.current.sent.filter((line) => line.startsWith("GET /api/tasks"));
    expect(ranges).toEqual([`GET /api/tasks?from=${FOUR_AFTER}&to=${FOUR_AFTER}`]);
  });

  it("does nothing while disabled", async () => {
    const h = harness(server.current);
    renderHook(() => usePrefetchAroundDay(DAY, false), { wrapper: h.wrapper });
    await new Promise((resolve) => setTimeout(resolve, 450));
    expect(server.current.sent).toEqual([]);
  });
});
