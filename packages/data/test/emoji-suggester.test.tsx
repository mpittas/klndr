// @vitest-environment happy-dom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EMOJI_TIMEOUT_MS, useEmojiSuggester, useRememberedEmoji } from "../src/hooks/emoji";
import { harness } from "./harness";
import { createServer } from "./world";

/** A suggester over an API whose `suggestEmoji` is whatever the test says it is. */
function mount(suggest: (text: string, kind: string) => Promise<string | null>, userId = "user-1") {
  const server = createServer();
  const spy = vi.fn(suggest);
  server.api.suggestEmoji = spy as typeof server.api.suggestEmoji;
  const h = harness(server, { userId });
  const view = renderHook(() => useEmojiSuggester(), { wrapper: h.wrapper });
  return { spy, ...view };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useEmojiSuggester", () => {
  it("asks the server with the trimmed title and what it is for", async () => {
    const { result, spy } = mount(async () => "🏋️");
    expect(await result.current("  Gym ", "activity")).toBe("🏋️");
    expect(spy).toHaveBeenCalledWith("Gym", "activity");
  });

  it("asks nothing for an empty title", async () => {
    const { result, spy } = mount(async () => "🏋️");
    expect(await result.current("   ", "activity")).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("remembers an answer, whatever the case or spacing of the title", async () => {
    const { result, spy } = mount(async () => "💻");
    await result.current("Deep work", "activity");
    expect(await result.current("  deep   WORK", "activity")).toBe("💻");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("keeps an activity's emoji apart from a category's of the same name", async () => {
    const { result, spy } = mount(async (_text, kind) => (kind === "category" ? "📁" : "🏃"));
    expect(await result.current("Fitness", "activity")).toBe("🏃");
    expect(await result.current("Fitness", "category")).toBe("📁");
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("doesn't remember having no answer, so a later try can still succeed", async () => {
    let answer: string | null = null;
    const { result, spy } = mount(async () => answer);
    expect(await result.current("Gym", "activity")).toBeNull();
    answer = "🏋️";
    expect(await result.current("Gym", "activity")).toBe("🏋️");
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("answers null when the request fails", async () => {
    const { result } = mount(async () => {
      throw new Error("offline");
    });
    expect(await result.current("Gym", "activity")).toBeNull();
  });

  it("gives up on a slow answer", async () => {
    vi.useFakeTimers();
    const { result } = mount(() => new Promise<string | null>(() => {}));
    const pending = result.current("Gym", "activity");
    await vi.advanceTimersByTimeAsync(EMOJI_TIMEOUT_MS);
    expect(await pending).toBeNull();
  });

  it("starts with nothing remembered for a new person", async () => {
    const first = mount(async () => "🏋️", "user-1");
    await first.result.current("Gym", "activity");
    const second = mount(async () => "🧗", "user-2");
    expect(await second.result.current("Gym", "activity")).toBe("🧗");
  });
});

describe("useRememberedEmoji", () => {
  it("answers at once, without asking, for a title already picked this session", async () => {
    const server = createServer();
    const spy = vi.fn(async () => "🏋️");
    server.api.suggestEmoji = spy as typeof server.api.suggestEmoji;
    const h = harness(server);
    const { result } = renderHook(() => ({ suggest: useEmojiSuggester(), remembered: useRememberedEmoji() }), {
      wrapper: h.wrapper,
    });

    expect(result.current.remembered("Gym", "activity")).toBeNull();
    await result.current.suggest("Gym", "activity");
    expect(result.current.remembered(" gym ", "activity")).toBe("🏋️");
    expect(result.current.remembered("Gym", "category")).toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
