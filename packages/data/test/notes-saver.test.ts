import type { DayNotes } from "@klndr/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NOTES_SAVE_DELAY_MS, NotesSaver } from "../src/notes-saver";

/** A saver whose requests are settled by hand. */
function setup() {
  const requests: Array<{ day: string; text: string; ok: () => void; fail: () => void }> = [];
  const saved: DayNotes[] = [];
  const saver = new NotesSaver({
    save: (day, text) =>
      new Promise<DayNotes>((resolve, reject) => {
        requests.push({ day, text, ok: () => resolve({ day, text }), fail: () => reject(new Error("offline")) });
      }),
    onSaved: (notes) => saved.push(notes),
  });
  const statuses: string[] = [];
  saver.subscribe(() => statuses.push(saver.status));
  return { saver, requests, saved, statuses };
}

const flushMicrotasks = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("NotesSaver", () => {
  it("waits for typing to pause, then sends once with the latest text", async () => {
    const { saver, requests } = setup();
    saver.queue("2031-04-14", "h");
    await vi.advanceTimersByTimeAsync(NOTES_SAVE_DELAY_MS - 1);
    saver.queue("2031-04-14", "he");
    await vi.advanceTimersByTimeAsync(NOTES_SAVE_DELAY_MS - 1);
    expect(requests).toHaveLength(0); // each keystroke restarted the wait

    await vi.advanceTimersByTimeAsync(1);
    expect(requests.map((r) => r.text)).toEqual(["he"]);
  });

  it("reports saving, then saved, and hands over the server's copy", async () => {
    const { saver, requests, saved, statuses } = setup();
    saver.queue("2031-04-14", "hello");
    await vi.advanceTimersByTimeAsync(NOTES_SAVE_DELAY_MS);
    expect(saver.status).toBe("saving");

    requests[0].ok();
    await flushMicrotasks();

    expect(saver.status).toBe("saved");
    expect(saved).toEqual([{ day: "2031-04-14", text: "hello" }]);
    expect(statuses).toEqual(["saving", "saved"]);
    expect(saver.busy).toBe(false);
  });

  it("sends one request at a time and then the text typed meanwhile", async () => {
    const { saver, requests, saved } = setup();
    saver.queue("2031-04-14", "one");
    await vi.advanceTimersByTimeAsync(NOTES_SAVE_DELAY_MS);
    saver.queue("2031-04-14", "one two");
    await vi.advanceTimersByTimeAsync(NOTES_SAVE_DELAY_MS);
    expect(requests).toHaveLength(1); // the second waits for the first

    requests[0].ok();
    await flushMicrotasks();
    expect(requests.map((r) => r.text)).toEqual(["one", "one two"]);
    expect(saver.status).toBe("saving"); // not "saved" while more is on its way

    requests[1].ok();
    await flushMicrotasks();
    expect(saver.status).toBe("saved");
    expect(saved.map((n) => n.text)).toEqual(["one", "one two"]);
  });

  it("keeps the text when saving fails, and sends it again on retry", async () => {
    const { saver, requests } = setup();
    saver.queue("2031-04-14", "precious");
    await vi.advanceTimersByTimeAsync(NOTES_SAVE_DELAY_MS);
    requests[0].fail();
    await flushMicrotasks();

    expect(saver.status).toBe("error");
    expect(saver.busy).toBe(true); // still waiting to be saved

    void saver.retry();
    await flushMicrotasks();
    expect(requests.map((r) => r.text)).toEqual(["precious", "precious"]);
    requests[1].ok();
    await flushMicrotasks();
    expect(saver.status).toBe("saved");
    expect(saver.busy).toBe(false);
  });

  it("sends newer text instead of the failed text when the user types again", async () => {
    const { saver, requests } = setup();
    saver.queue("2031-04-14", "first");
    await vi.advanceTimersByTimeAsync(NOTES_SAVE_DELAY_MS);
    requests[0].fail();
    await flushMicrotasks();

    saver.queue("2031-04-14", "first, fixed");
    expect(saver.status).toBe("idle"); // the error is cleared by typing
    await vi.advanceTimersByTimeAsync(NOTES_SAVE_DELAY_MS);
    expect(requests.at(-1)?.text).toBe("first, fixed");
  });

  it("flushes at once, without waiting for the pause", async () => {
    const { saver, requests } = setup();
    saver.queue("2031-04-14", "now");
    void saver.flush();
    expect(requests).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(NOTES_SAVE_DELAY_MS * 2);
    expect(requests).toHaveLength(1); // and the timer doesn't send it a second time
  });

  it("does nothing when there is nothing to send", async () => {
    const { saver, requests } = setup();
    await saver.flush();
    expect(requests).toHaveLength(0);
    expect(saver.status).toBe("idle");
  });

  it("sends text typed on one day under that day", async () => {
    const { saver, requests } = setup();
    saver.queue("2031-04-14", "monday");
    void saver.flush(); // the person switched to another day
    saver.reset();
    saver.queue("2031-04-15", "tuesday");
    expect(requests[0]).toMatchObject({ day: "2031-04-14", text: "monday" });

    requests[0].ok();
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(NOTES_SAVE_DELAY_MS);
    expect(requests[1]).toMatchObject({ day: "2031-04-15", text: "tuesday" });
  });

  it("is told about every change in status, and can be left", async () => {
    const { saver, statuses, requests } = setup();
    const extra = vi.fn();
    const stop = saver.subscribe(extra);
    saver.queue("d", "x");
    await vi.advanceTimersByTimeAsync(NOTES_SAVE_DELAY_MS);
    expect(extra).toHaveBeenCalled();
    stop();
    extra.mockClear();
    requests[0].ok();
    await flushMicrotasks();
    expect(extra).not.toHaveBeenCalled();
    expect(statuses.at(-1)).toBe("saved");
  });
});
