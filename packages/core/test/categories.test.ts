import { describe, expect, it } from "vitest";
import {
  COLOR_KEYS,
  colorOfCategory,
  compareCategoriesByName,
  isColorFree,
  nextCategoryColor,
  planDistinctColors,
  sortCategoriesByName,
  takenColors,
  withImplicitCategories,
  type ActivityTemplate,
  type Category,
} from "../src/index";

const category = (id: string, name: string, color = "indigo"): Category => ({ id, name, color });

const template = (name: string, categoryName: string, color = "emerald"): ActivityTemplate => ({
  id: `t-${name}`,
  name,
  emoji: "📌",
  color,
  category: categoryName,
  defaultDuration: 60,
  notes: null,
  archived: false,
});

describe("withImplicitCategories", () => {
  it("returns the saved categories, sorted", () => {
    const entries = withImplicitCategories([category("1", "Work"), category("2", "Admin")]);
    expect(entries.map((entry) => entry.name)).toEqual(["Admin", "Work"]);
    expect(entries.map((entry) => entry.id)).toEqual(["2", "1"]);
  });

  it("adds a name the activities use but that was never saved", () => {
    const entries = withImplicitCategories([category("1", "Work")], [template("Gym", "Fitness", "rose")]);
    expect(entries).toEqual([
      { id: null, name: "Fitness", color: "rose" },
      { id: "1", name: "Work", color: "indigo" },
    ]);
  });

  it("matches a saved category whatever the case, and only once", () => {
    const entries = withImplicitCategories(
      [category("1", "Work")],
      [template("A", "  work  "), template("B", "Work")],
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ id: "1", name: "Work" });
  });

  it("keeps one entry per unsaved name, trimmed, in the order it is first seen", () => {
    const entries = withImplicitCategories([], [template("A", " Fitness "), template("B", "fitness"), template("C", "Admin")]);
    expect(entries.map((entry) => entry.name)).toEqual(["Admin", "Fitness"]);
  });

  it("falls back to slate when the activity has no color", () => {
    const entries = withImplicitCategories([], [template("A", "Fitness", "")]);
    expect(entries[0].color).toBe("slate");
  });

  it("ignores an activity without a category", () => {
    expect(withImplicitCategories([], [template("A", "   ")])).toEqual([]);
  });
});

describe("colorOfCategory", () => {
  const categories = [category("1", "Work", "emerald")];

  it("takes the colour from the category, whatever the case and spacing", () => {
    expect(colorOfCategory(categories, { category: " work ", color: "rose" })).toBe("emerald");
    expect(colorOfCategory(categories, { category: "WORK" })).toBe("emerald");
  });

  it("falls back to the item's own colour, then to slate", () => {
    expect(colorOfCategory(categories, { category: "Gym", color: "rose" })).toBe("rose");
    expect(colorOfCategory(categories, { category: "Gym" })).toBe("slate");
    expect(colorOfCategory([], { category: "" })).toBe("slate");
  });
});

describe("nextCategoryColor", () => {
  it("picks the first colour that isn't used yet", () => {
    expect(nextCategoryColor([])).toBe(COLOR_KEYS[0]);
    expect(nextCategoryColor([{ color: "indigo" }])).toBe(COLOR_KEYS[1]);
  });

  it("counts a dropped colour as the one that replaced it", () => {
    // sky is shown as cyan, so cyan counts as taken
    const used = ["indigo", "orange", "emerald", "pink", "sky"].map((color) => ({ color }));
    expect(nextCategoryColor(used)).toBe("yellow");
  });

  it("keeps grey for the unsorted category until every other colour is used", () => {
    const allButGrey = COLOR_KEYS.filter((key) => key !== "slate").map((color) => ({ color }));
    expect(nextCategoryColor(allButGrey.slice(0, -1))).not.toBe("slate");
    expect(nextCategoryColor(allButGrey)).toBe("slate");
  });

  it("cycles through the palette once every colour is used", () => {
    const used = COLOR_KEYS.map((color) => ({ color }));
    expect(nextCategoryColor(used)).toBe(COLOR_KEYS[COLOR_KEYS.length % COLOR_KEYS.length]);
  });
});

describe("isColorFree", () => {
  it("is free when no other category has it, or when nothing else is left", () => {
    expect(isColorFree("orange", [{ color: "indigo" }])).toBe(true);
    expect(isColorFree("cyan", [{ color: "sky" }])).toBe(false);
    expect(isColorFree("indigo", COLOR_KEYS.map((color) => ({ color })))).toBe(true);
  });
});

describe("takenColors", () => {
  it("says which category has each colour, leaving out the one being edited", () => {
    const list = [category("1", "Work", "indigo"), category("2", "Chill", "amber")];
    expect(takenColors(list)).toEqual(new Map([["indigo", "Work"], ["yellow", "Chill"]]));
    expect(takenColors(list, "work")).toEqual(new Map([["yellow", "Chill"]]));
  });

  it("takes nothing away once every colour is used", () => {
    const list = COLOR_KEYS.map((color, i) => category(String(i), `C${i}`, color));
    expect(takenColors(list).size).toBe(0);
  });
});

describe("planDistinctColors", () => {
  it("leaves categories that already have colours of their own alone", () => {
    expect(planDistinctColors([category("1", "A", "indigo"), category("2", "B", "orange")])).toEqual([]);
  });

  it("lets the first with a colour keep it and gives each later one a free colour", () => {
    const list = [category("1", "Chill", "orange"), category("2", "Daily routines", "orange"), category("3", "Work", "indigo"), category("4", "Zen", "indigo")];
    expect(planDistinctColors(list)).toEqual([
      { id: "2", color: "emerald" },
      { id: "4", color: "pink" },
    ]);
  });

  it("keeps grey for the unsorted category", () => {
    const list = [category("1", "Admin", "slate"), category("2", "Uncategorized", "slate")];
    expect(planDistinctColors(list)).toEqual([{ id: "1", color: "indigo" }]);
  });

  it("leaves a repeat once there are no colours left to give", () => {
    const list = [...COLOR_KEYS.map((color, i) => category(String(i), `C${i}`, color)), category("x", "Extra", "indigo")];
    expect(planDistinctColors(list)).toEqual([]);
  });
});

describe("sortCategoriesByName", () => {
  it("sorts a copy, leaving the list it was given alone", () => {
    const list = [category("1", "Work"), category("2", "Admin")];
    const sorted = sortCategoriesByName(list);
    expect(sorted.map((entry) => entry.name)).toEqual(["Admin", "Work"]);
    expect(list.map((entry) => entry.name)).toEqual(["Work", "Admin"]);
    expect(compareCategoriesByName({ name: "a" }, { name: "b" })).toBeLessThan(0);
  });
});
