/** What a block's note holds, as far as the timeline's small mark is concerned. */
export type NoteSummary = {
  /** To-dos ticked off in the note. */
  done: number;
  /** To-dos in the note (0 when it is only text). */
  total: number;
};

/** A to-do line of the note's markdown: `- [ ] buy milk` or `- [x] buy milk`, at any depth. */
const TODO = /^\s*[-*+]\s+\[( |x|X)\]/;

/** What a note holds: `null` when there is nothing written, else its to-dos (if any). */
export function summarizeNote(markdown: string | null | undefined): NoteSummary | null {
  if (!markdown?.trim()) return null;
  let done = 0;
  let total = 0;
  for (const line of markdown.split("\n")) {
    const match = TODO.exec(line);
    if (!match) continue;
    total += 1;
    if (match[1] !== " ") done += 1;
  }
  return { done, total };
}
