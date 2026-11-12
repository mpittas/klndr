import "@blocknote/shadcn/style.css";

import {
  BlockNoteEditor,
  BlockNoteSchema,
  createHeadingBlockSpec,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  defaultStyleSpecs,
  filterSuggestionItems,
  type PartialBlock,
} from "@blocknote/core";
import { SuggestionMenu } from "@blocknote/core/extensions";
import {
  BasicTextStyleButton,
  BlockTypeSelect,
  CreateLinkButton,
  DragHandleMenu,
  FormattingToolbar,
  FormattingToolbarController,
  NestBlockButton,
  RemoveBlockItem,
  SideMenu,
  SideMenuController,
  SuggestionMenuController,
  UnnestBlockButton,
  getDefaultReactSlashMenuItems,
  useBlockNoteEditor,
  useComponentsContext,
  useCreateBlockNote,
  type DefaultReactSuggestionItem,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { formatTime, renderMarkdown, toggleTaskLine } from "@klndr/core";
import { CalendarDays, CalendarPlus, Clock, ListChecks, PenLine, Plus, Redo2, Sunset, Target, Undo2, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal, flushSync } from "react-dom";

import { useMediaQuery, useVisibleViewport } from "@/hooks/useViewport";
import { summarizeNote, type NoteSummary } from "@/lib/notes";
import { THEME_OPTIONS, useTheme } from "@/theme";

/**
 * What a note can hold: only what markdown can say, because a note is stored as markdown and the phone app reads it
 * that way. So BlockNote's colours, underline, alignment, tables, toggles and media are left out of the schema:
 * they would be lost on saving. Everything else (its "/" menu, toolbar, link editing, nesting, drag handle) is
 * BlockNote's own.
 */
const schema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph: defaultBlockSpecs.paragraph,
    heading: createHeadingBlockSpec({ levels: [1, 2, 3], allowToggleHeadings: false }),
    quote: defaultBlockSpecs.quote,
    bulletListItem: defaultBlockSpecs.bulletListItem,
    numberedListItem: defaultBlockSpecs.numberedListItem,
    checkListItem: defaultBlockSpecs.checkListItem,
    codeBlock: defaultBlockSpecs.codeBlock,
    divider: defaultBlockSpecs.divider,
  },
  inlineContentSpecs: defaultInlineContentSpecs,
  styleSpecs: {
    bold: defaultStyleSpecs.bold,
    italic: defaultStyleSpecs.italic,
    strike: defaultStyleSpecs.strike,
    code: defaultStyleSpecs.code,
  },
});

type NotesBlockEditor = BlockNoteEditor<typeof schema.blockSchema, typeof schema.inlineContentSchema, typeof schema.styleSchema>;
type NoteBlock = PartialBlock<typeof schema.blockSchema, typeof schema.inlineContentSchema, typeof schema.styleSchema>;

/** A headless editor of the same schema, only to turn a note's markdown into blocks before its editor is made. */
let parser: NotesBlockEditor | null = null;
const toBlocks = (markdown: string): NoteBlock[] | undefined => {
  if (!markdown.trim()) return undefined;
  parser ??= BlockNoteEditor.create({ schema });
  const blocks = parser.tryParseMarkdownToBlocks(markdown);
  return blocks.length ? blocks : undefined;
};

/** A finger, not a mouse. */
const TOUCH_QUERY = "(hover: none) and (pointer: coarse)";

/** A day as a note writes it: "Wed, Nov 11" (today, or `daysAhead` later). */
const dateText = (daysAhead = 0) => {
  const day = new Date();
  day.setDate(day.getDate() + daysAhead);
  return day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};

/** The time now, as the planner writes times everywhere: "10:34 PM". */
const timeText = () => {
  const now = new Date();
  return formatTime(now.getHours() * 60 + now.getMinutes());
};

const heading = (text: string): NoteBlock => ({ type: "heading", props: { level: 2 }, content: text });
const todo = (): NoteBlock => ({ type: "checkListItem" });
const bullet = (): NoteBlock => ({ type: "bulletListItem" });
const isEmptyBlock = (block: { content?: unknown }) => Array.isArray(block.content) && block.content.length === 0;

/** Puts a ready-made set of blocks where "/" was typed, with the caret on its first empty line. */
function insertTemplate(editor: NotesBlockEditor, blocks: NoteBlock[]) {
  const current = editor.getTextCursorPosition().block;
  const inserted = isEmptyBlock(current)
    ? editor.replaceBlocks([current], blocks).insertedBlocks
    : editor.insertBlocks(blocks, current, "after");
  const first = inserted.find((block) => block.type !== "heading" && isEmptyBlock(block));
  if (first) editor.setTextCursorPosition(first, "end");
}

/** The planner's own "/" items, after BlockNote's: the date and the time as text, and a few ready-made notes. */
const plannerItems = (editor: NotesBlockEditor): DefaultReactSuggestionItem[] => [
  {
    title: "Today's date",
    subtext: dateText(),
    aliases: ["today", "date", "day"],
    group: "Planner",
    icon: <CalendarDays size={18} />,
    onItemClick: () => editor.insertInlineContent(`${dateText()} `),
  },
  {
    title: "Tomorrow's date",
    subtext: dateText(1),
    aliases: ["tomorrow", "date", "next"],
    group: "Planner",
    icon: <CalendarPlus size={18} />,
    onItemClick: () => editor.insertInlineContent(`${dateText(1)} `),
  },
  {
    title: "Current time",
    subtext: timeText(),
    aliases: ["now", "time", "clock", "timestamp"],
    group: "Planner",
    icon: <Clock size={18} />,
    onItemClick: () => editor.insertInlineContent(`${timeText()} `),
  },
  {
    title: "Top 3 priorities",
    subtext: "A heading and three to-dos",
    aliases: ["top", "three", "priorities", "focus", "goals"],
    group: "Templates",
    icon: <Target size={18} />,
    onItemClick: () => insertTemplate(editor, [heading("Top 3"), todo(), todo(), todo()]),
  },
  {
    title: "Meeting notes",
    subtext: "Agenda, notes and action items",
    aliases: ["meeting", "agenda", "action", "call", "sync"],
    group: "Templates",
    icon: <Users size={18} />,
    onItemClick: () =>
      insertTemplate(editor, [heading("Agenda"), bullet(), heading("Notes"), { type: "paragraph" }, heading("Action items"), todo()]),
  },
  {
    title: "Day review",
    subtext: "What went well, what to improve, tomorrow",
    aliases: ["review", "reflection", "evening", "wins", "retro"],
    group: "Templates",
    icon: <Sunset size={18} />,
    onItemClick: () =>
      insertTemplate(editor, [heading("Went well"), bullet(), heading("To improve"), bullet(), heading("For tomorrow"), todo()]),
  },
];

/** BlockNote's formatting toolbar with only what markdown keeps: no colours, underline or alignment. */
function NotesToolbar() {
  return (
    <FormattingToolbar>
      <BlockTypeSelect key="blockTypeSelect" />
      <BasicTextStyleButton basicTextStyle="bold" key="bold" />
      <BasicTextStyleButton basicTextStyle="italic" key="italic" />
      <BasicTextStyleButton basicTextStyle="strike" key="strike" />
      <BasicTextStyleButton basicTextStyle="code" key="code" />
      <CreateLinkButton key="link" />
      <NestBlockButton key="nest" />
      <UnnestBlockButton key="unnest" />
    </FormattingToolbar>
  );
}

/** On a phone there is no side menu to hover, so the toolbar above the keyboard starts with + for the "/" menu. */
function InsertBlockButton() {
  const Components = useComponentsContext();
  const editor = useBlockNoteEditor();
  if (!Components) return null;
  return (
    <Components.FormattingToolbar.Button
      mainTooltip="Insert a block"
      label="Insert a block"
      icon={<Plus size={18} />}
      onClick={() => editor.getExtension(SuggestionMenu)?.openSuggestionMenu("/")}
    />
  );
}

function PhoneToolbar() {
  return (
    <FormattingToolbar>
      <InsertBlockButton key="insert" />
      <BlockTypeSelect key="blockTypeSelect" />
      <BasicTextStyleButton basicTextStyle="bold" key="bold" />
      <BasicTextStyleButton basicTextStyle="italic" key="italic" />
      <BasicTextStyleButton basicTextStyle="strike" key="strike" />
      <CreateLinkButton key="link" />
      <NestBlockButton key="nest" />
      <UnnestBlockButton key="unnest" />
    </FormattingToolbar>
  );
}

/** The drag handle's menu without "Colors", which markdown cannot keep. */
function NotesDragHandleMenu() {
  return (
    <DragHandleMenu>
      <RemoveBlockItem>Delete</RemoveBlockItem>
    </DragHandleMenu>
  );
}

/**
 * A note (a block's, or with `fill` the day's memo), written in BlockNote: a Notion-style editor with a "/" menu,
 * a toolbar on selected text (with link editing), a + and drag handle beside each line, and Tab / Shift+Tab to
 * nest. It is stored as markdown, so a note stays readable text everywhere else (and in the phone app).
 *
 * On a phone a box inside a sheet is a poor place to write: the keyboard covers half of it. There the field shows
 * the note as it reads (its to-dos can be ticked right there), and a tap opens a full-screen page, where BlockNote
 * puts its toolbar right above the keyboard.
 */
export function NotesEditor({
  value,
  onChange,
  placeholder,
  touchPlaceholder = placeholder,
  label = "Notes",
  context,
  fill = false,
  status,
  onBlur,
}: {
  value: string;
  onChange: (markdown: string) => void;
  /** What the empty box says with a mouse. */
  placeholder: string;
  /** What the empty field says on a phone, where there is no "/" key to point at. */
  touchPlaceholder?: string;
  /** What the note is called: the phone's full-screen page is titled with it, and screen readers read it. */
  label?: string;
  /** Under the `label` in the phone's full-screen page: what the note belongs to, such as the block's name. */
  context?: string;
  /** Takes the whole of its (flex column) container, like the day's memo, instead of a box in a form. */
  fill?: boolean;
  /** Shown small in the bottom corner of the text, such as whether the note is saved. */
  status?: ReactNode;
  /** The text lost the focus (or the phone's page was closed). */
  onBlur?: () => void;
}) {
  const touch = useMediaQuery(TOUCH_QUERY);
  const { theme } = useTheme();
  const scheme = THEME_OPTIONS.find((option) => option.name === theme)?.scheme ?? "light";
  /** The phone's full-screen page is open. */
  const [writing, setWriting] = useState(false);

  /** The last markdown the editor produced (or was given), so only a change from outside is loaded. */
  const lastValue = useRef(value);
  /** Loading a change from outside: not an edit, so it is not sent back. */
  const loading = useRef(false);
  const emit = useRef(onChange);
  useEffect(() => {
    emit.current = onChange;
  });

  const [initialContent] = useState(() => toBlocks(value));
  const editor = useCreateBlockNote({
    schema,
    initialContent,
    placeholders: { emptyDocument: touch ? "Start writing…" : placeholder, default: "Type / for blocks" },
  });

  // A change that did not come from typing here, like an activity filling in its notes or a to-do ticked in the
  // phone's preview.
  useEffect(() => {
    if (value === lastValue.current) return;
    lastValue.current = value;
    loading.current = true;
    try {
      editor.replaceBlocks(editor.document, toBlocks(value) ?? [{ type: "paragraph" }]);
    } finally {
      loading.current = false;
    }
  }, [editor, value]);

  const save = () => {
    if (loading.current) return;
    // BlockNote writes an empty to-do at the very end as "* [ ]", which its own reader then takes for a bullet
    // saying "[ ]": the space after the box keeps it a to-do.
    const markdown = editor.blocksToMarkdownLossy().replace(/^(\s*[-*+] \[[ xX]\])$/gm, "$1 ");
    if (markdown === lastValue.current) return;
    lastValue.current = markdown;
    emit.current(markdown);
  };

  const view = (
    <BlockNoteView
      editor={editor}
      theme={scheme}
      aria-label={label}
      className="notes-blocknote"
      slashMenu={false}
      formattingToolbar={false}
      sideMenu={false}
      // In <body>, so a menu is never cut off by the scrolling box (or the dialog) the note sits in.
      portalElements={{ default: document.body }}
      onChange={save}
    >
      <SuggestionMenuController
        triggerCharacter="/"
        getItems={async (query) =>
          filterSuggestionItems([...getDefaultReactSlashMenuItems(editor), ...plannerItems(editor)], query)
        }
      />
      <FormattingToolbarController formattingToolbar={touch ? PhoneToolbar : NotesToolbar} />
      {touch ? null : <SideMenuController sideMenu={(props) => <SideMenu {...props} dragHandleMenu={NotesDragHandleMenu} />} />}
    </BlockNoteView>
  );

  // Escape in one of BlockNote's menus closes just the menu: its menus (floating-ui) close on the document and stop
  // the key there, so a dialog listening on the window never sees it.

  if (touch) {
    const startWriting = () => {
      // Rendered right away, not at the end of the event, so the focus still counts as the tap's own: a phone only
      // raises the keyboard for that.
      flushSync(() => setWriting(true));
      const last = editor.document[editor.document.length - 1];
      if (last) editor.setTextCursorPosition(last, "end");
      editor.focus();
    };
    const stopWriting = () => {
      setWriting(false);
      onBlur?.();
    };
    return (
      <>
        <NotesPreview
          markdown={value}
          summary={summarizeNote(value)}
          placeholder={touchPlaceholder}
          label={label}
          fill={fill}
          status={status}
          onOpen={startWriting}
          onChange={(markdown) => {
            emit.current(markdown);
          }}
        />
        {writing ? (
          <WritingPage label={label} context={context} editor={editor} onDone={stopWriting}>
            {view}
          </WritingPage>
        ) : null}
      </>
    );
  }

  return (
    // A sheet of paper: the text grows the box up to a point, then scrolls. With `fill` the paper is the
    // container itself, and the text takes all of its height.
    <div
      className={
        fill
          ? "relative flex min-h-0 flex-1 flex-col"
          : "relative mt-1.5 rounded-xl border border-border bg-card shadow-xs transition-[border-color,box-shadow] duration-150 hover:border-input focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/15 dark:bg-muted/40"
      }
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onBlur?.();
      }}
    >
      <div
        className={[
          "flex cursor-text flex-col overflow-y-auto overscroll-contain text-sm",
          fill ? "min-h-0 flex-1 pb-8 pt-2" : "min-h-[7.5rem] max-h-[min(50dvh,22rem)] py-2.5",
        ].join(" ")}
        onClick={(event) => {
          // A click on the empty part of the box goes to the end of the text.
          if (event.target !== event.currentTarget) return;
          const last = editor.document[editor.document.length - 1];
          if (last) editor.setTextCursorPosition(last, "end");
          editor.focus();
        }}
      >
        {view}
      </div>
      {status !== undefined ? <NoteStatus>{status}</NoteStatus> : null}
    </div>
  );
}

/**
 * The phone's field: the note as it reads (the markdown renderer the phone app shares), or a prompt. A tap opens the
 * full-screen page; a tap on a to-do's box ticks it right here, and a tap on a link follows it. A long note is cut
 * with a fade (with `fill` it scrolls instead), and a slim footer says how far its to-dos are.
 */
function NotesPreview({
  markdown,
  summary,
  placeholder,
  label,
  fill,
  status,
  onOpen,
  onChange,
}: {
  markdown: string;
  summary: NoteSummary | null;
  placeholder: string;
  label: string;
  fill: boolean;
  status?: ReactNode;
  onOpen: () => void;
  onChange: (markdown: string) => void;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  const html = useMemo(() => (markdown.trim() ? renderMarkdown(markdown) : ""), [markdown]);
  /** The note is longer than the field shows (a `fill` one scrolls instead). */
  const [clipped, setClipped] = useState(false);

  useEffect(() => {
    const element = box.current;
    if (!element || fill) return;
    // Fires once on observing too, so the first measure needs no call of its own.
    const observer = new ResizeObserver(() => setClipped(element.scrollHeight > element.clientHeight + 1));
    observer.observe(element);
    return () => observer.disconnect();
  }, [html, fill]);

  const todosLeft = summary && summary.total ? summary.total - summary.done : 0;
  const noun = label.toLowerCase();

  return (
    <div
      className={
        fill
          ? "flex min-h-0 flex-1 flex-col"
          : "mt-1.5 overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-colors has-[[role=button]:active]:border-ring/60 dark:bg-muted/40"
      }
    >
      <div className={fill ? "relative flex min-h-0 flex-1 flex-col" : "relative"}>
        <div
          ref={box}
          role="button"
          tabIndex={0}
          aria-label={html ? `Edit ${noun}` : `Add to ${noun}`}
          className={[
            "block cursor-text py-3 text-base leading-relaxed outline-none focus-visible:bg-accent/40",
            fill ? "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8" : "max-h-64 overflow-hidden px-3.5",
            fill ? "" : html ? "min-h-[3.25rem]" : "min-h-[5.25rem]",
            clipped ? "[mask-image:linear-gradient(to_bottom,black_calc(100%_-_3rem),transparent)]" : "",
          ].join(" ")}
          onClick={(event) => {
            const target = event.target instanceof Element ? event.target : null;
            // A tap on a link follows it, rather than opening the page to edit.
            if (target?.closest("a[href]")) return;
            // A tap on a to-do's box ticks it in place.
            if (target instanceof HTMLInputElement && target.dataset.line) {
              onChange(toggleTaskLine(markdown, Number(target.dataset.line)));
              return;
            }
            onOpen();
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            onOpen();
          }}
        >
          {html ? (
            <div className="notes-prose" dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <p className="text-muted-foreground/70">{placeholder}</p>
          )}
        </div>
        {status !== undefined ? <NoteStatus>{status}</NoteStatus> : null}
      </div>

      {html ? (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          className="flex h-9 w-full cursor-pointer items-center gap-2 border-t border-border/60 px-3.5 text-[13px] text-muted-foreground transition-colors active:bg-foreground/[0.04]"
          onClick={onOpen}
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

/** The `status` of a note, small in the bottom corner of its text. It lets clicks through, except on a button. */
function NoteStatus({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute bottom-2 right-3 text-xs text-muted-foreground [&_button]:pointer-events-auto"
    >
      {children}
    </p>
  );
}

/**
 * The phone's note page: the whole visible screen, from the top to where the keyboard starts (see
 * `useVisibleViewport`), so the text always has room. BlockNote pins its toolbar right above the keyboard; the
 * header has undo, redo and Done, like Apple Notes.
 */
function WritingPage({
  label,
  context,
  editor,
  onDone,
  children,
}: {
  label: string;
  context?: string;
  editor: NotesBlockEditor;
  onDone: () => void;
  children: ReactNode;
}) {
  const viewport = useVisibleViewport();

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      style={viewport.height ? { top: viewport.top, height: viewport.height } : { top: 0, height: "100dvh" }}
      className="fixed inset-x-0 z-[75] flex flex-col bg-background text-foreground animate-in fade-in-0 slide-in-from-bottom-3 duration-200 motion-reduce:animate-none"
      onKeyDown={(event) => {
        // Escape leaves the page, not the dialog behind it, unless it is closing BlockNote's "/" menu.
        if (event.key !== "Escape" || editor.getExtension(SuggestionMenu)?.shown()) return;
        event.stopPropagation();
        onDone();
      }}
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-border/60 pb-2.5 pl-4 pr-3 pt-[max(0.625rem,env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold leading-tight tracking-[-0.01em]">{label}</h2>
          {context ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{context}</p> : null}
        </div>
        {/* A press must not take the focus (and the keyboard) from the text. */}
        <div className="flex shrink-0 items-center" onPointerDown={(event) => event.preventDefault()}>
          <button
            type="button"
            aria-label="Undo"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-foreground transition-colors active:bg-foreground/[0.08]"
            onClick={() => editor.undo()}
          >
            <Undo2 className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Redo"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-foreground transition-colors active:bg-foreground/[0.08]"
            onClick={() => editor.redo()}
          >
            <Redo2 className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <button type="button" className="btn btn-primary btn-md h-9 rounded-full px-4" onClick={onDone}>
          Done
        </button>
      </header>

      {/* Room at the bottom for BlockNote's toolbar above the keyboard. */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-16 pt-2 text-base">
        <div className="mx-auto w-full max-w-2xl">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
