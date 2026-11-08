import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { createCategorySuggester } from "../src/category";
import { DEFAULT_EMOJI_MODEL } from "../src/emoji";
import { call } from "./helpers";

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
      usage: { input_tokens: 200, output_tokens: 3, total_tokens: 203 },
    });
  });
  return { requests, fetch: fetchImpl as unknown as typeof fetch };
}

const OPTIONS = [
  { name: "Health", examples: ["Workout", "Walk outside"] },
  { name: "Work", examples: [] },
];

describe("createCategorySuggester", () => {
  it("asks the small model to choose among the categories, with their examples", async () => {
    const openai = fakeOpenAI({ text: "Health" });
    const suggest = createCategorySuggester({ apiKey: "test-key", fetch: openai.fetch });

    expect(await suggest("Gym", OPTIONS)).toBe("Health");

    const [request] = openai.requests;
    expect(request.model).toBe(DEFAULT_EMOJI_MODEL);
    expect(request.reasoning).toEqual({ effort: "none" });
    expect(request.store).toBe(false);
    expect(request.input).toBe('<title>Gym</title>\n<categories>\n- "Health": "Workout", "Walk outside"\n- "Work"\n</categories>');
  });

  it("answers null for none, or a name that isn't one of the categories", async () => {
    expect(await createCategorySuggester({ apiKey: "k", fetch: fakeOpenAI({ text: "none" }).fetch })("Gym", OPTIONS)).toBeNull();
    expect(await createCategorySuggester({ apiKey: "k", fetch: fakeOpenAI({ text: "Fitness" }).fetch })("Gym", OPTIONS)).toBeNull();
  });

  it("asks nothing when there are no categories to choose from", async () => {
    const openai = fakeOpenAI({ text: "Health" });
    expect(await createCategorySuggester({ apiKey: "k", fetch: openai.fetch })("Gym", [])).toBeNull();
    expect(openai.fetch).not.toHaveBeenCalled();
  });

  it("answers null instead of throwing when the API fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const openai = fakeOpenAI({ status: 500 });
    expect(await createCategorySuggester({ apiKey: "k", fetch: openai.fetch })("Gym", OPTIONS)).toBeNull();
    expect(openai.fetch).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe("POST /api/suggest-category", () => {
  const appWith = (suggestCategory?: Parameters<typeof createApp>[0]["suggestCategory"]) =>
    createApp({ firebaseProjectId: "", allowDevUser: true, suggestCategory });
  const ask = (app: ReturnType<typeof appWith>, body: unknown) => call(app, "POST", "/api/suggest-category", body);

  it("hands the title and the cleaned categories to the suggester", async () => {
    const suggest = vi.fn(async () => "Health");
    const res = await ask(appWith(suggest), {
      text: "  Gym ",
      categories: [{ name: " Health ", examples: ["Workout", 7, ""] }, { name: "" }, "junk", { name: "Work" }],
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ category: "Health" });
    expect(suggest).toHaveBeenCalledWith("Gym", [
      { name: "Health", examples: ["Workout"] },
      { name: "Work", examples: [] },
    ]);
  });

  it("answers null, not an error, without a model or categories", async () => {
    expect((await ask(appWith(), { text: "Gym", categories: OPTIONS })).body).toEqual({ category: null });
    const suggest = vi.fn(async () => "Health");
    expect((await ask(appWith(suggest), { text: "Gym" })).body).toEqual({ category: null });
    expect(suggest).not.toHaveBeenCalled();
  });

  it("needs some text", async () => {
    expect((await ask(appWith(vi.fn(async () => null)), { categories: OPTIONS })).status).toBe(400);
  });

  it("is for signed-in people only", async () => {
    const suggest = vi.fn(async () => "Health");
    const app = createApp({ firebaseProjectId: "demo-project", allowDevUser: false, suggestCategory: suggest });
    expect((await ask(app, { text: "Gym", categories: OPTIONS })).status).toBe(401);
    expect(suggest).not.toHaveBeenCalled();
  });
});
