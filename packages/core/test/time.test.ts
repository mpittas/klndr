import { describe, expect, it } from "vitest";
import {
  DURATION_CHOICES,
  HOUR_OPTIONS,
  MONTH_LABELS,
  WEEKDAY_LABELS,
  addDaysISO,
  addMonths,
  floorMinutes,
  formatDuration,
  formatTime,
  formatTimeRange,
  fromTimeInput,
  getMonthIndex,
  getYear,
  gutterLabel,
  isSameMonth,
  isValidISODate,
  longDate,
  mediumDate,
  monthMatrix,
  monthRange,
  monthTitle,
  nowMinutes,
  parseISODate,
  setYearMonth,
  snapMinutes,
  timeInputValue,
  toISODate,
  todayISO,
} from "../src/index";

describe("ISO dates", () => {
  it("formats a Date as a local YYYY-MM-DD", () => {
    expect(toISODate(new Date(2026, 9, 3))).toBe("2026-10-03");
    expect(toISODate(new Date(2026, 0, 9))).toBe("2026-01-09");
  });

  it("parses a day, a month and garbage", () => {
    expect(toISODate(parseISODate("2026-10-03"))).toBe("2026-10-03");
    expect(toISODate(parseISODate("2026-10"))).toBe("2026-10-01"); // a month means its first day
    expect(toISODate(parseISODate("nonsense"))).toBe(todayISO()); // garbage means today
    expect(parseISODate("2026-10-03").getHours()).toBe(0);
  });

  it("accepts only YYYY-MM-DD", () => {
    expect(isValidISODate("2026-10-03")).toBe(true);
    expect(isValidISODate("2026-10-3")).toBe(false);
    expect(isValidISODate("2026/10/03")).toBe(false);
    expect(isValidISODate(20261003)).toBe(false);
    expect(isValidISODate(null)).toBe(false);
  });

  it("reads the year and the month index", () => {
    expect(getYear("2026-10-03")).toBe(2026);
    expect(getMonthIndex("2026-10-03")).toBe(9);
  });

  it("adds days and months", () => {
    expect(addDaysISO("2026-10-03", 1)).toBe("2026-10-04");
    expect(addDaysISO("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysISO("2026-10-01", -1)).toBe("2026-09-30");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-01"); // the day resets to the first
    expect(addMonths("2026-10-03", -1)).toBe("2026-09-01");
  });

  it("keeps the day in range when setting the year and month", () => {
    expect(setYearMonth("2026-01-31", 2026, 1)).toBe("2026-02-28");
    expect(setYearMonth("2026-01-15", 2027, 0)).toBe("2027-01-15");
  });
});

describe("month grid", () => {
  it("covers the month in a 6x7 grid starting on Sunday", () => {
    const cells = monthMatrix("2026-10-03");
    expect(cells).toHaveLength(42);
    expect(cells[0]).toBe("2026-09-27"); // the Sunday on or before the 1st
    expect(cells.at(-1)).toBe("2026-11-07");
    expect(cells).toContain("2026-10-01");
    expect(parseISODate(cells[0]).getDay()).toBe(0);
  });

  it("reports the months range", () => {
    expect(monthRange("2026-10-03")).toEqual({ from: "2026-09-27", to: "2026-11-07" });
    expect(isSameMonth("2026-09-27", "2026-10-03")).toBe(false);
    expect(isSameMonth("2026-10-27", "2026-10-03")).toBe(true);
  });
});

describe("labels", () => {
  it("writes dates in en-US", () => {
    expect(longDate("2026-10-03")).toBe("Saturday, October 3");
    expect(mediumDate("2026-10-03")).toBe("Sat, Oct 3");
    expect(monthTitle("2026-10-03")).toBe("October 2026");
    expect(MONTH_LABELS[9]).toBe("October");
    expect(WEEKDAY_LABELS[6]).toBe("Sat");
  });
});

describe("minutes", () => {
  it("snaps to the step and clamps to the day", () => {
    expect(snapMinutes(533)).toBe(540);
    expect(snapMinutes(533, 15)).toBe(540);
    expect(snapMinutes(526, 15)).toBe(525);
    expect(snapMinutes(-5)).toBe(0);
    expect(snapMinutes(1439)).toBe(1440);
  });

  it("floors to the start of the step", () => {
    expect(floorMinutes(541)).toBe(540);
    expect(floorMinutes(541, 15)).toBe(540);
    expect(floorMinutes(1400)).toBe(1380);
    expect(floorMinutes(1439)).toBe(1410); // never past the last full slot
  });

  it("formats a time, and a range where the suffix is shared", () => {
    expect(formatTime(0)).toBe("12:00 AM");
    expect(formatTime(495)).toBe("8:15 AM");
    expect(formatTime(720)).toBe("12:00 PM");
    expect(formatTime(1439)).toBe("11:59 PM");
    expect(formatTime(-60)).toBe("11:00 PM");
    expect(formatTimeRange(540, 660)).toBe("9:00 – 11:00 AM");
    expect(formatTimeRange(690, 780)).toBe("11:30 AM – 1:00 PM");
  });

  it("labels the hour gutter only on the hour", () => {
    expect(gutterLabel(0)).toBe("12 AM");
    expect(gutterLabel(30)).toBeNull();
    expect(gutterLabel(720)).toBe("12 PM");
    expect(gutterLabel(1380)).toBe("11 PM");
  });

  it("formats a duration", () => {
    expect(formatDuration(0)).toBe("0m");
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(90)).toBe("1h 30m");
    expect(formatDuration(240)).toBe("4h");
    expect(DURATION_CHOICES).toContain(90);
  });

  it("round-trips a time input", () => {
    expect(timeInputValue(570)).toBe("09:30");
    expect(fromTimeInput("09:30")).toBe(570);
    expect(fromTimeInput("")).toBe(540); // a default of 09:00
    expect(fromTimeInput("25:00")).toBe(1440); // clamped to the end of the day
    expect(timeInputValue(1440)).toBe("24:00");
  });

  it("reports the current minute of the day", () => {
    const now = nowMinutes();
    expect(now).toBeGreaterThanOrEqual(0);
    expect(now).toBeLessThan(1440);
    expect(HOUR_OPTIONS).toHaveLength(48);
    expect(HOUR_OPTIONS.at(-1)).toBe(1410);
  });

  it("reports today", () => {
    expect(todayISO()).toBe(toISODate(new Date()));
  });
});
