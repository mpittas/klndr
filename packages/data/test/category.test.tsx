// @vitest-environment happy-dom
import { UNSORTED_CATEGORY, type ScheduledTask } from "@klndr/core";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { fillCategory, useCategoryField, useCategorySuggester, type CategoryFieldOptions } from "../src/hooks/category";
import { categoriesQuery, dayTasksQuery } from "../src/hooks/queries";
import { queryKeys } from "../src/keys";
import { harness } from "./harness";
import { createDeps, DAY, useServer } from "./world";

const server = useServer();

/** Makes the server's category pick whatever the test says it is. */
function pickWith(answer: (text: string) => string | null | Promise<string | null>) {
  const spy = vi.fn(async (text: string) => answer(text));
  server.current.api.suggestCategory = spy;
  return spy;
}

const OPTIONS = [
  { name: "Health", examples: [] },
  { name: "Work", examples: [] },
];

describe("useCategorySuggester", () => {
  const mount = () => renderHook(() => useCategorySuggester(), { wrapper: harness(server.current).wrapper }).result;

  it("remembers an answer, \"none\" included, for the same title and categories", async () => {
    const spy = pickWith((text) => (text === "Gym" ? "health" : null));
    const suggest = mount();
    expect(await suggest.current(" Gym ", OPTIONS)).toBe("Health");
    expect(await suggest.current("gym", OPTIONS)).toBe("Health");
    expect(await suggest.current("Taxes", OPTIONS)).toBeNull();
    expect(await suggest.current("Taxes", OPTIONS)).toBeNull();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("asks again once the categories change", async () => {
    const spy = pickWith(() => "Work");
    const suggest = mount();
    await suggest.current("Plan", OPTIONS);
    await suggest.current("Plan", [...OPTIONS, { name: "Home", examples: [] }]);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("ignores a category it wasn't offered, and doesn't remember a failure", async () => {
    let fail = true;
    const spy = pickWith(() => {
      if (fail) throw new Error("offline");
      return "Fitness";
    });
    const suggest = mount();
    expect(await suggest.current("Gym", OPTIONS)).toBeNull();
    fail = false;
    expect(await suggest.current("Gym", OPTIONS)).toBeNull();
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe("fillCategory", () => {
  async function setup() {
    const { deps, queryClient } = createDeps(server.current);
    const { api } = server.current;
    const task = await server.current.seedTask(DAY, { title: "Gym", category: UNSORTED_CATEGORY, color: "slate" });
    await Promise.all([queryClient.fetchQuery(dayTasksQuery(api, DAY)), queryClient.fetchQuery(categoriesQuery(api))]);
    const taskNow = () => queryClient.getQueryData<ScheduledTask[]>(queryKeys.tasks.day(DAY))?.find((t) => t.id === task.id);
    return { deps, task, taskNow, queryClient };
  }

  it("files a block saved as unsorted where the pick says, in that category's color", async () => {
    const { deps, task, taskNow } = await setup();
    await fillCategory(deps, task.id, UNSORTED_CATEGORY, Promise.resolve("Health"));

    const health = (await server.current.api.getCategories()).find((c) => c.name === "Health")!;
    expect(taskNow()).toMatchObject({ category: "Health", color: health.color });
    expect((await server.current.api.getTasksForDay(DAY)).find((t) => t.id === task.id)?.category).toBe("Health");
  });

  it("leaves a block the person moved while the pick was on its way", async () => {
    const { deps, task, taskNow, queryClient } = await setup();
    queryClient.setQueryData<ScheduledTask[]>(queryKeys.tasks.day(DAY), (list) =>
      list?.map((t) => (t.id === task.id ? { ...t, category: "Work" } : t)),
    );
    const sentBefore = server.current.sent.length;
    await fillCategory(deps, task.id, UNSORTED_CATEGORY, Promise.resolve("Health"));
    expect(taskNow()?.category).toBe("Work");
    expect(server.current.sent.length).toBe(sentBefore);
  });

  it("does nothing when the pick found no fit", async () => {
    const { deps, task, taskNow } = await setup();
    await fillCategory(deps, task.id, UNSORTED_CATEGORY, Promise.resolve(null));
    expect(taskNow()?.category).toBe(UNSORTED_CATEGORY);
  });
});

describe("useCategoryField", () => {
  const NEW: CategoryFieldOptions = { initial: null, initialTitle: "", initialByHand: false, title: "" };

  /** The field of a form, with the categories and activities of a fresh account loaded. */
  async function mount(options: Partial<CategoryFieldOptions> = {}) {
    const view = renderHook((props: CategoryFieldOptions) => useCategoryField(props), {
      wrapper: harness(server.current).wrapper,
      initialProps: { ...NEW, ...options },
    });
    await waitFor(() => expect(view.result.current.ranked).toContain("Health"));
    const type = (title: string) => view.rerender({ ...NEW, ...options, title });
    return { ...view, type };
  }

  it("files a title the person already uses at once, without asking", async () => {
    const spy = pickWith(() => "Work");
    const { result, type } = await mount();
    type("workout"); // one of the starter activities, in Health
    expect(result.current).toMatchObject({ value: "Health", suggested: true, guessing: false });
    expect(spy).not.toHaveBeenCalled();
  });

  it("asks once typing pauses, and fills in the answer", async () => {
    const spy = pickWith(() => "Health");
    const { result, type } = await mount();
    type("Yo");
    type("Yoga class");
    expect(result.current.value).toBeNull();
    await waitFor(() => expect(result.current).toMatchObject({ value: "Health", suggested: true }));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toBe("Yoga class");
  });

  it("asks at once when the field is left", async () => {
    const spy = pickWith(() => "Work");
    const { result, type } = await mount();
    type("Quarterly report");
    act(() => result.current.settle());
    expect(result.current.guessing).toBe(true);
    await waitFor(() => expect(result.current.value).toBe("Work"));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("never replaces a category chosen by hand", async () => {
    const spy = pickWith(() => "Health");
    const { result, type } = await mount();
    act(() => result.current.choose("Growth"));
    type("Workout");
    type("Yoga class");
    act(() => result.current.settle());
    expect(result.current).toMatchObject({ value: "Growth", suggested: false });
    expect(spy).not.toHaveBeenCalled();
  });

  it("saves as unsorted while the pick is on its way, and files the block once it is back", async () => {
    let answer!: (category: string) => void;
    pickWith(() => new Promise<string>((resolve) => (answer = resolve)));
    const { result, type } = await mount();
    type("Dentist");

    const filed = result.current.forSave();
    expect(filed.category).toBe(UNSORTED_CATEGORY);
    expect(filed.fill).toBeTypeOf("function");

    const task = await server.current.seedTask(DAY, { title: "Dentist", category: UNSORTED_CATEGORY });
    filed.fill!(task.id);
    answer("Health");
    await waitFor(async () =>
      expect((await server.current.api.getTasksForDay(DAY)).find((t) => t.id === task.id)?.category).toBe("Health"),
    );
  });

  it("saves as unsorted when nothing fits", async () => {
    pickWith(() => null);
    const { result, type } = await mount();
    type("Something odd");
    act(() => result.current.settle());
    await waitFor(() => expect(result.current.guessing).toBe(false));
    expect(result.current.value).toBeNull();
    expect(result.current.forSave()).toEqual({ category: UNSORTED_CATEGORY });
  });

  it("keeps the category of a block being edited, whatever its title becomes", async () => {
    const spy = pickWith(() => "Health");
    const { result, type } = await mount({ initial: "Work", initialTitle: "Plan" });
    type("Workout");
    act(() => result.current.settle());
    expect(result.current.value).toBe("Work");
    expect(spy).not.toHaveBeenCalled();
  });

  it("re-files a block in a catch-all once its title changes", async () => {
    pickWith(() => "Health");
    const { result, type } = await mount({ initial: "General", initialTitle: "Stuff", title: "Stuff" });
    expect(result.current.value).toBe("General");
    type("Workout");
    expect(result.current.value).toBe("Health");
  });
});
