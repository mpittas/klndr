import { describe, expect, it } from "vitest";
import {
  MAX_CATEGORY,
  MAX_EMOJI,
  MAX_NAME,
  MAX_NOTES,
  MAX_TITLE,
  clampDuration,
  clampLane,
  clampStart,
  cleanCategory,
  cleanColor,
  cleanEmoji,
  cleanNotes,
  cleanText,
  isColorKey,
  isDocId,
  isNumeric,
} from "../src/index";

describe("limits", () => {
  it("pins the sizes the UI and firestore.rules rely on", () => {
    expect(MAX_TITLE).toBe(120);
    expect(MAX_NAME).toBe(80);
    expect(MAX_CATEGORY).toBe(40);
    expect(MAX_EMOJI).toBe(8);
    expect(MAX_NOTES).toBe(500);
  });
});

describe("document ids", () => {
  it("accepts a plain token", () => {
    expect(isDocId("abc-123_XYZ")).toBe(true);
    expect(isDocId("a")).toBe(true);
    expect(isDocId("x".repeat(64))).toBe(true);
  });

  it("refuses anything that could break out of a document path", () => {
    for (const bad of ["", "a b", "a/b", "../x", "a.b", "a#b", "x".repeat(65), 42, null, undefined]) {
      expect(isDocId(bad)).toBe(false);
    }
  });
});

describe("text", () => {
  it("trims and caps a string, and refuses anything else", () => {
    expect(cleanText("  hi  ", 10)).toBe("hi");
    expect(cleanText("hello", 3)).toBe("hel");
    expect(cleanText(42, 10)).toBe("");
    expect(cleanText(null, 10)).toBe("");
  });

  it("keeps notes as they were typed, only capping the length", () => {
    expect(cleanNotes("  spaced  ")).toBe("  spaced  ");
    expect(cleanNotes("x".repeat(600))).toHaveLength(MAX_NOTES);
    expect(cleanNotes(0)).toBeNull();
    expect(cleanNotes("")).toBeNull();
    expect(cleanNotes(null)).toBeNull();
    expect(cleanNotes(undefined)).toBeNull();
    expect(cleanNotes(12)).toBe("12");
  });
});

describe("colors", () => {
  it("knows every stored key, including the ones the picker no longer offers", () => {
    expect(isColorKey("indigo")).toBe(true);
    expect(isColorKey("sky")).toBe(true);
    expect(isColorKey("chartreuse")).toBe(false);
    expect(isColorKey(42)).toBe(false);
  });

  it("falls back to indigo for anything unknown", () => {
    expect(cleanColor("emerald")).toBe("emerald");
    expect(cleanColor("nope")).toBe("indigo");
    expect(cleanColor(null)).toBe("indigo");
    expect(cleanColor(42)).toBe("indigo");
  });
});

describe("numbers", () => {
  it("sees a finite number or a numeric string", () => {
    expect(isNumeric(0)).toBe(true);
    expect(isNumeric("0")).toBe(true);
    expect(isNumeric("12.5")).toBe(true);
    expect(isNumeric("")).toBe(false);
    expect(isNumeric("abc")).toBe(false);
    expect(isNumeric(null)).toBe(false);
    expect(isNumeric(undefined)).toBe(false);
  });

  it("rounds a duration to a quarter hour and keeps it sane", () => {
    expect(clampDuration(undefined)).toBe(60);
    expect(clampDuration(undefined, 30)).toBe(30);
    expect(clampDuration("")).toBe(60);
    expect(clampDuration("abc")).toBe(60);
    expect(clampDuration(45)).toBe(45);
    expect(clampDuration(5)).toBe(15);
    expect(clampDuration(37)).toBe(30);
    expect(clampDuration(38)).toBe(45);
    expect(clampDuration(2000)).toBe(1440);
  });

  it("rounds a start time to a quarter hour and keeps it inside the day", () => {
    expect(clampStart(undefined)).toBe(540);
    expect(clampStart("")).toBe(540);
    expect(clampStart("abc")).toBe(540);
    expect(clampStart("600")).toBe(600);
    expect(clampStart(537)).toBe(540);
    expect(clampStart(524)).toBe(525);
    expect(clampStart(-5)).toBe(0);
    expect(clampStart(1439)).toBe(1425);
    expect(clampStart(9999)).toBe(1425);
  });

  it("keeps a column within the range the layout can handle", () => {
    expect(clampLane(0)).toBe(0);
    expect(clampLane(2.4)).toBe(2);
    expect(clampLane(-3)).toBe(0);
    expect(clampLane(999)).toBe(50);
  });
});

describe("emoji and category names", () => {
  it("falls back to a pin and to General", () => {
    expect(cleanEmoji("")).toBe("📌");
    expect(cleanEmoji("   ")).toBe("📌");
    expect(cleanEmoji(42)).toBe("📌");
    expect(cleanEmoji("🎉")).toBe("🎉");
    expect(cleanEmoji("1234567890")).toHaveLength(MAX_EMOJI);
    expect(cleanCategory("")).toBe("General");
    expect(cleanCategory("  Work  ")).toBe("Work");
    expect(cleanCategory("x".repeat(100))).toHaveLength(MAX_CATEGORY);
  });
});
