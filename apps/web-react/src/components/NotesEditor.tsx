import { Extension, type Editor, type Range } from "@tiptap/core";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Markdown } from "@tiptap/markdown";
import { Placeholder } from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from "@tiptap/suggestion";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading1, Heading2, Italic, List, ListChecks, ListOrdered, X, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";

import { useKeyboardInset, useMediaQuery, useVisibleViewport } from "@/hooks/useViewport";

/** What "/" offers: a few blocks, no more. `keywords` are the other names a person might type for it. */
type Command = { label: string; keywords: string; icon: LucideIcon; run: (chain: ReturnType<Editor["chain"]>) => void };

const COMMANDS: Command[] = [
  { label: "Title", keywords: "h1 heading title", icon: Heading1, run: (c) => void c.setNode("heading", { level: 1 }).run() },
  { label: "Heading", keywords: "h2 heading subtitle", icon: Heading2, run: (c) => void c.setNode("heading", { level: 2 }).run() },
  { label: "To-do list", keywords: "todo task checkbox check", icon: ListChecks, run: (c) => void c.toggleTaskList().run() },
  { label: "Numbered list", keywords: "number ordered ol", icon: ListOrdered, run: (c) => void c.toggleOrderedList().run() },
  { label: "Bulleted list", keywords: "bullet unordered ul", icon: List, run: (c) => void c.toggleBulletList().run() },
];

const matching = (query: string) => {
  const q = query.trim().toLowerCase();
  return q ? COMMANDS.filter((item) => `${item.label} ${item.keywords}`.toLowerCase().includes(q)) : COMMANDS;
};

/**
 * An open list of commands. `typed` means it came from typing "/" (it follows the caret and the arrow keys);
 * otherwise it was opened from the "/" button. `docked` lists them inside the box, above the toolbar, rather than
 * floating at the caret: on a phone the keyboard covers a floating list, so the docked one is always in reach.
 */
type Menu = { items: Command[]; command: (item: Command) => void; rect: DOMRect | null; typed: boolean; docked: boolean };

/** A finger, not a mouse. */
const TOUCH_QUERY = "(hover: none) and (pointer: coarse)";
const isTouch = () => window.matchMedia(TOUCH_QUERY).matches;

/** The toolbar buttons: the blocks (the same ones "/" offers), then bold and italic. `active` names what `isActive` checks. */
type Tool = {
  label: string;
  /** What the phone's toolbar prints under the icon. */
  short: string;
  shortcut?: string;
  icon: LucideIcon;
  active: [string, Record<string, unknown>?];
  run: (editor: Editor) => void;
};

const BLOCK_TOOLS: Tool[] = [
  { label: "Title", short: "Title", icon: Heading1, active: ["heading", { level: 1 }], run: (e) => void e.chain().focus().toggleHeading({ level: 1 }).run() },
  { label: "Heading", short: "Heading", icon: Heading2, active: ["heading", { level: 2 }], run: (e) => void e.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: "To-do list", short: "To-do", icon: ListChecks, active: ["taskList"], run: (e) => void e.chain().focus().toggleTaskList().run() },
  { label: "Bulleted list", short: "Bullets", icon: List, active: ["bulletList"], run: (e) => void e.chain().focus().toggleBulletList().run() },
  { label: "Numbered list", short: "Numbers", icon: ListOrdered, active: ["orderedList"], run: (e) => void e.chain().focus().toggleOrderedList().run() },
];

const MARK_TOOLS: Tool[] = [
  { label: "Bold", short: "Bold", shortcut: "Ctrl+B", icon: Bold, active: ["bold"], run: (e) => void e.chain().focus().toggleBold().run() },
  { label: "Italic", short: "Italic", shortcut: "Ctrl+I", icon: Italic, active: ["italic"], run: (e) => void e.chain().focus().toggleItalic().run() },
];

const ALL_TOOLS = [...BLOCK_TOOLS, ...MARK_TOOLS];

/** Keeps the focus (and so the selection and the on-screen keyboard) in the text while a button is pressed. */
const keepFocus = (event: { preventDefault: () => void }) => event.preventDefault();

/**
 * The note field of a block: plain text that turns into a Notion-style page when asked. Type "/" for a
 * title, a to-do list or a numbered list (typing `- `, `1. `, `[ ] ` or `## ` works too). It is stored as
 * markdown, so a note stays readable text everywhere else.
 *
 * With a mouse, the box grows with its text (then scrolls) and a small toolbar under it offers the same blocks
 * plus bold and italic. On a phone a box that small is a poor place to write: the keyboard covers half of it
 * and a "/" takes a hunt through the symbols. There the field is a preview, and a tap opens a full-screen page
 * that ends where the keyboard starts, with every block one tap away in a bar right above the keys.
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
  // The menu's keys are read by the editor, which was made once: it looks at these, not at render's values.
  const menuRef = useRef<Menu | null>(null);
  const selectedRef = useRef(0);
  /** The last markdown the editor produced, so only a change from outside (an activity's notes) is loaded. */
  const lastValue = useRef(value);
  const emit = useRef(onChange);
  useEffect(() => {
    menuRef.current = menu;
    selectedRef.current = selected;
    emit.current = onChange;
  });

  const hint = touch ? touchPlaceholder : placeholder;

  const extensions = useMemo(() => {
    const slash = Extension.create({
      name: "slashCommands",
      addProseMirrorPlugins() {
        return [
          Suggestion<Command>({
            editor: this.editor,
            char: "/",
            allowSpaces: false,
            items: ({ query }) => matching(query),
            command: ({ editor, range, props }: { editor: Editor; range: Range; props: Command }) =>
              props.run(editor.chain().focus().deleteRange(range)),
            render: () => {
              const show = (props: SuggestionProps<Command>) => {
                setSelected(0);
                setMenu({
                  items: props.items,
                  command: props.command,
                  rect: props.clientRect?.() ?? null,
                  typed: true,
                  docked: isTouch(),
                });
              };
              return {
                onStart: show,
                onUpdate: show,
                onExit: () => setMenu(null),
                onKeyDown: ({ event }: SuggestionKeyDownProps) => {
                  const current = menuRef.current;
                  if (!current) return false;
                  const count = current.items.length;
                  if (event.key === "Escape") {
                    // Closes the menu, not the dialog behind it.
                    event.stopPropagation();
                    setMenu(null);
                    return true;
                  }
                  if (!count) return false;
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    const step = event.key === "ArrowDown" ? 1 : -1;
                    setSelected((selectedRef.current + step + count) % count);
                    return true;
                  }
                  if (event.key === "Enter" || event.key === "Tab") {
                    current.command(current.items[selectedRef.current] ?? current.items[0]);
                    return true;
                  }
                  return false;
                },
              };
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
      Placeholder.configure({ placeholder: hint }),
      Markdown,
      slash,
    ];
  }, [hint]);

  const editor = useEditor({
    extensions,
    content: value,
    contentType: "markdown",
    immediatelyRender: false,
    editorProps: {
      // 16px on a phone: anything smaller makes iOS zoom the page when the text is tapped.
      attributes: {
        class: "notes-editor min-h-full px-3.5 py-3 text-base leading-relaxed outline-none sm:text-sm touch:text-base",
        "aria-label": "Notes",
      },
    },
    onUpdate: ({ editor: current }) => {
      const markdown = current.getMarkdown();
      lastValue.current = markdown;
      emit.current(markdown);
    },
  });

  // Which tools are on where the cursor is. Read through the editor's own state, so only these re-render.
  const activeTools = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      ALL_TOOLS.map((tool) => (current ? current.isActive(tool.active[0], tool.active[1]) : false)),
  });
  const isOn = (tool: Tool) => activeTools?.[ALL_TOOLS.indexOf(tool)] ?? false;

  // The note as the phone's preview shows it (empty when there is nothing written). The editor makes the HTML
  // from its own document, so only its own blocks and escaped text ever get in.
  const html = useEditorState({
    editor,
    selector: ({ editor: current }) => (current && !current.isEmpty ? current.getHTML() : ""),
  });

  /** The "/" button: opens the commands docked above the toolbar, or closes them. Each one runs at the caret. */
  const toggleCommands = () => {
    if (menu) {
      setMenu(null);
      return;
    }
    if (!editor) return;
    setSelected(0);
    setMenu({
      items: COMMANDS,
      command: (item) => {
        setMenu(null);
        item.run(editor.chain().focus());
      },
      rect: null,
      typed: false,
      docked: true,
    });
  };

  /**
   * Opens the full-screen page, with the keyboard up, and applies `tool` first when the tap was on one. The page
   * is rendered right away (not at the end of the event), so the focus still counts as the tap's own: a phone
   * only raises the keyboard for that.
   */
  const startWriting = (tool?: Tool) => {
    if (!editor) return;
    flushSync(() => setWriting(true));
    if (tool) tool.run(editor);
    else editor.commands.focus("end");
  };

  const stopWriting = () => {
    editor?.commands.blur();
    setMenu(null);
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
        <NotesPreview html={html ?? ""} placeholder={hint} disabled={!editor} onOpen={startWriting} />
        {writing && editor ? (
          <WritingPage
            editor={editor}
            context={context}
            menu={menu}
            isOn={isOn}
            onCloseMenu={() => setMenu(null)}
            onDone={stopWriting}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      {/* A sheet of paper: the text grows the box up to a point, then scrolls; the toolbar stays under it. */}
      <div
        className="mt-1.5 overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-[border-color,box-shadow] duration-150 hover:border-input focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/15 dark:bg-muted/40"
        onKeyDown={(event) => {
          // Escape closes an open command list, not the dialog behind it.
          if (event.key !== "Escape" || !menuRef.current) return;
          event.stopPropagation();
          setMenu(null);
        }}
      >
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

        {menu?.docked ? (
          <CommandPanel menu={menu} selected={menu.typed ? selected : -1} onHover={setSelected} onClose={() => setMenu(null)} />
        ) : null}

        <div
          role="toolbar"
          aria-label="Formatting"
          className="flex items-center gap-0.5 border-t border-border/70 bg-muted/40 px-1.5 py-1 dark:bg-transparent"
        >
          <button
            type="button"
            aria-label="Insert a block"
            aria-expanded={menu !== null}
            title="Insert a block (/)"
            disabled={!editor}
            className="flex h-7 min-w-7 cursor-pointer items-center justify-center rounded-md px-1.5 font-mono text-sm font-semibold text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground aria-expanded:bg-foreground/[0.09] aria-expanded:text-foreground disabled:opacity-40"
            onMouseDown={keepFocus}
            onClick={toggleCommands}
          >
            /
          </button>
          <span aria-hidden="true" className="mx-1 h-4 w-px bg-border" />
          {[MARK_TOOLS, BLOCK_TOOLS].map((group, groupIndex) => (
            <div key={groupIndex} className="flex items-center gap-0.5">
              {groupIndex > 0 ? <span aria-hidden="true" className="mx-1 h-4 w-px bg-border" /> : null}
              {group.map((tool) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.label}
                    type="button"
                    aria-label={tool.label}
                    aria-pressed={isOn(tool)}
                    title={tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label}
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
          <span className="ml-auto hidden pr-1.5 text-xs text-muted-foreground/80 sm:inline">
            Type <kbd className="kbd mx-0.5 h-[18px] min-w-[18px] px-1">/</kbd> for more
          </span>
        </div>
      </div>
      {menu && !menu.docked ? <SlashMenu menu={menu} selected={selected} onHover={setSelected} /> : null}
    </>
  );
}

/**
 * The phone's field: the note as it will read (or a prompt), and a tap anywhere on it opens the full-screen
 * page. While there is nothing written, the blocks are offered right under the prompt, so a to-do list or a
 * title is one tap from the form, with the page opened on it.
 */
function NotesPreview({
  html,
  placeholder,
  disabled,
  onOpen,
}: {
  html: string;
  placeholder: string;
  disabled: boolean;
  onOpen: (tool?: Tool) => void;
}) {
  return (
    <div className="mt-1.5 overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/15 active:border-ring dark:bg-muted/40">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        className="block max-h-44 min-h-[6.5rem] cursor-text overflow-hidden px-3.5 pb-6 pt-3 text-base leading-relaxed outline-none [mask-image:linear-gradient(to_bottom,black_calc(100%_-_1.5rem),transparent)]"
        onClick={() => onOpen()}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          onOpen();
        }}
      >
        {html ? (
          // A tick in the preview is not a tap on the box: the checkboxes only show.
          <div className="notes-editor [&_input]:pointer-events-none" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <p className="text-muted-foreground/70">{placeholder}</p>
        )}
      </div>

      {!html ? (
        <div className="flex gap-1.5 overflow-x-auto px-2.5 pb-2.5 [scrollbar-width:none]">
          {BLOCK_TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.label}
                type="button"
                disabled={disabled}
                className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-background px-3 text-[13px] font-medium text-foreground transition-colors active:bg-accent disabled:opacity-40"
                onClick={() => onOpen(tool)}
              >
                <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                {tool.short}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The phone's note page: the whole visible screen, from the top to where the keyboard starts (see
 * `useVisibleViewport`), so the text always has room and the bar below it is never under the keys. The bar
 * has every block one tap away; typing "/" swaps it for the blocks that match.
 */
function WritingPage({
  editor,
  context,
  menu,
  isOn,
  onCloseMenu,
  onDone,
}: {
  editor: Editor;
  context?: string;
  menu: Menu | null;
  isOn: (tool: Tool) => boolean;
  onCloseMenu: () => void;
  onDone: () => void;
}) {
  const viewport = useVisibleViewport();
  // The home indicator's padding belongs under the bar only while the keyboard is down (it covers the indicator).
  const keyboardUp = useKeyboardInset() > 80;

  // The keyboard opening or closing moves where the text ends: keep the caret in view.
  useEffect(() => {
    editor.commands.scrollIntoView();
  }, [editor, viewport.height]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Notes"
      style={viewport.height ? { top: viewport.top, height: viewport.height } : { top: 0, height: "100dvh" }}
      className="fixed inset-x-0 z-[75] flex flex-col bg-background text-foreground animate-in fade-in-0 duration-150"
      onKeyDown={(event) => {
        // Escape leaves the page, not the dialog behind it. (An open command list handles its own Escape.)
        if (event.key !== "Escape") return;
        event.stopPropagation();
        onDone();
      }}
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-border/70 pb-2 pl-4 pr-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold leading-tight tracking-[-0.01em]">Notes</h2>
          {context ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{context}</p> : null}
        </div>
        <button type="button" className="btn btn-primary btn-md h-10 px-5" onClick={onDone}>
          Done
        </button>
      </header>

      <div
        className="min-h-0 flex-1 cursor-text overflow-y-auto overscroll-contain scroll-pb-4"
        onClick={(event) => {
          if (event.target === event.currentTarget) editor.commands.focus("end");
        }}
      >
        {/* Fills the page, so a tap on the empty part below the text lands in the text */}
        <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-0.5 py-1">
          <EditorContent editor={editor} className="flex flex-1 flex-col [&>.ProseMirror]:flex-1" />
        </div>
      </div>

      {/* A press must not take the focus from the text, or the keyboard would drop with every tap. */}
      <div
        className={[
          "shrink-0 border-t border-border/70 bg-muted/60 dark:bg-card",
          keyboardUp ? "" : "pb-[env(safe-area-inset-bottom)]",
        ].join(" ")}
        onMouseDown={keepFocus}
      >
        {menu ? <CommandStrip menu={menu} onClose={onCloseMenu} /> : <FormatBar editor={editor} isOn={isOn} />}
      </div>
    </div>,
    document.body,
  );
}

/** Every block, bold and italic as one row of big targets with their names, so none needs a "/" to be found. */
function FormatBar({ editor, isOn }: { editor: Editor; isOn: (tool: Tool) => boolean }) {
  return (
    <div role="toolbar" aria-label="Formatting" className="grid grid-cols-7">
      {ALL_TOOLS.map((tool) => {
        const Icon = tool.icon;
        return (
          <button
            key={tool.label}
            type="button"
            aria-label={tool.label}
            aria-pressed={isOn(tool)}
            className="flex h-14 cursor-pointer flex-col items-center justify-center gap-1 text-[10.5px] font-medium leading-none text-muted-foreground transition-colors active:bg-foreground/[0.08] aria-pressed:bg-foreground/[0.09] aria-pressed:text-foreground"
            onClick={() => tool.run(editor)}
          >
            <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            {tool.short}
          </button>
        );
      })}
    </div>
  );
}

/** The blocks that match what was typed after "/", as one row of chips in the bar's place (so the page keeps its height). */
function CommandStrip({ menu, onClose }: { menu: Menu; onClose: () => void }) {
  const { items, command } = menu;
  return (
    <div className="flex items-center gap-1.5 px-2 py-2">
      <button
        type="button"
        aria-label="Close"
        className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-foreground/[0.08]"
        onClick={onClose}
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
      {items.length ? (
        <div role="listbox" aria-label="Insert a block" className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none]">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                role="option"
                aria-selected={false}
                className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-border bg-background px-3.5 text-sm font-medium text-foreground transition-colors active:bg-accent"
                onClick={() => command(item)}
              >
                <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">No block matches. Keep typing, or close this.</p>
      )}
    </div>
  );
}

/** The commands as big tap targets, docked in the box above the toolbar (the "/" button on a desktop). */
function CommandPanel({
  menu,
  selected,
  onHover,
  onClose,
}: {
  menu: Menu;
  selected: number;
  onHover: (index: number) => void;
  onClose: () => void;
}) {
  const { items, command } = menu;
  const panel = useRef<HTMLDivElement | null>(null);
  // Opened from the toolbar at the bottom of a long dialog: bring the list into view, so it does not open off-screen.
  useEffect(() => {
    panel.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);
  return (
    // A press must not take the focus from the editor, so the keyboard stays up and the caret stays put.
    <div ref={panel} className="border-t border-border/70 p-1.5 dark:bg-transparent" onMouseDown={keepFocus}>
      <div className="flex items-center justify-between pl-2 pr-0.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Insert a block</span>
        <button
          type="button"
          aria-label="Close"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
          onClick={onClose}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {items.length ? (
        <div role="listbox" aria-label="Insert" className="grid grid-cols-2 gap-1">
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                role="option"
                aria-selected={index === selected}
                className="flex h-11 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-left text-sm text-foreground transition-colors hover:bg-accent aria-selected:bg-accent"
                onMouseMove={() => onHover(index)}
                onClick={() => command(item)}
              >
                <Icon className="h-4.5 w-4.5 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="px-2 py-2.5 text-[13px] text-muted-foreground">No block matches. Keep typing, or close this.</p>
      )}
    </div>
  );
}

function SlashMenu({ menu, selected, onHover }: { menu: Menu; selected: number; onHover: (index: number) => void }) {
  const { items, rect, command } = menu;
  if (!rect || !items.length) return null;

  // Under the line being typed, or above it when the window ends first.
  const height = items.length * 32 + 8;
  const below = rect.bottom + 6 + height <= window.innerHeight;
  const style = {
    left: Math.min(rect.left, window.innerWidth - 200 - 8),
    top: below ? rect.bottom + 6 : rect.top - 6 - height,
  };

  return createPortal(
    // A mouse press must not take the focus from the editor, or the "/" would end before the click lands.
    <div
      role="listbox"
      aria-label="Insert"
      style={style}
      className="menu fixed z-[70] w-52 animate-in fade-in-0 zoom-in-95 duration-100"
      onMouseDown={keepFocus}
    >
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            type="button"
            role="option"
            aria-selected={index === selected}
            className="flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] aria-selected:bg-accent"
            onMouseMove={() => onHover(index)}
            onClick={() => command(item)}
          >
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
            {item.label}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
