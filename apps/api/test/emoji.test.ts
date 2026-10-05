import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { createEmojiSuggester, DEFAULT_EMOJI_MODEL, parseEmoji } from "../src/emoji";
import { call } from "./helpers";

describe("parseEmoji", () => {
  it("accepts one emoji, with or without a variation selector or a skin tone", () => {
    expect(parseEmoji("🏋️")).toBe("🏋️");
    expect(parseEmoji("☕")).toBe("☕");
    expect(parseEmoji("👍🏽")).toBe("👍🏽");
  });

  it("accepts a joined sequence that is still one symbol", () => {
    expect(parseEmoji("🧑‍💻")).toBe("🧑‍💻");
  });

  it("trims the answer", () => {
    expect(parseEmoji("  🛒\n")).toBe("🛒");
  });

  it("refuses anything that isn't exactly one pictographic symbol", () => {
    expect(parseEmoji("")).toBeNull();
    expect(parseEmoji("gym")).toBeNull();
    expect(parseEmoji("🏋️ gym")).toBeNull();
    expect(parseEmoji("🛒🥦")).toBeNull();
    expect(parseEmoji("7")).toBeNull();
    expect(parseEmoji("1️⃣")).toBeNull();
  });

  it("refuses a flag, which Windows draws as two letters", () => {
    expect(parseEmoji("🇺🇸")).toBeNull();
  });

  it("refuses a symbol too long to be stored", () => {
    expect(parseEmoji("👨‍👩‍👧‍👦")).toBeNull();
  });
});

/** The OpenAI API, as `fetch`: answers with `text` (or a failure) and remembers what it was asked. */
function fakeOpenAI(answer: { text: string } | { status: number }) {
  const requests: Array<Record<string, any>> = [];
  const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
    requests.push(JSON.parse(String(init?.body)));
    if ("status" in answer) {
      return Response.json({ error: { message: "The server is overloaded.", type: "server_error" } }, { status: answer.status });
    }
    return Response.json({
      id: "resp_test",
      object: "response",
      created_at: 1,
      status: "completed",
      model: DEFAULT_EMOJI_MODEL,
      output: [
        {
          type: "message",
          id: "msg_test",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: answer.text, annotations: [] }],
        },
      ],
      usage: { input_tokens: 190, output_tokens: 4, total_tokens: 194 },
    });
  });
  return { requests, fetch: fetchImpl as unknown as typeof fetch };
}

describe("createEmojiSuggester", () => {
  it("asks the small model for one emoji, with reasoning off and a tiny budget", async () => {
    const openai = fakeOpenAI({ text: "🏋️" });
    const suggest = createEmojiSuggester({ apiKey: "test-key", fetch: openai.fetch });

    expect(await suggest("Gym session", "activity")).toBe("🏋️");

    expect(openai.requests).toHaveLength(1);
    const [request] = openai.requests;
    expect(request.model).toBe("gpt-5.6-luna");
    expect(request.reasoning).toEqual({ effort: "none" });
    expect(request.max_output_tokens).toBeLessThanOrEqual(32);
    expect(request.input).toBe("<kind>activity</kind>\n<title>Gym session</title>");
    expect(request.instructions).toContain("single emoji");
    expect(request.store).toBe(false);
  });

  it("uses the model it is told to", async () => {
    const openai = fakeOpenAI({ text: "📚" });
    await createEmojiSuggester({ apiKey: "test-key", model: "gpt-5.4-nano", fetch: openai.fetch })("Read", "activity");
    expect(openai.requests[0].model).toBe("gpt-5.4-nano");
  });

  it("answers null when the model says anything but one emoji", async () => {
    const openai = fakeOpenAI({ text: "Sure! How about 🏋️?" });
    expect(await createEmojiSuggester({ apiKey: "test-key", fetch: openai.fetch })("Gym", "activity")).toBeNull();
  });

  it("answers null instead of throwing when the API fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const openai = fakeOpenAI({ status: 500 });
    expect(await createEmojiSuggester({ apiKey: "test-key", fetch: openai.fetch })("Gym", "activity")).toBeNull();
    expect(openai.fetch).toHaveBeenCalledTimes(1); // no retry: the person is waiting
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("POST /api/emoji", () => {
  const appWith = (suggestEmoji?: Parameters<typeof createApp>[0]["suggestEmoji"]) =>
    createApp({ firebaseProjectId: "", allowDevUser: true, suggestEmoji });
  const ask = (app: ReturnType<typeof appWith>, body: unknown) => call(app, "POST", "/api/emoji", body);

  it("hands the title and its kind to the suggester and returns its answer", async () => {
    const suggest = vi.fn(async () => "🛒");
    const res = await ask(appWith(suggest), { text: "  Groceries ", kind: "category" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ emoji: "🛒" });
    expect(suggest).toHaveBeenCalledWith("Groceries", "category");
  });

  it("treats an unknown kind as an activity", async () => {
    const suggest = vi.fn(async () => "📌");
    await ask(appWith(suggest), { text: "Plan", kind: "nonsense" });
    expect(suggest).toHaveBeenCalledWith("Plan", "activity");
  });

  it("answers null, not an error, when nothing is configured", async () => {
    const res = await ask(appWith(), { text: "Gym" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ emoji: null });
  });

  it("needs some text", async () => {
    const suggest = vi.fn(async () => "📌");
    expect((await ask(appWith(suggest), { text: "  " })).status).toBe(400);
    expect((await ask(appWith(suggest), {})).status).toBe(400);
    expect(suggest).not.toHaveBeenCalled();
  });

  it("is for signed-in people only", async () => {
    const suggest = vi.fn(async () => "📌");
    const app = createApp({ firebaseProjectId: "demo-project", allowDevUser: false, suggestEmoji: suggest });
    const res = await ask(app, { text: "Gym" });
    expect(res.status).toBe(401);
    expect(suggest).not.toHaveBeenCalled();
  });
});
