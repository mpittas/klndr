import { Extension, type Editor, type Range } from "@tiptap/core";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Markdown } from "@tiptap/markdown";
import { Placeholder } from "@tiptap/extension-placeholder";
import type { Node as DocNode } from "@tiptap/pm/model";
import { PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import Suggestion, { exitSuggestion, type SuggestionProps } from "@tiptap/suggestion";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  ChevronDown,
  Heading1,
  Heading2,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  PenLine,
  Plus,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { createPortal, flushSync } from "react-dom";

import { useKeyboardInset, useMediaQuery, useVisibleViewport } from "@/hooks/useViewport";
import { summarizeNote, type NoteSummary } from "@/lib/notes";

type Chain = ReturnType<Editor["chain"]>;

/** A block "/" (or the + button) offers. `keywords` are the other names a person might type for it. */
type Command = {
  label: string;
  keywords: string;
  /** The markdown that makes the same block as it is typed, shown beside it so it can be learnt. */
  hint: string;
  icon: LucideIcon;
  run: (chain: Chain) => void;
};

// The to-do list first: in a day planner, a note is most often a list of things to get done.
const COMMANDS: Command[] = [
  { label: "To-do list", keywords: "todo task checkbox checklist check", hint: "[]", icon: ListChecks, run: (c) => void c.toggleTaskList().run() },
  { label: "Bulleted list", keywords: "bullet unordered ul list", hint: "-", icon: List, run: (c) => void c.toggleBulletList().run() },
  { label: "Numbered list", keywords: "number ordered ol list", hint: "1.", icon: ListOrdered, run: (c) => void c.toggleOrderedList().run() },
  { label: "Title", keywords: "h1 heading big", hint: "#", icon: Heading1, run: (c) => void c.setNode("heading", { level: 1 }).run() },
  { label: "Heading", keywords: "h2 subtitle subheading", hint: "##", icon: Heading2, run: (c) => void c.setNode("heading", { level: 2 }).run() },
  { label: "Divider", keywords: "line rule separator hr", hint: "---", icon: Minus, run: (c) => void c.setHorizontalRule().run() },
];

/** The blocks that match what was typed after "/": names that start with it first, then any other mention. */
const matching = (query: string) => {
  const q = query.trim().toLowerCase();
  if (!q) return COMMANDS;
  const rank = (item: Command) => {
    const label = item.label.toLowerCase();
    if (label.startsWith(q)) return 0;
    if (label.split(/[\s-]/).some((word) => word.startsWith(q))) return 1;
    if (item.keywords.split(" ").some((word) => word.startsWith(q))) return 2;
    // Inside a name, not inside a keyword: "to" should not find "separator".
    return label.includes(q) ? 3 : -1;
  };
  return COMMANDS.map((item) => ({ item, score: rank(item) }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => a.score - b.score)
    .map(({ item }) => item);
};

/**
 * An open list of blocks. `typed` means it came from typing "/" (it filters as the query grows, and picking one
 * replaces the "/query"); otherwise it was opened with the + button and a pick lands at the caret.
 */
type Menu = {
  items: Command[];
  command: (item: Command) => void;
  /** What follows the "/", when typed. */
  query: string;
  /** Where the floating list hangs from: the "/" or the caret. Read live, so the list follows a scroll. */
  anchor: () => DOMRect | null;
  typed: boolean;
};

/** The "/" suggestion's own key, so the list can be closed (and stay closed) from outside the plugin. */
const SLASH = new PluginKey("notesSlash");

/** A finger, not a mouse. */
const TOUCH_QUERY = "(hover: none) and (pointer: coarse)";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? "⌘" : "Ctrl+";

/** A toolbar button. `active` names what `isActive` checks. */
type Tool = {
  label: string;
  shortcut: string;
  icon: LucideIcon;
  active: [string, Record<string, unknown>?];
  run: (editor: Editor) => void;
};

const MARK_TOOLS: Tool[] = [
  { label: "Bold", shortcut: `${mod}B`, icon: Bold, active: ["bold"], run: (e) => void e.chain().focus().toggleBold().run() },
  { label: "Italic", shortcut: `${mod}I`, icon: Italic, active: ["italic"], run: (e) => void e.chain().focus().toggleItalic().run() },
];

const LIST_TOOLS: Tool[] = [
  { label: "To-do list", shortcut: `${mod}Shift+9`, icon: ListChecks, active: ["taskList"], run: (e) => void e.chain().focus().toggleTaskList().run() },
  { label: "Bulleted list", shortcut: `${mod}Shift+8`, icon: List, active: ["bulletList"], run: (e) => void e.chain().focus().toggleBulletList().run() },
  { label: "Numbered list", shortcut: `${mod}Shift+7`, icon: ListOrdered, active: ["orderedList"], run: (e) => void e.chain().focus().toggleOrderedList().run() },
];

const HEADING_TOOLS: Tool[] = [
  { label: "Title", shortcut: `${mod}Alt+1`, icon: Heading1, active: ["heading", { level: 1 }], run: (e) => void e.chain().focus().toggleHeading({ level: 1 }).run() },
  { label: "Heading", shortcut: `${mod}Alt+2`, icon: Heading2, active: ["heading", { level: 2 }], run: (e) => void e.chain().focus().toggleHeading({ level: 2 }).run() },
];

const ALL_TOOLS = [...MARK_TOOLS, ...LIST_TOOLS, ...HEADING_TOOLS];
/** The phone's bar: lists first (what a planner's note mostly is), then headings, then bold and italic. */
const PHONE_TOOLS = [...LIST_TOOLS, ...HEADING_TOOLS, ...MARK_TOOLS];

/** Keeps the focus (and so the selection and the on-screen keyboard) in the text while a button is pressed. */
const keepFocus = (event: { preventDefault: () => void }) => event.preventDefault();

/** The caret's box on screen, for a list opened with the + button. */
const caretRect = (editor: Editor): DOMRect | null => {
  try {
    const box = editor.view.coordsAtPos(editor.state.selection.from);
    return new DOMRect(box.left, box.top, 0, box.bottom - box.top);
  } catch {
    return null;
  }
};

/**
 * How far into the note's text a point is: the characters before it, counted over every text node in order. The
 * phone's preview and the editor hold the same text nodes in the same order (the preview is the editor's own
 * HTML), so this finds the same spot in the editor.
 */
function textOffsetAt(root: HTMLElement, x: number, y: number): number | null {
  const lookup = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => globalThis.Range | null;
  };
  let node: Node | null = null;
  let offset = 0;
  if (lookup.caretPositionFromPoint) {
    const found = lookup.caretPositionFromPoint(x, y);
    node = found?.offsetNode ?? null;
    offset = found?.offset ?? 0;
  } else if (lookup.caretRangeFromPoint) {
    const found = lookup.caretRangeFromPoint(x, y);
    node = found?.startContainer ?? null;
    offset = found?.startOffset ?? 0;
  }
  if (!node || node.nodeType !== Node.TEXT_NODE || !root.contains(node)) return null;
  let before = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let current = walker.nextNode(); current; current = walker.nextNode()) {
    if (current === node) return before + offset;
    before += current.textContent?.length ?? 0;
  }
  return null;
}

/** The document position `offset` characters into the note's text (see `textOffsetAt`). */
function positionAtTextOffset(doc: DocNode, offset: number): number | null {
  let seen = 0;
  let found: number | null = null;
  doc.descendants((node, pos) => {
    if (found !== null) return false;
    if (!node.isText) return true;
    const length = node.text?.length ?? 0;
    if (offset <= seen + length) found = pos + (offset - seen);
    else seen += length;
    return false;
  });
  return found;
}

/** Each document's HTML, made once: React reads the preview's HTML on every render. */
const htmlByDoc = new WeakMap<DocNode, string>();

/**
 * The note as the phone's preview shows it (empty when there is nothing written). The editor makes the HTML from
 * its own document, so only its own blocks and escaped text ever get in.
 *
 * Read straight from the editor, not through `useEditorState`: that only looks again after a transaction, and an
 * editor that was never put on screen (the phone's, until its page opens) has had none, so a block's existing
 * note showed as empty.
 */
function useNoteHtml(editor: Editor | null): string {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!editor) return () => undefined;
      editor.on("transaction", onChange);
      return () => {
        editor.off("transaction", onChange);
      };
    },
    [editor],
  );
  return useSyncExternalStore(
    subscribe,
    () => {
      if (!editor || editor.isDestroyed) return "";
      const doc = editor.state.doc;
      let html = htmlByDoc.get(doc);
      if (html === undefined) {
        html = editor.isEmpty ? "" : editor.getHTML();
        htmlByDoc.set(doc, html);
      }
      return html;
    },
    () => "",
  );
}

/**
 * The note field of a block: plain text that turns into a small Notion-style page when asked. Type "/" (or press
 * +) for a to-do list, a list, a title or a divider; typing `[] `, `- `, `1. ` or `# ` works too. It is stored
 * as markdown, so a note stays readable text everywhere else.
 *
 * With a mouse, the box grows with its text (then scrolls), "/" opens a list at the caret that the arrow keys
 * walk, and a toolbar under the box has the same blocks plus bold and italic.
 *
 * On a phone a box inside a sheet is a poor place to write: the keyboard covers half of it. There the field shows
 * the note as it reads (its to-dos can be ticked right there), and a tap opens a full-screen page at the line that
 * was tapped. The page ends where the keyboard starts, with a slim bar of blocks right above the keys, like Apple
 * Notes or Notion; + (or "/") lays the blocks out between the text and the bar.
 */
export function NotesEditor({
  value,
  onChange,
  placeholder,
  touchPlaceholder = placeholder,
  context,
}: {
  value: string;
  onChange: (markdown: string) => void;
  /** What the empty box says with a mouse. */
  placeholder: string;
  /** What the empty field says on a phone, where there is no "/" key to point at. */
  touchPlaceholder?: string;
  /** Under "Notes" in the phone's full-screen page: what the note belongs to, such as the block's name. */
  context?: string;
}) {
  const touch = useMediaQuery(TOUCH_QUERY);
  /** The phone's full-screen page is open. */
  const [writing, setWriting] = useState(false);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [selected, setSelected] = useState(0);
  // The editor was made once and reads these, not render's values. They are set together with the state.
  const menuRef = useRef<Menu | null>(null);
  const selectedRef = useRef(0);
  /** The last markdown the editor produced, so only a change from outside (an activity's notes) is loaded. */
  const lastValue = useRef(value);
  const emit = useRef(onChange);
  useEffect(() => {
    emit.current = onChange;
  });

  const showMenu = (next: Menu | null) => {
    menuRef.current = next;
    setMenu(next);
  };
  const select = (index: number) => {
    selectedRef.current = index;
    setSelected(index);
  };
  /** Closes the list. One opened by "/" is told to stay closed, so the next letter does not bring it back. */
  const dismissMenu = (view: EditorView | undefined) => {
    const current = menuRef.current;
    if (!current) return;
    showMenu(null);
    if (current.typed && view) exitSuggestion(view, SLASH);
  };

  // On the phone's page the + is right under the text, so the empty page only needs a nudge.
  const editorHint = touch ? "Start writing…" : placeholder;

  const extensions = useMemo(() => {
    const slash = Extension.create({
      name: "slashCommands",
      addProseMirrorPlugins() {
        return [
          Suggestion<Command, Command>({
            editor: this.editor,
            pluginKey: SLASH,
            char: "/",
            allowSpaces: false,
            decorationClass: "slash-query",
            items: ({ query }) => matching(query),
            command: ({ editor, range, props }: { editor: Editor; range: Range; props: Command }) =>
              props.run(editor.chain().focus().deleteRange(range)),
            render: () => {
              const show = (props: SuggestionProps<Command, Command>) => {
                select(0);
                showMenu({
                  items: props.items,
                  command: props.command,
                  query: props.query,
                  anchor: () => props.clientRect?.() ?? null,
                  typed: true,
                });
              };
              return { onStart: show, onUpdate: show, onExit: () => showMenu(null) };
            },
          }),
        ];
      },
    });

    return [
      StarterKit.configure({
        heading: { levels: [1, 2] },
        blockquote: false,
        code: false,
        codeBlock: false,
        strike: false,
        link: false,
        underline: false,
      }),
      TaskList,
      TaskItem,
      Placeholder.configure({ placeholder: editorHint }),
      Markdown,
      slash,
    ];
  }, [editorHint]);

  const editor = useEditor({
    extensions,
    content: value,
    contentType: "markdown",
    immediatelyRender: false,
    editorProps: {
      // 16px on a phone (and everything in it relative to that, see styles.css): iOS Safari zooms the page into
      // a field whose text is smaller than that.
      attributes: {
        class: "notes-editor min-h-full px-3.5 py-3 text-base leading-relaxed outline-none sm:text-sm touch:text-base",
        "aria-label": "Notes",
      },
      // Keeps the caret clear of the page's edges (and of the bar above the keyboard) as it moves.
      scrollThreshold: 32,
      scrollMargin: 32,
      // Runs before the editor's own keys, so while a list is open Enter picks from it rather than splitting a line.
      handleKeyDown: (view, event) => {
        const current = menuRef.current;
        if (!current) return false;
        if (event.key === "Escape") {
          // Closes the list, not the dialog (or the page) behind it.
          event.stopPropagation();
          dismissMenu(view);
          return true;
        }
        const count = current.items.length;
        if (!count) return false;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          const step = event.key === "ArrowDown" ? 1 : -1;
          select((Math.max(-1, selectedRef.current) + step + count) % count);
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          current.command(current.items[selectedRef.current] ?? current.items[0]);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: current }) => {
      const markdown = current.getMarkdown();
      lastValue.current = markdown;
      emit.current(markdown);
    },
    // A click elsewhere (or the phone's "hide keyboard") puts the list away too.
    onBlur: ({ editor: current }) => dismissMenu(current.view),
  });

  // A list opened with + is for the spot where the caret is: typing instead puts it away.
  useEffect(() => {
    if (!editor) return;
    const onTransaction = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      if (transaction.docChanged && menuRef.current && !menuRef.current.typed) showMenu(null);
    };
    editor.on("transaction", onTransaction);
    return () => {
      editor.off("transaction", onTransaction);
    };
  }, [editor]);

  // Which tools are on where the caret is, and whether the text has the focus. Read through the editor's own
  // state, so only these re-render.
  const toolState = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      active: ALL_TOOLS.map((tool) => (current ? current.isActive(tool.active[0], tool.active[1]) : false)),
      focused: current?.isFocused ?? false,
    }),
  });
  const isOn = (tool: Tool) => toolState?.active[ALL_TOOLS.indexOf(tool)] ?? false;

  const html = useNoteHtml(editor);

  /** The + button: the blocks, to put one at the caret (or closes them). */
  const toggleBlocks = () => {
    if (!editor) return;
    if (menuRef.current) {
      dismissMenu(editor.view);
      return;
    }
    if (!editor.isFocused) editor.commands.focus();
    // With a mouse the first one is ready for Enter; on a phone nothing is picked until it is tapped.
    select(touch ? -1 : 0);
    showMenu({
      items: COMMANDS,
      query: "",
      typed: false,
      anchor: () => caretRect(editor),
      command: (item) => {
        showMenu(null);
        item.run(editor.chain().focus());
      },
    });
  };

  /** Ticks (or unticks) the `index`th to-do of the note, from the phone's preview. */
  const toggleTodo = (index: number) => {
    if (!editor) return;
    // The preview's to-dos are the editor's own, in the same order.
    const todos: { pos: number; node: DocNode }[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "taskItem") todos.push({ pos, node });
      return todos.length <= index;
    });
    const todo = todos[index];
    if (!todo) return;
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(todo.pos, undefined, { ...todo.node.attrs, checked: !todo.node.attrs.checked }),
    );
  };

  /**
   * Opens the full-screen page with the keyboard up, the caret where the preview was tapped (or at the end). The
   * page is rendered right away, not at the end of the event, so the focus still counts as the tap's own: a phone
   * only raises the keyboard for that.
   */
  const startWriting = (offset: number | null) => {
    if (!editor) return;
    flushSync(() => setWriting(true));
    const pos = offset === null ? null : positionAtTextOffset(editor.state.doc, offset);
    editor.commands.focus(pos ?? "end");
  };

  const stopWriting = () => {
    if (editor) {
      dismissMenu(editor.view);
      editor.commands.blur();
    }
    setWriting(false);
  };

  // A change that did not come from typing here, like an activity filling in its notes.
  useEffect(() => {
    if (!editor || value === lastValue.current) return;
    lastValue.current = value;
    editor.commands.setContent(value, { contentType: "markdown", emitUpdate: false });
  }, [editor, value]);

  if (touch) {
    return (
      <>
        <NotesPreview
          html={html}
          summary={summarizeNote(value)}
          placeholder={touchPlaceholder}
          disabled={!editor}
          onOpen={startWriting}
          onToggleTodo={toggleTodo}
        />
        {writing && editor ? (
          <WritingPage
            editor={editor}
            context={context}
            menu={menu}
            selected={selected}
            focused={toolState?.focused ?? false}
            isOn={isOn}
            onBlocks={toggleBlocks}
            onCloseMenu={() => dismissMenu(editor.view)}
            onDone={stopWriting}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      {/* A sheet of paper: the text grows the box up to a point, then scrolls; the toolbar stays under it. */}
      <div className="mt-1.5 overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-[border-color,box-shadow] duration-150 hover:border-input focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/15 dark:bg-muted/40">
        <div
          className="flex min-h-[7.5rem] max-h-[min(50dvh,22rem)] cursor-text flex-col overflow-y-auto overscroll-contain"
          onClickCapture={(event) => {
            // Ctrl/Cmd+click anywhere on a to-do row ticks it, so the row is as easy to hit as the box.
            if (!(event.ctrlKey || event.metaKey) || !(event.target instanceof Element)) return;
            const row = event.target.closest('ul[data-type="taskList"] > li');
            if (!row || event.target.closest("label")) return;
            event.preventDefault();
            event.stopPropagation();
            row.querySelector<HTMLInputElement>("label input")?.click();
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) editor?.commands.focus("end");
          }}
        >
          {/* Fills the box, so a click anywhere in it lands in the text */}
          <EditorContent editor={editor} className="flex flex-1 flex-col [&>.ProseMirror]:flex-1" />
        </div>

        <div
          role="toolbar"
          aria-label="Formatting"
          className="flex items-center gap-0.5 border-t border-border/70 bg-muted/40 px-1.5 py-1 dark:bg-transparent"
        >
          <button
            type="button"
            aria-label="Insert a block"
            aria-expanded={menu !== null && !menu.typed}
            title="Insert a block (/)"
            disabled={!editor}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground aria-expanded:bg-foreground/[0.09] aria-expanded:text-foreground disabled:opacity-40"
            onMouseDown={keepFocus}
            onClick={toggleBlocks}
          >
            <Plus className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
          </button>
          {[MARK_TOOLS, LIST_TOOLS, HEADING_TOOLS].map((group, groupIndex) => (
            <div key={groupIndex} className="flex items-center gap-0.5">
              <span aria-hidden="true" className="mx-1 h-4 w-px bg-border" />
              {group.map((tool) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.label}
                    type="button"
                    aria-label={tool.label}
                    aria-pressed={isOn(tool)}
                    title={`${tool.label} (${tool.shortcut})`}
                    disabled={!editor}
                    className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground aria-pressed:bg-foreground/[0.09] aria-pressed:text-foreground disabled:opacity-40"
                    // Keeps the focus (and the selection) in the text while the button is pressed.
                    onMouseDown={keepFocus}
                    onClick={() => editor && tool.run(editor)}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          ))}
          <span className="ml-auto hidden whitespace-nowrap pr-1.5 text-xs text-muted-foreground/80 md:inline">
            Type <kbd className="kbd mx-0.5 h-[18px] min-w-[18px] px-1">/</kbd> for blocks
          </span>
        </div>
      </div>
      {menu ? <SlashMenu menu={menu} selected={selected} onHover={select} /> : null}
    </>
  );
}

/**
 * The phone's field: the note as it reads (or a prompt). A tap opens the full-screen page with the caret on the
 * tapped line; a tap on a to-do's box ticks it right here, without opening anything. A long note is cut with a
 * fade, and a slim footer says how far its to-dos are and that it can be edited.
 */
function NotesPreview({
  html,
  summary,
  placeholder,
  disabled,
  onOpen,
  onToggleTodo,
}: {
  html: string;
  summary: NoteSummary | null;
  placeholder: string;
  disabled: boolean;
  onOpen: (offset: number | null) => void;
  onToggleTodo: (index: number) => void;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  const content = useRef<HTMLDivElement | null>(null);
  /** The note is longer than the field shows. */
  const [clipped, setClipped] = useState(false);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    // Fires once on observing too, so the first measure needs no call of its own.
    const observer = new ResizeObserver(() => setClipped(element.scrollHeight > element.clientHeight + 1));
    observer.observe(element);
    if (content.current) observer.observe(content.current);
    return () => observer.disconnect();
  }, [html]);

  const todosLeft = summary && summary.total ? summary.total - summary.done : 0;

  return (
    <div className="mt-1.5 overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-colors has-[[role=button]:active]:border-ring/60 dark:bg-muted/40">
      <div
        ref={box}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={html ? "Edit notes" : "Add notes"}
        aria-disabled={disabled}
        className={[
          "block max-h-64 cursor-text overflow-hidden px-3.5 py-3 text-base leading-relaxed outline-none focus-visible:bg-accent/40",
          html ? "min-h-[3.25rem]" : "min-h-[5.25rem]",
          clipped ? "[mask-image:linear-gradient(to_bottom,black_calc(100%_-_3rem),transparent)]" : "",
        ].join(" ")}
        onClick={(event) => {
          if (disabled) return;
          const target = event.target instanceof Element ? event.target : null;
          // A tap on a to-do's box ticks it in place.
          const todo = target?.closest('li[data-type="taskItem"]');
          if (todo && target?.closest("label") && content.current) {
            event.preventDefault();
            const index = [...content.current.querySelectorAll('li[data-type="taskItem"]')].indexOf(todo);
            if (index >= 0) onToggleTodo(index);
            return;
          }
          onOpen(content.current ? textOffsetAt(content.current, event.clientX, event.clientY) : null);
        }}
        onKeyDown={(event) => {
          if (disabled || (event.key !== "Enter" && event.key !== " ")) return;
          event.preventDefault();
          onOpen(null);
        }}
      >
        {html ? (
          <div ref={content} className="notes-editor" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <p className="text-muted-foreground/70">{placeholder}</p>
        )}
      </div>

      {html ? (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          disabled={disabled}
          className="flex h-9 w-full cursor-pointer items-center gap-2 border-t border-border/60 px-3.5 text-[13px] text-muted-foreground transition-colors active:bg-foreground/[0.04]"
          onClick={() => onOpen(null)}
        >
          {summary && summary.total ? (
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
              {todosLeft ? `${summary.done} of ${summary.total} done` : "All done"}
            </span>
          ) : clipped ? (
            <span>Show all</span>
          ) : null}
          <span className="ml-auto inline-flex items-center gap-1.5 font-medium text-foreground/75">
            <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
            Edit
          </span>
        </button>
      ) : null}
    </div>
  );
}

/**
 * The phone's note page: the whole visible screen, from the top to where the keyboard starts (see
 * `useVisibleViewport`), so the text always has room and the bar below it is never under the keys. The bar is
 * one slim row (like Apple Notes or Notion): + for every block, the lists and headings, bold and italic, and a
 * key to put the keyboard away. + or "/" lays the blocks out between the text and the bar.
 */
function WritingPage({
  editor,
  context,
  menu,
  selected,
  focused,
  isOn,
  onBlocks,
  onCloseMenu,
  onDone,
}: {
  editor: Editor;
  context?: string;
  menu: Menu | null;
  selected: number;
  focused: boolean;
  isOn: (tool: Tool) => boolean;
  onBlocks: () => void;
  onCloseMenu: () => void;
  onDone: () => void;
}) {
  const viewport = useVisibleViewport();
  // The home indicator's padding belongs under the bar only while the keyboard is down (it covers the indicator).
  const keyboardUp = useKeyboardInset() > 80;
  const menuOpen = menu !== null;

  // The keyboard (or the blocks) opening or closing moves where the text ends: keep the caret in view.
  useEffect(() => {
    if (editor.isFocused) editor.commands.scrollIntoView();
  }, [editor, viewport.height, menuOpen]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Notes"
      style={viewport.height ? { top: viewport.top, height: viewport.height } : { top: 0, height: "100dvh" }}
      className="fixed inset-x-0 z-[75] flex flex-col bg-background text-foreground animate-in fade-in-0 slide-in-from-bottom-3 duration-200 motion-reduce:animate-none"
      onKeyDown={(event) => {
        // Escape leaves the page, not the dialog behind it. (An open list of blocks handles its own Escape.)
        if (event.key !== "Escape") return;
        event.stopPropagation();
        onDone();
      }}
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-border/60 pb-2.5 pl-4 pr-3 pt-[max(0.625rem,env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold leading-tight tracking-[-0.01em]">Notes</h2>
          {context ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{context}</p> : null}
        </div>
        <button type="button" className="btn btn-primary btn-md h-9 rounded-full px-4" onClick={onDone}>
          Done
        </button>
      </header>

      <div
        className="min-h-0 flex-1 cursor-text overflow-y-auto overscroll-contain"
        onClick={(event) => {
          if (event.target === event.currentTarget) editor.commands.focus("end");
        }}
      >
        {/* Fills the page, so a tap on the empty part below the text lands in the text */}
        <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-1.5 pb-4">
          <EditorContent editor={editor} className="flex flex-1 flex-col [&>.ProseMirror]:flex-1" />
        </div>
      </div>

      {menu ? <BlockPanel menu={menu} selected={menu.typed ? selected : -1} onClose={onCloseMenu} /> : null}

      {/* A press must not take the focus from the text, or the keyboard would drop with every tap. */}
      <div
        className={[
          "shrink-0 border-t border-border/70 bg-background",
          keyboardUp ? "" : "pb-[env(safe-area-inset-bottom)]",
        ].join(" ")}
        onMouseDown={keepFocus}
      >
        <div role="toolbar" aria-label="Formatting" className="flex h-12 items-center gap-1 px-1.5">
          <button
            type="button"
            aria-label="Insert a block"
            aria-expanded={menuOpen}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-foreground/[0.07] text-foreground transition-colors active:bg-foreground/[0.12] aria-expanded:bg-primary aria-expanded:text-primary-foreground"
            onClick={onBlocks}
          >
            <Plus
              className={["h-5 w-5 transition-transform duration-150", menuOpen ? "rotate-45" : ""].join(" ")}
              strokeWidth={2.25}
              aria-hidden="true"
            />
          </button>
          <span aria-hidden="true" className="mx-0.5 h-5 w-px shrink-0 bg-border" />
          <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {PHONE_TOOLS.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.label}
                  type="button"
                  aria-label={tool.label}
                  aria-pressed={isOn(tool)}
                  className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors active:bg-foreground/[0.08] aria-pressed:bg-foreground/[0.09] aria-pressed:text-foreground"
                  onClick={() => tool.run(editor)}
                >
                  <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                </button>
              );
            })}
          </div>
          {focused ? (
            <button
              type="button"
              aria-label="Hide keyboard"
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors active:bg-foreground/[0.08]"
              onClick={() => editor.commands.blur()}
            >
              <ChevronDown className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * The phone's blocks, between the text and the bar: two columns of big targets. Opened by "/", they narrow as
 * the query grows and the first is the one Enter picks; opened by +, a tap puts one at the caret.
 */
function BlockPanel({ menu, selected, onClose }: { menu: Menu; selected: number; onClose: () => void }) {
  const { items, command, query, typed } = menu;
  return (
    // A press must not take the focus from the text, so the keyboard stays up and the caret stays put.
    <div
      className="max-h-[45%] shrink-0 overflow-y-auto overscroll-contain border-t border-border/70 bg-muted/50 px-2 pb-2 animate-in fade-in-0 slide-in-from-bottom-1 duration-150 motion-reduce:animate-none dark:bg-card"
      onMouseDown={keepFocus}
    >
      <div className="flex h-9 items-center justify-between gap-2 pl-1.5">
        <p className="min-w-0 truncate text-xs font-medium text-muted-foreground">
          {typed && query ? (
            <>
              Blocks matching <span className="font-semibold text-foreground">“{query}”</span>
            </>
          ) : (
            "Insert a block"
          )}
        </p>
        <button
          type="button"
          aria-label="Close"
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-foreground/[0.08]"
          onClick={onClose}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {items.length ? (
        <div role="listbox" aria-label="Blocks" className="grid grid-cols-2 gap-1.5">
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                role="option"
                aria-selected={index === selected}
                className="flex h-12 min-w-0 cursor-pointer items-center gap-2.5 rounded-xl border border-border/70 bg-background px-2.5 text-left text-[15px] font-medium text-foreground shadow-xs transition-colors active:bg-accent aria-selected:border-ring/50 aria-selected:bg-accent"
                onClick={() => command(item)}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="px-1.5 pb-2 text-sm text-muted-foreground">No block matches. Keep typing, or close this.</p>
      )}
    </div>
  );
}

/**
 * The desktop's list of blocks, hung under the "/" (or the caret, when opened with +), or above it when the window
 * ends first. It follows the text when the dialog scrolls; the arrow keys walk it and Enter picks.
 */
function SlashMenu({ menu, selected, onHover }: { menu: Menu; selected: number; onHover: (index: number) => void }) {
  const { items, anchor, command, typed } = menu;
  const list = useRef<HTMLDivElement | null>(null);
  const [, redraw] = useReducer((count: number) => count + 1, 0);

  useEffect(() => {
    window.addEventListener("scroll", redraw, true);
    window.addEventListener("resize", redraw);
    return () => {
      window.removeEventListener("scroll", redraw, true);
      window.removeEventListener("resize", redraw);
    };
  }, []);

  // The picked row stays in view as the arrow keys walk a list that scrolls.
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const rect = anchor();
  if (!rect) return null;

  const width = 240;
  const height = Math.min(Math.max(items.length, 1), 6) * 36 + 36;
  const below = rect.bottom + 6 + height <= window.innerHeight - 8;
  const style = {
    width,
    left: Math.max(8, Math.min(rect.left - 8, window.innerWidth - width - 8)),
    top: below ? rect.bottom + 6 : Math.max(8, rect.top - 6 - height),
  };

  return createPortal(
    // A mouse press must not take the focus from the editor, or the "/" would end before the click lands.
    <div
      ref={list}
      role="listbox"
      aria-label="Blocks"
      style={style}
      className="menu fixed z-[70] max-h-[16.5rem] overflow-y-auto overscroll-contain animate-in fade-in-0 zoom-in-95 duration-100"
      onMouseDown={keepFocus}
    >
      <p className="menu-label">{typed ? "Blocks" : "Insert a block"}</p>
      {items.length ? (
        items.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              role="option"
              aria-selected={index === selected}
              className="flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-1.5 text-left text-[13px] text-foreground aria-selected:bg-accent"
              onMouseMove={() => onHover(index)}
              onClick={() => command(item)}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground">
                <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <span className="shrink-0 pr-1 font-mono text-[11px] text-muted-foreground/80">{item.hint}</span>
            </button>
          );
        })
      ) : (
        <p className="px-2.5 pb-2 pt-0.5 text-[13px] text-muted-foreground">No block matches</p>
      )}
    </div>,
    document.body,
  );
}
