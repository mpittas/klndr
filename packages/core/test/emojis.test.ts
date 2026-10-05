import { describe, expect, it } from "vitest";
import {
  FALLBACK_EMOJI,
  RECENT_EMOJIS_KEY,
  RECENT_EMOJIS_MAX,
  buildEmojiGroups,
  buildEmojiRows,
  emojiFieldDue,
  emojiFieldReducer,
  emojiFieldState,
  emojiNeedsPicking,
  isEmojiKind,
  moveEmojiCursor,
  normalizeEmojiTitle,
  readRecentEmojis,
  rememberEmoji,
  searchEmojis,
  type CompactEmoji,
  type EmojiFieldState,
  type KeyValueStorage,
} from "../src/index";

const data: CompactEmoji[] = [
  { unicode: "😀", label: "grinning face", tags: ["face", "smile"], group: 0 },
  { unicode: "👋", label: "waving hand", group: 1 },
  { unicode: "🦰", label: "red hair", group: 2 },
  { unicode: "🏳️", label: "white flag", tags: ["flag"], group: 3 },
];
const keys = [{ key: "smileys-emotion" }, { key: "people-body" }, { key: "components" }, { key: "flags" }];

describe("buildEmojiGroups", () => {
  it("keeps only the groups it knows about", () => {
    expect(buildEmojiGroups(data, keys).map((group) => group.key)).toEqual([
      "smileys-emotion",
      "people-body",
      "flags",
    ]);
  });

  it("puts each emoji in the group its index points at", () => {
    const groups = buildEmojiGroups(data, keys);
    expect(groups[0]).toMatchObject({ label: "Smileys & Emotion", icon: "😀" });
    expect(groups[0].emojis).toEqual([{ char: "😀", label: "grinning face", tags: ["face", "smile"] }]);
    expect(groups[1].emojis).toEqual([{ char: "👋", label: "waving hand", tags: [] }]);
    expect(groups[2].emojis).toEqual([{ char: "🏳️", label: "white flag", tags: ["flag"] }]);
  });

  it("takes labels from the meta it is given", () => {
    const groups = buildEmojiGroups(data, keys, { flags: { label: "Banners", icon: "🚩" } });
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ key: "flags", label: "Banners", icon: "🚩" });
  });
});

describe("searchEmojis", () => {
  const groups = buildEmojiGroups(data, keys);

  it("needs a query", () => {
    expect(searchEmojis(groups, "")).toEqual([]);
    expect(searchEmojis(groups, "   ")).toEqual([]);
  });

  it("matches the label or a tag, whatever the case", () => {
    expect(searchEmojis(groups, "GRINNING").map((emoji) => emoji.char)).toEqual(["😀"]);
    expect(searchEmojis(groups, "smile").map((emoji) => emoji.char)).toEqual(["😀"]);
    expect(searchEmojis(groups, "hand").map((emoji) => emoji.char)).toEqual(["👋"]);
  });

  it("needs every word to match", () => {
    expect(searchEmojis(groups, "grinning face")).toHaveLength(1);
    expect(searchEmojis(groups, "face flag")).toEqual([]);
  });

  it("finds nothing when nothing matches", () => {
    expect(searchEmojis(groups, "zzz")).toEqual([]);
  });
});

/** A stand-in for localStorage, MMKV or anything else that keeps a string by key. */
function storage(initial?: string) {
  const entries = new Map<string, string>();
  if (initial !== undefined) entries.set(RECENT_EMOJIS_KEY, initial);
  return {
    entries,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
  } satisfies KeyValueStorage & { entries: Map<string, string> };
}

const broken: KeyValueStorage = {
  getItem: () => {
    throw new Error("unavailable");
  },
  setItem: () => {
    throw new Error("unavailable");
  },
};

describe("recent emojis", () => {
  it("has none without storage", () => {
    expect(readRecentEmojis(null)).toEqual([]);
    expect(readRecentEmojis(undefined)).toEqual([]);
    expect(() => rememberEmoji(undefined, "😀")).not.toThrow();
  });

  it("has none on first use, or when what is stored is unusable", () => {
    expect(readRecentEmojis(storage())).toEqual([]);
    expect(readRecentEmojis(storage('{"not":"an array"}'))).toEqual([]);
    expect(readRecentEmojis(storage("not json at all"))).toEqual([]);
    expect(readRecentEmojis(broken)).toEqual([]);
  });

  it("keeps only the strings it finds", () => {
    expect(readRecentEmojis(storage('["😀",5,null,"🎉"]'))).toEqual(["😀", "🎉"]);
  });

  it("remembers a new emoji at the front, once", () => {
    const store = storage();
    rememberEmoji(store, "😀");
    rememberEmoji(store, "🎉");
    rememberEmoji(store, "😀");
    expect(readRecentEmojis(store)).toEqual(["😀", "🎉"]);
  });

  it("keeps the newest few only", () => {
    const store = storage();
    for (let i = 0; i < RECENT_EMOJIS_MAX + 5; i++) rememberEmoji(store, `e${i}`);
    const recent = readRecentEmojis(store);
    expect(recent).toHaveLength(RECENT_EMOJIS_MAX);
    expect(recent[0]).toBe(`e${RECENT_EMOJIS_MAX + 4}`);
  });

  it("doesn't throw when the storage does", () => {
    expect(() => rememberEmoji(broken, "😀")).not.toThrow();
  });
});

describe("the picker's row model", () => {
  const entry = (char: string) => ({ char, label: char, tags: [] });
  const sections = [
    { id: "a", label: "A", emojis: ["1", "2", "3", "4", "5"].map(entry) },
    { id: "b", label: "B", emojis: ["6", "7"].map(entry) },
    { id: "empty", label: "Empty", emojis: [] },
  ];

  it("lays sections out as titled rows of at most `columns` emojis", () => {
    const { rows, cells } = buildEmojiRows(sections, 3);
    expect(cells.map((c) => c.char)).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
    expect(rows).toEqual([
      { kind: "header", id: "a", label: "A" },
      { kind: "emojis", start: 0, count: 3 },
      { kind: "emojis", start: 3, count: 2 },
      { kind: "header", id: "b", label: "B" },
      { kind: "emojis", start: 5, count: 2 },
    ]);
  });

  it("can leave the titles out (search results)", () => {
    const { rows } = buildEmojiRows(sections, 3, false);
    expect(rows.every((row) => row.kind === "emojis")).toBe(true);
  });

  it("moves the cursor with the arrow keys, across titles and onto shorter rows", () => {
    const { rows, cells } = buildEmojiRows(sections, 3);
    const total = cells.length;
    expect(moveEmojiCursor(rows, total, -1, "down")).toBe(0);
    expect(moveEmojiCursor(rows, total, 0, "left")).toBe(0);
    expect(moveEmojiCursor(rows, total, 6, "right")).toBe(6);
    expect(moveEmojiCursor(rows, total, 2, "right")).toBe(3);
    expect(moveEmojiCursor(rows, total, 2, "down")).toBe(4); // the next row has two emojis, so the column clamps
    expect(moveEmojiCursor(rows, total, 4, "down")).toBe(6); // skips the "B" title; column 1 stays
    expect(moveEmojiCursor(rows, total, 6, "up")).toBe(4);
    expect(moveEmojiCursor(rows, total, 0, "up")).toBe(0);
    expect(moveEmojiCursor(rows, 0, 0, "down")).toBe(-1);
  });
});

describe("emoji picked for a title", () => {
  const state = (over: Partial<Parameters<typeof emojiNeedsPicking>[0]> = {}) => ({
    emoji: null as string | null,
    pickedFor: "",
    byHand: false,
    title: "Gym",
    ...over,
  });

  it("compares titles without minding case or spacing", () => {
    expect(normalizeEmojiTitle("  Deep   Work ")).toBe("deep work");
  });

  it("picks one for a new item that has none", () => {
    expect(emojiNeedsPicking(state())).toBe(true);
  });

  it("has nothing to pick for until there is a title", () => {
    expect(emojiNeedsPicking(state({ title: "   " }))).toBe(false);
  });

  it("keeps an emoji whose title hasn't changed", () => {
    expect(emojiNeedsPicking(state({ emoji: "🏋️", pickedFor: "Gym", title: "gym " }))).toBe(false);
  });

  it("picks again when the title it was picked for has changed", () => {
    expect(emojiNeedsPicking(state({ emoji: "🏋️", pickedFor: "Gym", title: "Reading" }))).toBe(true);
  });

  it("never replaces an emoji chosen by hand, whatever the title says", () => {
    expect(emojiNeedsPicking(state({ emoji: "🔥", pickedFor: "Gym", byHand: true, title: "Reading" }))).toBe(false);
  });

  it("knows the two things an emoji is picked for, each with a fallback", () => {
    expect(isEmojiKind("activity")).toBe(true);
    expect(isEmojiKind("category")).toBe(true);
    expect(isEmojiKind("habit")).toBe(false);
    expect(Object.keys(FALLBACK_EMOJI).sort()).toEqual(["activity", "category"]);
  });
});

describe("the emoji of a title field", () => {
  const answer = Promise.resolve("🏋️");
  const typed = (state: EmojiFieldState, title: string, known?: string) =>
    emojiFieldReducer(state, { type: "title", title, known });
  const asked = (state: EmojiFieldState, id = 1) =>
    emojiFieldReducer(state, { type: "asked", id, title: state.title, answer });

  it("is due once a new item has a title, and not before", () => {
    const empty = emojiFieldState(null, "");
    expect(emojiFieldDue(empty)).toBe(false);
    expect(emojiFieldDue(typed(empty, "Gym"))).toBe(true);
  });

  it("is no longer due while a pick is on its way", () => {
    expect(emojiFieldDue(asked(typed(emojiFieldState(null, ""), "Gym")))).toBe(false);
  });

  it("takes the answer for the title in the field", () => {
    const state = emojiFieldReducer(asked(typed(emojiFieldState(null, ""), "Gym")), { type: "answered", id: 1, emoji: "🏋️" });
    expect(state).toMatchObject({ emoji: "🏋️", pickedFor: "Gym", byHand: false, asked: null });
    expect(emojiFieldDue(state)).toBe(false);
  });

  it("drops an answer for a title that has since changed, and is due again", () => {
    const moved = typed(asked(typed(emojiFieldState(null, ""), "Gym")), "Reading");
    expect(moved.asked).toBeNull();
    expect(emojiFieldDue(moved)).toBe(true);
    expect(emojiFieldReducer(moved, { type: "answered", id: 1, emoji: "🏋️" }).emoji).toBeNull();
  });

  it("keeps waiting when the title only changed in case or spacing", () => {
    expect(typed(asked(typed(emojiFieldState(null, ""), "Gym")), "gym ").asked?.id).toBe(1);
  });

  it("drops an answer once the person has chosen an emoji", () => {
    const chosen = emojiFieldReducer(asked(typed(emojiFieldState(null, ""), "Gym")), { type: "choose", emoji: "🔥" });
    expect(emojiFieldReducer(chosen, { type: "answered", id: 1, emoji: "🏋️" })).toMatchObject({ emoji: "🔥", byHand: true });
    expect(emojiFieldDue(typed(chosen, "Reading"))).toBe(false);
  });

  it("takes an emoji the person already uses for that name at once", () => {
    expect(typed(emojiFieldState(null, ""), "Gym", "🏋️")).toMatchObject({ emoji: "🏋️", pickedFor: "Gym", byHand: false });
  });

  it("leaves an emoji chosen by hand alone, even for a known name", () => {
    expect(typed(emojiFieldState("🔥", "Run", true), "Gym", "🏋️").emoji).toBe("🔥");
  });

  it("keeps an edited item's emoji until its title changes", () => {
    const editing = emojiFieldState("🏋️", "Gym");
    expect(emojiFieldDue(typed(editing, "Gym"))).toBe(false);
    expect(emojiFieldDue(typed(editing, "Gym class"))).toBe(true);
  });

  it("picks again on \"Pick for me\", showing the current emoji until the new one comes", () => {
    const state = emojiFieldReducer(emojiFieldState("🔥", "Gym", true), { type: "auto" });
    expect(state).toMatchObject({ emoji: "🔥", byHand: false });
    expect(emojiFieldDue(state)).toBe(true);
  });

  it("goes back to the placeholder on \"Pick for me\" when there is no title yet", () => {
    const state = emojiFieldReducer(emojiFieldState("🔥", "", true), { type: "auto" });
    expect(state).toMatchObject({ emoji: null, byHand: false });
    expect(emojiFieldDue(state)).toBe(false);
  });
});
