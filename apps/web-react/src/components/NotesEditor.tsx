import { Extension, type Editor, type Range } from "@tiptap/core";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Markdown } from "@tiptap/markdown";
import { Placeholder } from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from "@tiptap/suggestion";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading1, Heading2, Italic, List, ListChecks, ListOrdered, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

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

type Menu = { items: Command[]; command: (item: Command) => void; rect: DOMRect | null };

/** The toolbar under the text: two inline styles, then the blocks. `active` names what `isActive` checks. */
type Tool = { label: string; shortcut?: string; icon: LucideIcon; active: [string, Record<string, unknown>?]; run: (editor: Editor) => void };

const TOOLS: Tool[][] = [
  [
    { label: "Bold", shortcut: "Ctrl+B", icon: Bold, active: ["bold"], run: (e) => void e.chain().focus().toggleBold().run() },
    { label: "Italic", shortcut: "Ctrl+I", icon: Italic, active: ["italic"], run: (e) => void e.chain().focus().toggleItalic().run() },
  ],
  [
    { label: "Heading", icon: Heading2, active: ["heading", { level: 2 }], run: (e) => void e.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: "Bulleted list", icon: List, active: ["bulletList"], run: (e) => void e.chain().focus().toggleBulletList().run() },
    { label: "Numbered list", icon: ListOrdered, active: ["orderedList"], run: (e) => void e.chain().focus().toggleOrderedList().run() },
    { label: "To-do list", icon: ListChecks, active: ["taskList"], run: (e) => void e.chain().focus().toggleTaskList().run() },
  ],
];

/**
 * The note field of a block: plain text that turns into a Notion-style page when asked. Type "/" for a
 * title, a to-do list or a numbered list (typing `- `, `1. `, `[ ] ` or `## ` works too). It is stored as
 * markdown, so a note stays readable text everywhere else. The box grows with its text (then scrolls), and a
 * small toolbar under it offers the same blocks plus bold and italic, for those who would rather click.
 */
export function NotesEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (markdown: string) => void;
  placeholder: string;
}) {
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
                setMenu({ items: props.items, command: props.command, rect: props.clientRect?.() ?? null });
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
      Placeholder.configure({ placeholder }),
      Markdown,
      slash,
    ];
  }, [placeholder]);

  const editor = useEditor({
    extensions,
    content: value,
    contentType: "markdown",
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "notes-editor min-h-full px-3.5 py-3 text-sm leading-relaxed outline-none", "aria-label": "Notes" },
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
      TOOLS.flat().map((tool) => (current ? current.isActive(tool.active[0], tool.active[1]) : false)),
  });

  // A change that did not come from typing here, like an activity filling in its notes.
  useEffect(() => {
    if (!editor || value === lastValue.current) return;
    lastValue.current = value;
    editor.commands.setContent(value, { contentType: "markdown", emitUpdate: false });
  }, [editor, value]);

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
        {TOOLS.map((group, groupIndex) => (
          <div key={groupIndex} className="flex items-center gap-0.5">
            {groupIndex > 0 ? <span aria-hidden="true" className="mx-1 h-4 w-px bg-border" /> : null}
            {group.map((tool) => {
              const index = TOOLS.flat().indexOf(tool);
              const on = activeTools?.[index] ?? false;
              const Icon = tool.icon;
              return (
                <button
                  key={tool.label}
                  type="button"
                  aria-label={tool.label}
                  aria-pressed={on}
                  title={tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label}
                  disabled={!editor}
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground aria-pressed:bg-foreground/[0.09] aria-pressed:text-foreground disabled:opacity-40 touch:h-9 touch:w-9"
                  // Keeps the focus (and the selection) in the text while the button is pressed.
                  onMouseDown={(event) => event.preventDefault()}
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
      {menu ? (
        <SlashMenu menu={menu} selected={selected} onHover={setSelected} />
      ) : null}
    </>
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
      onMouseDown={(event) => event.preventDefault()}
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
