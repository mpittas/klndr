/**
 * A small, dependency-free markdown parser and HTML renderer for quick notes.
 * `parseMarkdown` gives a block-level AST, `renderMarkdownHtml` turns that AST into HTML (which the
 * web app puts out with `v-html`), and `renderMarkdown` does both in one step.
 * All source text is HTML-escaped before any markup is added, and links are limited to http(s) and
 * mailto, so the output is safe to render.
 */

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * The inline markup of one line of text, as HTML. The passes run in this order over the whole line
 * (code spans are stashed away first, so nothing inside them is touched), which is why this is a
 * string transform and not part of the AST: emphasis is allowed to span a code span or a link.
 */
export function renderInlineHtml(raw: string): string {
  const codes: string[] = [];
  let text = escapeHtml(raw).replace(/`([^`]+)`/g, (_, code: string) => {
    codes.push(`<code>${code}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });

  const link = (label: string, url: string) =>
    `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;

  text = text
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)/g, (_, label: string, url: string) => link(label, url))
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (_, lead: string, url: string) => `${lead}${link(url, url)}`)
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_, a: string, b: string) => `<strong>${a ?? b}</strong>`)
    .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\*)/g, (_, lead: string, body: string) => `${lead}<em>${body}</em>`)
    .replace(/(^|[^_\w])_([^_\s][^_]*?)_(?![_\w])/g, (_, lead: string, body: string) => `${lead}<em>${body}</em>`)
    .replace(/~~([^~]+)~~/g, "<del>$1</del>");

  return text.replace(/\u0000(\d+)\u0000/g, (_, index: string) => codes[Number(index)]);
}

/** One item of a list block; `line` is its index in the source, which a checkbox is tagged with. */
export type MarkdownListItem = {
  /** The raw indentation before the marker; `listItemDepth` turns it into a nesting level. */
  indent: string;
  /** Whether the item starts with a `[ ]` / `[x]` checkbox. */
  task: boolean;
  checked: boolean;
  line: number;
  text: string;
};

export type MarkdownBlock =
  | { type: "paragraph"; lines: string[] }
  | { type: "heading"; level: number; text: string }
  | { type: "rule" }
  | { type: "quote"; lines: string[] }
  | { type: "code"; code: string }
  | { type: "list"; ordered: boolean; items: MarkdownListItem[] };

const HEADING = /^(#{1,6})\s+(.*)$/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const TASK = /^\[([ xX])\]\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;
const FENCE = /^\s*```/;

/** Nesting level of a list item: every two spaces (a tab counts as two) is one level, up to three. */
export function listItemDepth(indent: string): number {
  return Math.min(3, Math.floor(indent.replace(/\t/g, "  ").length / 2));
}

/** The source as blocks. Blank lines separate paragraphs; a fence, quote or list eats the lines it covers. */
export function parseMarkdown(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", lines: paragraph });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (FENCE.test(line)) {
      flushParagraph();
      const code: string[] = [];
      for (i++; i < lines.length && !FENCE.test(lines[i]); i++) code.push(lines[i]);
      blocks.push({ type: "code", code: code.join("\n") });
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flushParagraph();
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
      continue;
    }

    if (RULE.test(line)) {
      flushParagraph();
      blocks.push({ type: "rule" });
      continue;
    }

    if (QUOTE.test(line)) {
      flushParagraph();
      const quoted: string[] = [];
      for (; i < lines.length && QUOTE.test(lines[i]); i++) quoted.push(QUOTE.exec(lines[i])![1]);
      i--;
      blocks.push({ type: "quote", lines: quoted });
      continue;
    }

    if (LIST_ITEM.test(line)) {
      flushParagraph();
      const ordered = /\d/.test(LIST_ITEM.exec(line)![2]);
      const items: MarkdownListItem[] = [];
      const sameKind = (l: string) => LIST_ITEM.test(l) && /\d/.test(LIST_ITEM.exec(l)![2]) === ordered;
      for (; i < lines.length && sameKind(lines[i]); i++) {
        const [, indent, , content] = LIST_ITEM.exec(lines[i])!;
        const task = TASK.exec(content);
        items.push({
          indent,
          task: task !== null,
          checked: task !== null && task[1] !== " ",
          line: i,
          text: task ? task[2] : content,
        });
      }
      i--;
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  return blocks;
}

function renderListItem(item: MarkdownListItem): string {
  const depth = listItemDepth(item.indent);
  const style = depth ? ` style="margin-left:${depth * 1.25}rem"` : "";
  if (!item.task) return `<li${style}>${renderInlineHtml(item.text)}</li>`;
  const done = item.checked ? " done" : "";
  const checked = item.checked ? " checked" : "";
  return `<li class="task${done}"${style}><input type="checkbox" data-line="${item.line}"${checked}><span>${renderInlineHtml(item.text)}</span></li>`;
}

/** Blocks as HTML. A checkbox carries `data-line`, so a click can be mapped back to the source line. */
export function renderMarkdownHtml(blocks: MarkdownBlock[]): string {
  const html: string[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case "paragraph":
        html.push(`<p>${block.lines.map(renderInlineHtml).join("<br>")}</p>`);
        break;
      case "heading":
        html.push(`<h${block.level}>${renderInlineHtml(block.text)}</h${block.level}>`);
        break;
      case "rule":
        html.push("<hr>");
        break;
      case "quote":
        html.push(`<blockquote>${block.lines.map(renderInlineHtml).join("<br>")}</blockquote>`);
        break;
      case "code":
        html.push(`<pre><code>${escapeHtml(block.code)}</code></pre>`);
        break;
      case "list": {
        const tag = block.ordered ? "ol" : "ul";
        html.push(`<${tag}>${block.items.map(renderListItem).join("")}</${tag}>`);
        break;
      }
    }
  }
  return html.join("");
}

/** The whole document as HTML: `renderMarkdown(source) === renderMarkdownHtml(parseMarkdown(source))`. */
export function renderMarkdown(source: string): string {
  return renderMarkdownHtml(parseMarkdown(source));
}

/** Flip the `[ ]` / `[x]` checkbox on one source line; returns the source unchanged if there isn't one. */
export function toggleTaskLine(source: string, lineIndex: number): string {
  const lines = source.split("\n");
  const line = lines[lineIndex];
  if (line === undefined) return source;
  lines[lineIndex] = line.replace(/\[([ xX])\]/, (_, mark: string) => (mark === " " ? "[x]" : "[ ]"));
  return lines.join("\n");
}
