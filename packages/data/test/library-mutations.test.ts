import type { ActivityTemplate, Category, ScheduledTask } from "@klndr/core";
import { notifyManager, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { categoriesQuery, dayTasksQuery, templatesQuery } from "../src/hooks/queries";
import { queryKeys } from "../src/keys";
import { libraryMutationOptions } from "../src/mutations/library";
import { createDeps, DAY, run, useServer } from "./world";

const server = useServer();

/** The library screen's data loaded, with a block on the timeline made from "Workout". */
async function setup() {
  const { deps, queryClient, messages } = createDeps(server.current);
  const { api } = server.current;
  const workout = (await api.getTemplates()).find((t) => t.name === "Workout")!;
  await server.current.seedTask(DAY, { title: "Workout", templateId: workout.id, category: workout.category, color: "emerald" });
  await server.current.seedTask(DAY, { title: "Unrelated", templateId: null, category: "Work", color: "sky", startMinutes: 900 });
  await Promise.all([
    queryClient.fetchQuery(templatesQuery(api)),
    queryClient.fetchQuery(categoriesQuery(api)),
    queryClient.fetchQuery(dayTasksQuery(api, DAY)),
  ]);
  const options = libraryMutationOptions(deps);
  return {
    options,
    queryClient,
    messages,
    workout,
    templates: () => queryClient.getQueryData<ActivityTemplate[]>(queryKeys.templates) ?? [],
    categories: () => queryClient.getQueryData<Category[]>(queryKeys.categories) ?? [],
    tasks: () => queryClient.getQueryData<ScheduledTask[]>(queryKeys.tasks.day(DAY)) ?? [],
  };
}

const draft = (extra: Partial<Omit<ActivityTemplate, "id" | "archived">> = {}) => ({
  name: "Pottery",
  emoji: "🏺",
  color: "orange",
  category: "Crafts",
  defaultDuration: 90,
  notes: null,
  ...extra,
});

describe("saving an activity", () => {
  it("adds a new one in its place in the list, and asks for the categories in case it made one", async () => {
    const { options, queryClient, templates } = await setup();
    const saved = await run(queryClient, options.saveTemplate, { id: null, draft: draft() });

    expect(templates().find((t) => t.id === saved.id)).toEqual(saved);
    const order = templates().map((t) => `${t.category}/${t.name}`);
    expect(order).toEqual([...order].sort((a, b) => a.localeCompare(b)));
    expect(queryClient.getQueryState(queryKeys.categories)?.isInvalidated).toBe(true);
  });

  it("recolors the blocks made from an activity when its color changes", async () => {
    const { options, queryClient, workout, tasks } = await setup();

    await run(queryClient, options.saveTemplate, { id: workout.id, draft: { ...workout, color: "violet" } });

    expect(tasks().find((t) => t.title === "Workout")?.color).toBe("violet");
    expect(tasks().find((t) => t.title === "Unrelated")?.color).toBe("sky");
  });

  it("leaves blocks alone when the color stays the same", async () => {
    const { options, queryClient, workout, tasks } = await setup();
    const before = tasks();
    await run(queryClient, options.saveTemplate, { id: workout.id, draft: { ...workout, defaultDuration: 30 } });
    expect(tasks()).toBe(before);
  });

  it("throws the server's message and changes nothing when it is refused", async () => {
    const { options, queryClient, templates } = await setup();
    const before = templates();
    await expect(run(queryClient, options.saveTemplate, { id: null, draft: draft({ name: " " }) })).rejects.toThrow(
      "Name is required",
    );
    expect(templates()).toBe(before);
  });
});

describe("deleting an activity", () => {
  it("removes it, keeps its blocks as plain blocks and says so", async () => {
    const { options, queryClient, messages, workout, templates, tasks } = await setup();

    await run(queryClient, options.deleteTemplate, { id: workout.id });

    expect(templates().some((t) => t.id === workout.id)).toBe(false);
    expect(tasks().find((t) => t.title === "Workout")).toMatchObject({ templateId: null });
    expect(messages).toEqual(["Activity deleted"]);
  });

  it("keeps it when the server refuses", async () => {
    const { options, queryClient, messages, workout, templates } = await setup();
    server.current.fail("DELETE /api/templates");
    await expect(run(queryClient, options.deleteTemplate, { id: workout.id })).rejects.toThrow("boom");
    expect(templates().some((t) => t.id === workout.id)).toBe(true);
    expect(messages).toEqual([]);
  });
});

describe("dragging an activity to another category", () => {
  it("moves it at once and confirms", async () => {
    const { options, queryClient, messages, workout, templates } = await setup();
    const release = server.current.hold("PATCH /api/templates");

    const done = run(queryClient, options.moveTemplate, { template: workout, category: "Home" });
    await expect.poll(() => templates().find((t) => t.id === workout.id)?.category).toBe("Home");
    release();
    await done;

    expect((await server.current.api.getTemplates()).find((t) => t.id === workout.id)?.category).toBe("Home");
    expect(messages).toEqual(["Moved Workout to Home"]);
  });

  it("puts it back when saving fails", async () => {
    const { options, queryClient, messages, workout, templates } = await setup();
    server.current.fail("PATCH /api/templates");
    await expect(run(queryClient, options.moveTemplate, { template: workout, category: "Home" })).rejects.toThrow();
    expect(templates().find((t) => t.id === workout.id)?.category).toBe(workout.category);
    expect(messages).toEqual(["Could not move that activity"]);
  });
});

describe("categories", () => {
  it("adds a category in alphabetical order", async () => {
    const { options, queryClient, categories } = await setup();
    const created = await run(queryClient, options.createCategory, { draft: { name: "Aardvark", color: "lime" } });
    expect(categories()[0]).toEqual(created);
  });

  it("throws the server's message for a name that is taken, and changes nothing", async () => {
    const { options, queryClient, categories } = await setup();
    const before = categories();
    await expect(run(queryClient, options.createCategory, { draft: { name: "work", color: "lime" } })).rejects.toThrow(
      "A category with that name already exists",
    );
    expect(categories()).toBe(before);
  });

  it("recolors a category without touching its activities", async () => {
    const { options, queryClient, categories, templates } = await setup();
    const before = templates();
    const work = categories().find((c) => c.name === "Work")!;
    await run(queryClient, options.updateCategory, { id: work.id, patch: { color: "rose" } });
    expect(categories().find((c) => c.id === work.id)?.color).toBe("rose");
    expect(templates()).toBe(before);
    expect(queryClient.getQueryState(queryKeys.templates)?.isInvalidated).toBe(false); // nothing to fetch again
  });

  it("renames it on its activities and blocks, in one step, then fetches them again to be sure", async () => {
    const { options, queryClient, categories, templates, tasks } = await setup();
    const work = categories().find((c) => c.name === "Work")!;

    // Watch the way a screen does (React subscribes through `batchCalls`): whenever it is told something
    // changed, the new name must not show on one list while the old one is still on another, or a category
    // would flash up empty beside an unsaved duplicate under the old name.
    const inconsistent: string[] = [];
    const check = notifyManager.batchCalls(() => {
      const named = categories().some((c) => c.name === "Office");
      const oldTemplates = templates().some((t) => t.category === "Work");
      const oldTasks = tasks().some((t) => t.category === "Work");
      if (named && (oldTemplates || oldTasks)) inconsistent.push("new name shown while old name still in use");
    });
    const watchers = [
      new QueryObserver(queryClient, categoriesQuery(server.current.api)),
      new QueryObserver(queryClient, templatesQuery(server.current.api)),
      new QueryObserver(queryClient, dayTasksQuery(server.current.api, DAY)),
    ].map((observer) => observer.subscribe(check));

    await run(queryClient, options.updateCategory, { id: work.id, patch: { name: "Office" } });
    await new Promise((resolve) => setTimeout(resolve, 10)); // let the screens' notifications through
    for (const stop of watchers) stop();

    expect(inconsistent).toEqual([]);
    expect(categories().some((c) => c.name === "Work")).toBe(false);
    expect(templates().filter((t) => t.category === "Office").length).toBeGreaterThan(0);
    expect(templates().some((t) => t.category === "Work")).toBe(false);
    expect(tasks().find((t) => t.title === "Unrelated")?.category).toBe("Office");
    // Screens were watching, so the lists were fetched again at once, after the rename.
    const sent = server.current.sent;
    const after = sent.slice(sent.findIndex((line) => line.startsWith("PATCH /api/categories")) + 1);
    expect(after).toContain("GET /api/templates");
    expect(after).toContain(`GET /api/tasks?day=${DAY}`);
  });

  it("throws the server's message when renaming to a taken name", async () => {
    const { options, queryClient, categories } = await setup();
    const work = categories().find((c) => c.name === "Work")!;
    await expect(run(queryClient, options.updateCategory, { id: work.id, patch: { name: "Health" } })).rejects.toThrow(
      "A category with that name already exists",
    );
    expect(categories().some((c) => c.name === "Work")).toBe(true);
  });

  it("deletes a category, moving its activities, and fetches activities and blocks again", async () => {
    const { options, queryClient, categories } = await setup();
    const home = categories().find((c) => c.name === "Home")!;

    await run(queryClient, options.deleteCategory, { id: home.id, target: { moveTo: "Work" } });

    expect(categories().some((c) => c.id === home.id)).toBe(false);
    expect(queryClient.getQueryState(queryKeys.templates)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.tasks.day(DAY))?.isInvalidated).toBe(true);
    expect((await server.current.api.getTemplates()).some((t) => t.category === "Home")).toBe(false);
  });

  it("throws the server's message when the activities have nowhere to go", async () => {
    const { options, queryClient, categories } = await setup();
    const home = categories().find((c) => c.name === "Home")!;
    await expect(run(queryClient, options.deleteCategory, { id: home.id })).rejects.toThrow(
      "Choose a category to move its activities to",
    );
    expect(categories().some((c) => c.id === home.id)).toBe(true);
  });
});
