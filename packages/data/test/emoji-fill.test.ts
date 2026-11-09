import type { ActivityTemplate, Category, ScheduledTask } from "@klndr/core";
import { describe, expect, it } from "vitest";
import { fillEmoji } from "../src/hooks/emoji";
import { categoriesQuery, dayTasksQuery, templatesQuery } from "../src/hooks/queries";
import { queryKeys } from "../src/keys";
import { createDeps, DAY, useServer } from "./world";

const server = useServer();

/** A block, an activity and a category saved before their emoji was ready, with the screens' data loaded. */
async function setup() {
  const { deps, queryClient } = createDeps(server.current);
  const { api } = server.current;
  const task = await server.current.seedTask(DAY, { title: "Gym", emoji: "📌" });
  const template = await api.createTemplate({
    name: "Pottery",
    emoji: "📌",
    color: "orange",
    category: "Crafts",
    defaultDuration: 60,
    notes: null,
  });
  const category = await api.createCategory({ name: "Errands", color: "sky" });
  await Promise.all([
    queryClient.fetchQuery(dayTasksQuery(api, DAY)),
    queryClient.fetchQuery(templatesQuery(api)),
    queryClient.fetchQuery(categoriesQuery(api)),
  ]);
  return {
    deps,
    task,
    template,
    category,
    taskNow: () => queryClient.getQueryData<ScheduledTask[]>(queryKeys.tasks.day(DAY))?.find((t) => t.id === task.id),
    templateNow: () => queryClient.getQueryData<ActivityTemplate[]>(queryKeys.templates)?.find((t) => t.id === template.id),
    categoryNow: () => queryClient.getQueryData<Category[]>(queryKeys.categories)?.find((c) => c.id === category.id),
  };
}

describe("filling in an emoji after saving", () => {
  it("puts the picked emoji on a block, on screen and on the server", async () => {
    const { deps, task, taskNow } = await setup();
    await fillEmoji(deps, { kind: "task", id: task.id }, "📌", Promise.resolve("🏋️"));

    expect(taskNow()?.emoji).toBe("🏋️");
    expect((await server.current.api.getTasksForDay(DAY)).find((t) => t.id === task.id)?.emoji).toBe("🏋️");
  });

  it("does the same for an activity and a category that had none", async () => {
    const { deps, template, category, templateNow, categoryNow } = await setup();
    await fillEmoji(deps, { kind: "template", id: template.id }, "📌", Promise.resolve("🏺"));
    await fillEmoji(deps, { kind: "category", id: category.id }, null, Promise.resolve("🛍️"));

    expect(templateNow()?.emoji).toBe("🏺");
    expect(categoryNow()?.emoji).toBe("🛍️");
    expect((await server.current.api.getCategories()).find((c) => c.id === category.id)?.emoji).toBe("🛍️");
  });

  it("leaves an emoji the person chose while the pick was on its way", async () => {
    const { deps, task, taskNow } = await setup();
    const sentBefore = server.current.sent.length;
    const chosen = { ...taskNow()!, emoji: "🔥" };
    deps.queryClient.setQueryData<ScheduledTask[]>(queryKeys.tasks.day(DAY), (list) =>
      list?.map((t) => (t.id === task.id ? chosen : t)),
    );

    await fillEmoji(deps, { kind: "task", id: task.id }, "📌", Promise.resolve("🏋️"));
    expect(taskNow()?.emoji).toBe("🔥");
    expect(server.current.sent.length).toBe(sentBefore);
  });

  it("sends nothing when the pick brings nothing new", async () => {
    const { deps, task } = await setup();
    const sentBefore = server.current.sent.length;
    await fillEmoji(deps, { kind: "task", id: task.id }, "📌", Promise.resolve(null));
    await fillEmoji(deps, { kind: "task", id: task.id }, "📌", Promise.resolve("📌"));
    await fillEmoji(deps, { kind: "task", id: task.id }, "📌", Promise.reject(new Error("offline")));
    expect(server.current.sent.length).toBe(sentBefore);
  });

  it("puts the saved emoji back if the server won't take the new one", async () => {
    const { deps, task, taskNow } = await setup();
    server.current.fail(/^PATCH \/api\/tasks\//);
    await fillEmoji(deps, { kind: "task", id: task.id }, "📌", Promise.resolve("🏋️"));
    expect(taskNow()?.emoji).toBe("📌");
  });

  it("still saves the emoji of a block that isn't on any screen", async () => {
    const { deps } = createDeps(server.current);
    const task = await server.current.seedTask(DAY, { title: "Swim", emoji: "📌" });
    await fillEmoji(deps, { kind: "task", id: task.id }, "📌", Promise.resolve("🏊"));
    expect((await server.current.api.getTasksForDay(DAY)).find((t) => t.id === task.id)?.emoji).toBe("🏊");
  });
});
