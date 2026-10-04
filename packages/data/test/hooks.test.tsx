// @vitest-environment happy-dom
import type { UserProfile } from "@klndr/core";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useChecklist } from "../src/hooks/checklist";
import { useLibraryActions } from "../src/hooks/library";
import { useNotesEditor } from "../src/hooks/notes";
import { useProfile, useUpdateProfile, type ProfileSource } from "../src/hooks/profile";
import { useCategories, useCategoryColor, useTemplates } from "../src/hooks/queries";
import { queryKeys } from "../src/keys";
import { aProfile, harness } from "./harness";
import { DAY, tick, useServer } from "./world";

const server = useServer();
const NEXT_DAY = "2031-04-15";

describe("useNotesEditor", () => {
  async function mount(day = DAY) {
    const h = harness(server.current);
    const view = renderHook(({ day }) => useNotesEditor(day, { delayMs: 20 }), {
      wrapper: h.wrapper,
      initialProps: { day },
    });
    await waitFor(() => expect(view.result.current.state).toBe("ready"));
    return { ...h, ...view };
  }

  it("starts with the saved text", async () => {
    await server.current.api.saveDayNotes(DAY, "from before");
    const { result } = await mount();
    await waitFor(() => expect(result.current.text).toBe("from before"));
  });

  it("saves typing once it pauses, and says so", async () => {
    const { result } = await mount();

    act(() => result.current.edit("hello"));
    expect(result.current.text).toBe("hello");

    await waitFor(async () => expect((await server.current.api.getDayNotes(DAY)).text).toBe("hello"));
    await waitFor(() => expect(result.current.status).toBe("saved"));
  });

  it("doesn't overwrite typing that hasn't reached the server with the server's copy", async () => {
    const { result, queryClient } = await mount();
    const release = server.current.hold("PUT /api/notes");

    act(() => result.current.edit("typed"));
    await waitFor(() => expect(server.current.sent).toContain("PUT /api/notes")); // on its way

    act(() => {
      queryClient.setQueryData(queryKeys.notes(DAY), { day: DAY, text: "some other copy" });
    });
    await tick();
    expect(result.current.text).toBe("typed");

    release();
    await waitFor(() => expect(result.current.status).toBe("saved"));
    expect(result.current.text).toBe("typed");
  });

  it("takes a newer server copy when nothing is waiting to be saved", async () => {
    const { result, queryClient } = await mount();
    act(() => {
      queryClient.setQueryData(queryKeys.notes(DAY), { day: DAY, text: "edited elsewhere" });
    });
    await waitFor(() => expect(result.current.text).toBe("edited elsewhere"));
  });

  it("saves what was typed under the day it was typed on when the day changes", async () => {
    const { result, rerender } = await mount();

    act(() => result.current.edit("monday notes"));
    rerender({ day: NEXT_DAY }); // before the pause that would have saved it

    await waitFor(async () => expect((await server.current.api.getDayNotes(DAY)).text).toBe("monday notes"));
    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(result.current.text).toBe("");
    expect((await server.current.api.getDayNotes(NEXT_DAY)).text).toBe("");
  });

  it("keeps the text and reports an error when saving fails, and sends it on retry", async () => {
    const { result } = await mount();
    server.current.fail("PUT /api/notes");

    act(() => result.current.edit("precious"));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.text).toBe("precious");

    await act(() => result.current.retrySave());
    await waitFor(() => expect(result.current.status).toBe("saved"));
    expect((await server.current.api.getDayNotes(DAY)).text).toBe("precious");
  });

  it("says when the saved notes couldn't be read", async () => {
    server.current.fail("GET /api/notes", "down", 500, 5);
    const h = harness(server.current);
    const { result } = renderHook(() => useNotesEditor(DAY), { wrapper: h.wrapper });
    await waitFor(() => expect(result.current.state).toBe("error"));
  });
});

describe("useChecklist", () => {
  async function mount() {
    const h = harness(server.current);
    const view = renderHook(() => useChecklist(DAY), { wrapper: h.wrapper });
    await waitFor(() => expect(view.result.current.isLoading).toBe(false));
    return { ...h, ...view };
  }

  it("shows the routines with nothing ticked", async () => {
    const { result } = await mount();
    expect(result.current.items.length).toBeGreaterThan(0);
    expect(result.current.stats).toMatchObject({ done: 0, percentage: 0 });
    expect(result.current.hasChecklist).toBe(true);
  });

  it("ticks a routine at once and counts it", async () => {
    const { result } = await mount();
    const total = result.current.stats.total;

    act(() => result.current.toggle(result.current.items[0].id, true));
    await waitFor(() => expect(result.current.stats).toMatchObject({ total, done: 1 }));
    expect(result.current.completedIds).toEqual([result.current.items[0].id]);
  });

  it("adds a routine after the others, and a one-off for the day", async () => {
    const { result, messages } = await mount();
    const count = result.current.items.length;

    await act(async () => {
      await result.current.addRoutine({ title: "Floss", emoji: "🦷" });
    });
    await waitFor(() => expect(result.current.items).toHaveLength(count + 1));
    expect(result.current.items.at(-1)).toMatchObject({ title: "Floss", scope: "default", order: count + 1 });

    await act(async () => {
      await result.current.addForToday({ title: "Call mum", emoji: "📞" });
    });
    await waitFor(() => expect(result.current.items.at(-1)).toMatchObject({ title: "Call mum", scope: "day" }));
    expect(messages).toContain('Added "Call mum" for this day');
  });

  it("skips a routine for the day and lists it so it can be brought back", async () => {
    const { result } = await mount();
    const skipped = result.current.items[0];

    await act(async () => {
      await result.current.skipForDay(skipped, true);
    });
    await waitFor(() => expect(result.current.skipped.map((i) => i.id)).toEqual([skipped.id]));
    expect(result.current.items.some((i) => i.id === skipped.id)).toBe(false);

    await act(async () => {
      await result.current.skipForDay(skipped, false);
    });
    await waitFor(() => expect(result.current.skipped).toEqual([]));
  });

  it("edits and deletes a routine", async () => {
    const { result } = await mount();
    const first = result.current.items[0];

    await act(async () => {
      await result.current.editRoutine(first.id, { title: "Renamed" });
    });
    await waitFor(() => expect(result.current.items.find((i) => i.id === first.id)?.title).toBe("Renamed"));

    await act(async () => {
      await result.current.deleteRoutine(first);
    });
    await waitFor(() => expect(result.current.items.some((i) => i.id === first.id)).toBe(false));
  });
});

describe("useLibraryActions", () => {
  it("never throws when dragging an activity to another category fails, and says so", async () => {
    const h = harness(server.current);
    const view = renderHook(() => ({ actions: useLibraryActions(), templates: useTemplates() }), { wrapper: h.wrapper });
    await waitFor(() => expect(view.result.current.templates.data).toBeDefined());
    const template = view.result.current.templates.data![0];
    server.current.fail("PATCH /api/templates");

    await act(() => view.result.current.actions.moveTemplate(template, "Elsewhere"));

    await waitFor(() => expect(view.result.current.templates.data![0].category).toBe(template.category));
    expect(h.messages).toEqual(["Could not move that activity"]);
  });

  it("throws the server's message when a category name is taken", async () => {
    const h = harness(server.current);
    const view = renderHook(() => useLibraryActions(), { wrapper: h.wrapper });
    let error: unknown;
    await act(async () => {
      await view.result.current.createCategory({ draft: { name: "work", color: "sky" } }).catch((e) => (error = e));
    });
    expect((error as Error).message).toBe("A category with that name already exists");
  });
});

describe("category colors", () => {
  it("uses the category's color, falling back to the item's own until categories load", async () => {
    const h = harness(server.current);
    const view = renderHook(() => ({ colorOf: useCategoryColor(), categories: useCategories() }), { wrapper: h.wrapper });

    expect(view.result.current.colorOf({ category: "Work", color: "fallback" })).toBe("fallback");
    await waitFor(() => expect(view.result.current.categories.data).toBeDefined());
    const work = view.result.current.categories.data!.find((c) => c.name === "Work")!;
    expect(view.result.current.colorOf({ category: "work", color: "fallback" })).toBe(work.color);
  });
});

describe("the profile", () => {
  const source = (): ProfileSource & { load: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> } => ({
    load: vi.fn(async () => aProfile()),
    save: vi.fn(async (patch) => ({ ...aProfile(), ...patch }) as UserProfile),
  });

  async function mount(profile: ProfileSource | undefined) {
    const h = harness(server.current, { profile });
    const view = renderHook(() => ({ profile: useProfile(), update: useUpdateProfile() }), { wrapper: h.wrapper });
    return { ...h, ...view };
  }

  it("loads from the source the app supplied", async () => {
    const { result } = await mount(source());
    await waitFor(() => expect(result.current.profile.data?.displayName).toBe("Ada"));
  });

  it("does nothing without a source", async () => {
    const { result } = await mount(undefined);
    await tick();
    expect(result.current.profile.fetchStatus).toBe("idle");
    expect(result.current.profile.data).toBeUndefined();
  });

  it("shows an edit at once and takes what the source saved", async () => {
    const profile = source();
    let finish!: () => void;
    profile.save.mockImplementation(
      (patch) => new Promise((resolve) => (finish = () => resolve({ ...aProfile(), ...patch, bio: "saved by source" }))),
    );
    const { result } = await mount(profile);
    await waitFor(() => expect(result.current.profile.data).toBeDefined());

    act(() => result.current.update.mutate({ displayName: "  Grace  " }));
    await waitFor(() => expect(result.current.profile.data?.displayName).toBe("Grace")); // trimmed, before it is saved
    expect(profile.save).toHaveBeenCalledWith({ displayName: "Grace" });

    finish();
    await waitFor(() => expect(result.current.profile.data?.bio).toBe("saved by source"));
  });

  it("puts the old value back when saving fails", async () => {
    const profile = source();
    profile.save.mockRejectedValue(new Error("offline"));
    const { result } = await mount(profile);
    await waitFor(() => expect(result.current.profile.data).toBeDefined());

    await act(async () => {
      await result.current.update.mutateAsync({ displayName: "Grace" }).catch(() => undefined);
    });
    await waitFor(() => expect(result.current.profile.data?.displayName).toBe("Ada"));
    expect(result.current.update.error?.message).toBe("offline");
  });

  it("refuses a value the profile doesn't accept, in words fit to show, before anything is sent", async () => {
    const profile = source();
    const { result } = await mount(profile);
    await waitFor(() => expect(result.current.profile.data).toBeDefined());

    await act(async () => {
      await result.current.update.mutateAsync({ displayName: "   " }).catch(() => undefined);
    });
    await waitFor(() => expect(result.current.update.error?.message).toBe("Display name can't be empty."));
    expect(profile.save).not.toHaveBeenCalled();
    expect(result.current.profile.data?.displayName).toBe("Ada");
  });

  it("explains a missing source when asked to save", async () => {
    const { result } = await mount(undefined);
    await act(async () => {
      await result.current.update.mutateAsync({ bio: "hi" }).catch(() => undefined);
    });
    await waitFor(() => expect(result.current.update.error?.message).toMatch(/Pass a `profile` source/));
  });
});
