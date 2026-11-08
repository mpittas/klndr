import { describe, expect, it } from "vitest";
import { weekDays, weekTitle } from "../src/time";

describe("weekDays", () => {
  it("gives the seven days of the week a date falls in, from Sunday", () => {
    // 2026-11-08 is a Sunday.
    expect(weekDays("2026-11-11")).toEqual([
      "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14",
    ]);
    expect(weekDays("2026-11-08")[0]).toBe("2026-11-08");
  });

  it("starts on Monday when asked, Sunday being the last day", () => {
    expect(weekDays("2026-11-08", true)).toEqual([
      "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08",
    ]);
    expect(weekDays("2026-11-09", true)[0]).toBe("2026-11-09");
  });

  it("crosses months and years", () => {
    expect(weekDays("2027-01-01", true)).toEqual([
      "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03",
    ]);
  });
});

describe("weekTitle", () => {
  it("names the month once when the week stays in it", () => {
    expect(weekTitle("2026-11-02", "2026-11-08")).toBe("Nov 2 – 8, 2026");
  });

  it("names both months, and both years, when the week crosses them", () => {
    expect(weekTitle("2026-10-26", "2026-11-01")).toBe("Oct 26 – Nov 1, 2026");
    expect(weekTitle("2026-12-28", "2027-01-03")).toBe("Dec 28, 2026 – Jan 3, 2027");
  });
});
