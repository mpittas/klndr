import { describe, expect, it } from "vitest";
import { ACCEPTED_COLOR_KEYS, COLOR_KEYS, COLOR_LABELS, canonicalColor } from "../src/index";

describe("canonicalColor", () => {
  it("keeps a colour that is offered", () => {
    for (const key of COLOR_KEYS) expect(canonicalColor(key)).toBe(key);
  });

  it("shows a dropped colour as the nearest option that is still offered", () => {
    expect(canonicalColor("amber")).toBe("yellow");
    expect(canonicalColor("rose")).toBe("red");
    expect(canonicalColor("violet")).toBe("purple");
    expect(canonicalColor("sky")).toBe("cyan");
    expect(canonicalColor("teal")).toBe("emerald");
  });

  it("falls back to indigo for anything unknown", () => {
    expect(canonicalColor("")).toBe("indigo");
    expect(canonicalColor("chartreuse")).toBe("indigo");
    expect(canonicalColor("Indigo")).toBe("indigo"); // keys are lower case
  });
});

describe("the palette", () => {
  it("accepts sixteen stored keys and offers eleven of them", () => {
    expect(ACCEPTED_COLOR_KEYS).toHaveLength(16);
    expect(COLOR_KEYS).toHaveLength(11);
    for (const key of COLOR_KEYS) expect(ACCEPTED_COLOR_KEYS).toContain(key);
  });

  it("labels every accepted key", () => {
    for (const key of ACCEPTED_COLOR_KEYS) expect(COLOR_LABELS[key]).toBeTruthy();
    expect(COLOR_LABELS.indigo).toBe("Indigo");
    expect(COLOR_LABELS.slate).toBe("Slate");
  });
});
