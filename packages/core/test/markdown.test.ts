import { describe, expect, it } from "vitest";
import { listItemDepth, parseMarkdown, renderMarkdown, renderMarkdownHtml, toggleTaskLine } from "../src/index";
import { markdownCases, toggleTaskLineCases } from "./fixtures/markdown-cases";

describe("HTML parity", () => {
  // `markdownCases` was generated from the implementation that used to live in apps/web/lib/markdown.ts.
  it.each(markdownCases)("$name", ({ source, html }) => {
    expect(renderMarkdown(source)).toBe(html);
  });

  it.each(markdownCases)("$name (through the block AST)", ({ source, html }) => {
    expect(renderMarkdownHtml(parseMarkdown(source))).toBe(html);
  });
});

describe("toggleTaskLine parity", () => {
  it.each(toggleTaskLineCases)("$name", ({ source, line, output }) => {
    expect(toggleTaskLine(source, line)).toBe(output);
  });
});

describe("the block AST", () => {
  it("splits paragraphs on blank lines", () => {
    expect(parseMarkdown("a\nb\n\nc")).toEqual([
      { type: "paragraph", lines: ["a", "b"] },
      { type: "paragraph", lines: ["c"] },
    ]);
  });

  it("reads a heading's level and text", () => {
    expect(parseMarkdown("### Three")).toEqual([{ type: "heading", level: 3, text: "Three" }]);
  });

  it("keeps a fenced block whole, blank lines and all", () => {
    expect(parseMarkdown("```js\nlet x;\n\nlet y;\n```")).toEqual([{ type: "code", code: "let x;\n\nlet y;" }]);
    expect(parseMarkdown("```\nunclosed")).toEqual([{ type: "code", code: "unclosed" }]);
  });

  it("reports a rule", () => {
    expect(parseMarkdown("---\n\ntext")).toEqual([{ type: "rule" }, { type: "paragraph", lines: ["text"] }]);
  });

  it("groups the lines of a quote", () => {
    expect(parseMarkdown("> a\n> b\n\nafter")).toEqual([
      { type: "quote", lines: ["a", "b"] },
      { type: "paragraph", lines: ["after"] },
    ]);
  });

  it("takes the marker and the checkbox off a list item, and remembers its source line", () => {
    expect(parseMarkdown("- a\n- [ ] b\n- [x] c")).toEqual([
      {
        type: "list",
        ordered: false,
        items: [
          { indent: "", task: false, checked: false, line: 0, text: "a" },
          { indent: "", task: true, checked: false, line: 1, text: "b" },
          { indent: "", task: true, checked: true, line: 2, text: "c" },
        ],
      },
    ]);
  });

  it("keeps a list item's indentation for the renderer to nest", () => {
    const blocks = parseMarkdown("  - nested");
    expect(blocks).toHaveLength(1);
    const items = blocks[0].type === "list" ? blocks[0].items : [];
    expect(items).toEqual([{ indent: "  ", task: false, checked: false, line: 0, text: "nested" }]);
  });

  it("tells an ordered list from an unordered one, and breaks the list when the kind changes", () => {
    const kinds = (source: string) =>
      parseMarkdown(source).map((block) => (block.type === "list" ? `list:${block.ordered}` : block.type));
    expect(kinds("2. a")).toEqual(["list:true"]);
    expect(kinds("- a\n1. b")).toEqual(["list:false", "list:true"]);
  });

  it("marks a task item checked for x and X only", () => {
    const blocks = parseMarkdown("- [ ] a\n- [X] b\n- [  ] c");
    expect(blocks).toHaveLength(1);
    const items = blocks[0].type === "list" ? blocks[0].items : [];
    expect(items.map((item) => [item.task, item.checked, item.text])).toEqual([
      [true, false, "a"],
      [true, true, "b"],
      [false, false, "[  ] c"], // two spaces is not a checkbox
    ]);
  });
});

describe("listItemDepth", () => {
  it("counts two spaces, or a tab, as one level, up to three", () => {
    expect(listItemDepth("")).toBe(0);
    expect(listItemDepth("  ")).toBe(1);
    expect(listItemDepth("\t")).toBe(1);
    expect(listItemDepth("    ")).toBe(2);
    expect(listItemDepth("      ")).toBe(3);
    expect(listItemDepth("            ")).toBe(3);
  });
});

describe("safety", () => {
  it("escapes source HTML", () => {
    const html = renderMarkdown('<img src=x onerror="alert(1)">');
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
    expect(html).toContain("&quot;alert(1)&quot;");
  });

  it("never links a scheme other than http(s) or mailto", () => {
    const html = renderMarkdown("[click](javascript:alert(1))");
    expect(html).not.toContain("href=");
    expect(html).toContain("(javascript:alert(1))"); // stays visible as plain text
    expect(renderMarkdown("[x](HTTPS://example.com)")).not.toContain("href="); // schemes are case-sensitive
    expect(renderMarkdown("[x](https://example.com)")).toContain('href="https://example.com"');
    expect(renderMarkdown("[x](mailto:me@example.com)")).toContain('href="mailto:me@example.com"');
  });

  it("opens links without handing the referrer over", () => {
    expect(renderMarkdown("[x](https://example.com)")).toContain('target="_blank" rel="noopener noreferrer"');
  });
});
