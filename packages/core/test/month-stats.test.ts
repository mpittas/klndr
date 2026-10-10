import { describe, expect, it } from "vitest";
import { categoryBreakdown, hoursLabel, shortTime, type ScheduledTask } from "../src/index";

const task = (over: Partial<ScheduledTask>): ScheduledTask => ({
  id: "t",
  templateId: null,
  title: "Task",
  emoji: "📌",
  color: "indigo",
  category: "Work",
  day: "2026-10-05",
  startMinutes: 540,
  durationMinutes: 60,
  notes: null,
  completed: false,
  ...over,
});

describe("categoryBreakdown", () => {
  it("adds up each category and puts the biggest first", () => {
    const shares = categoryBreakdown([
      task({ id: "a", category: "Work", durationMinutes: 60, completed: true }),
      task({ id: "b", category: "Health", durationMinutes: 120 }),
      task({ id: "c", category: "Work", durationMinutes: 30 }),
    ]);
    expect(shares.map((share) => [share.category, share.minutes, share.count, share.done])).toEqual([
      ["Health", 120, 1, 0],
      ["Work", 90, 2, 1],
    ]);
    expect(shares[1].sample.id).toBe("a");
  });

  it("breaks a tie by name, and is empty for nothing", () => {
    expect(categoryBreakdown([task({ id: "x", category: "B" }), task({ id: "y", category: "A" })]).map((s) => s.category)).toEqual(["A", "B"]);
    expect(categoryBreakdown([])).toEqual([]);
  });
});

describe("labels", () => {
  it("writes a time short enough for a narrow chip", () => {
    expect(shortTime(0)).toBe("12a");
    expect(shortTime(450)).toBe("7:30a");
    expect(shortTime(720)).toBe("12p");
    expect(shortTime(19 * 60 + 5)).toBe("7:05p");
  });

  it("writes minutes, then hours", () => {
    expect(hoursLabel(45)).toBe("45m");
    expect(hoursLabel(60)).toBe("1h");
    expect(hoursLabel(90)).toBe("1.5h");
  });
});
