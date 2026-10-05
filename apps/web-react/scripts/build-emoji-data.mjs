/**
 * Builds src/lib/emoji-data.json, the emoji the picker offers, from emojibase-data.
 *
 * The stock `compact.json` is 570 KB because every emoji carries its five skin-tone variants. The picker
 * only offers the base emoji, so this keeps those, plus the label and search tags, which is about a third
 * of the size. Emoji newer than Unicode 15 are left out too: most phones and desktops can't draw them
 * yet and show an empty box instead.
 *
 * Run `npm run emoji-data -w apps/web-react` after upgrading emojibase-data, and commit the result.
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const MAX_VERSION = 15;

const compact = require("emojibase-data/en/compact.json");
const data = require("emojibase-data/en/data.json");
const messages = require("emojibase-data/en/messages.json");

const versionOf = new Map(data.map((item) => [item.hexcode, item.version]));
const SKIPPED = new Set(["component"]);
const keepGroup = (group) => group !== undefined && !SKIPPED.has(messages.groups[group]?.key);

const emojis = compact
  .filter((item) => keepGroup(item.group) && (versionOf.get(item.hexcode) ?? Infinity) <= MAX_VERSION)
  .map((item) => ({ unicode: item.unicode, label: item.label, ...(item.tags?.length ? { tags: item.tags } : {}), group: item.group }));

const out = new URL("../src/lib/emoji-data.json", import.meta.url);
writeFileSync(out, JSON.stringify({ groups: messages.groups.map((group) => ({ key: group.key })), emojis }) + "\n");
console.log(`wrote ${emojis.length} emoji`);
