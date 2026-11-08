import { describe, expect, it } from "vitest";
import {
  categoryOptions,
  guessCategoryFromHistory,
  isCatchAllCategory,
  MAX_CATEGORY_EXAMPLES,
  parseCategoryAnswer,
  rankCategories,
} from "../src/category-guess";

const cats = (...names: string[]) => names.map((name) => ({ name }));

describe("isCatchAllCategory", () => {
  it("knows the names that say nothing about a block", () => {
    expect(isCatchAllCategory("General")).toBe(true);
    expect(isCatchAllCategory(" uncategorized ")).toBe(true);
    expect(isCatchAllCategory("Health")).toBe(false);
  });
});

describe("categoryOptions", () => {
  it("leaves out the catch-alls and lists a few distinct things filed under each", () => {
    const options = categoryOptions(cats("General", "Health", "Work"), [
      { title: "Workout", category: "Health" },
      { title: "workout ", category: "health" },
      { title: "Walk", category: "Health" },
      { title: "Stuff", category: "General" },
    ]);
    expect(options).toEqual([
      { name: "Health", examples: ["Workout", "Walk"] },
      { name: "Work", examples: [] },
    ]);
  });

  it("keeps the examples short and few", () => {
    const filed = Array.from({ length: 20 }, (_, i) => ({ title: `Thing ${i}`, category: "Home" }));
    expect(categoryOptions(cats("Home"), filed)[0].examples).toHaveLength(MAX_CATEGORY_EXAMPLES);
  });
});

describe("guessCategoryFromHistory", () => {
  const options = cats("Health", "Work", "Home");

  it("files a title like the activity of that name", () => {
    expect(guessCategoryFromHistory(" gym ", [{ title: "Gym", category: "Health" }], [], options)).toBe("Health");
  });

  it("otherwise goes where most blocks with that title went, the latest on a tie", () => {
    const blocks = [
      { title: "Plan", category: "Work" },
      { title: "Plan", category: "Home" },
      { title: "Plan", category: "Work" },
    ];
    expect(guessCategoryFromHistory("plan", [], blocks, options)).toBe("Work");
    expect(guessCategoryFromHistory("plan", [], blocks.slice(0, 2), options)).toBe("Home");
  });

  it("never repeats a catch-all or a category that is gone", () => {
    const blocks = [
      { title: "Gym", category: "General" },
      { title: "Gym", category: "Deleted" },
    ];
    expect(guessCategoryFromHistory("Gym", [], blocks, options)).toBeNull();
  });

  it("has nothing for an empty title", () => {
    expect(guessCategoryFromHistory("  ", [{ title: "", category: "Work" }], [], options)).toBeNull();
  });
});

describe("rankCategories", () => {
  it("puts the most used first and the catch-alls last", () => {
    const filed = [
      { title: "a", category: "Work" },
      { title: "b", category: "Work" },
      { title: "c", category: "Health" },
      { title: "d", category: "General" },
      { title: "e", category: "General" },
      { title: "f", category: "General" },
    ];
    expect(rankCategories(["General", "Health", "Home", "Work"], filed)).toEqual(["Work", "Health", "Home", "General"]);
  });
});

describe("parseCategoryAnswer", () => {
  const options = cats("Health", "Daily routines");

  it("takes one of the options, forgiving case, quotes and a full stop", () => {
    expect(parseCategoryAnswer("Health", options)).toBe("Health");
    expect(parseCategoryAnswer(' "daily routines". ', options)).toBe("Daily routines");
  });

  it("refuses none and anything that isn't an option", () => {
    expect(parseCategoryAnswer("none", options)).toBeNull();
    expect(parseCategoryAnswer("Fitness", options)).toBeNull();
    expect(parseCategoryAnswer("", options)).toBeNull();
  });
});
