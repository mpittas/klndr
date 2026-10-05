import { describe, expect, it } from "vitest";
import { RADII, SPACING, TYPE_SCALE } from "../src/index";

describe("radii", () => {
  it("pins DESIGN.md's shapes scale", () => {
    expect(RADII).toEqual({ sm: 6, md: 10, lg: 14, full: 9999 });
  });
});

describe("spacing", () => {
  it("pins DESIGN.md's spacing steps", () => {
    expect(SPACING).toEqual({ xs: 4, sm: 8, md: 16, lg: 24 });
  });
});

describe("the type scale", () => {
  it("pins DESIGN.md's styles", () => {
    expect(TYPE_SCALE).toEqual({
      display: { size: 30, weight: 700, tracking: -0.025 },
      title: { size: 18, weight: 600, tracking: -0.015 },
      body: { size: 14, weight: 400, lineHeight: 1.5 },
      caption: { size: 12, weight: 500 },
      micro: { size: 11, weight: 500 },
      nano: { size: 10, weight: 600 },
    });
  });

  it("is the rem scale DESIGN.md writes, at a 16px root", () => {
    const rem = { display: 1.875, title: 1.125, body: 0.875, caption: 0.75, micro: 0.6875, nano: 0.625 };
    for (const [name, value] of Object.entries(rem)) {
      expect(TYPE_SCALE[name as keyof typeof rem].size).toBe(value * 16);
    }
  });
});
