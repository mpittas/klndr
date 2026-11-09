---
name: dayro.
description: Tactile daily time-block planner, drawn as a warm paper planner (web)
colors:
  background: "#fbf8f3"
  card: "#fffefb"
  canvas: "#f4efe7"
  foreground: "#231e18"
  muted-foreground: "#74695c"
  primary: "#2a231c"
  border: "#e9e2d6"
  input: "#ddd3c4"
  brand: "#c4553a"
  success: "#3f8a5c"
  destructive: "#c8402c"
typography:
  family: "Instrument Sans Variable"
  page-title:
    fontSize: "2.125rem"
    fontWeight: 600
    letterSpacing: "-0.035em"
  dialog-title:
    fontSize: "1.125rem"
    fontWeight: 600
    letterSpacing: "-0.02em"
  card-title:
    fontSize: "0.8125rem"
    fontWeight: 600
  body:
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontSize: "0.75rem"
    fontWeight: 500
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  2xl: "18px"
  3xl: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button: "btn + btn-xs|sm|md|lg + btn-primary|secondary|soft|ghost|danger|danger-soft (+ btn-icon)"
  surfaces: "card, card-title, card-meta, menu, menu-item, menu-label"
  fields: "field, field-label"
  small: "segmented, segmented-item, count, kbd, progress, progress-bar, tick, avatar"
  categories: "tone-<key> + tone-block|block-done|meta|chip|icon|ghost|solid|selected|check"
---

# Design System

<!-- impeccable:design-schema 1 -->

## Overview

dayro. is an intentional, distraction-free daily planner. On the web it reads as a warm paper planner: cream paper, brown-black ink, one terracotta accent. The interface is calm, tactile and typographic. Color is reserved for the categories people create, never for decoration.

## Colors

All web values live in `apps/web-react/src/styles.css` (they override the shared `@dayro/tokens` palette; the mobile app keeps its own).

- **Paper and desk**: `background` is the paper, `card` a brighter sheet laid on it, `canvas` the desk under the pages (calendar, profile, auth). Borders are warm hairlines (`border`); `input` is the stronger edge on hover.
- **Ink**: `foreground` for text, `muted-foreground` for secondary text, `primary` (ink) for the one main action on a screen.
- **One accent**: `brand` (terracotta) marks *today* and *now* only: today's date disc, the "Today" labels, the now line and its pill, focus rings, selection, the wordmark's full stop. Nothing else is orange.
- **Done is sage**: `success` for every completed state (ticks, progress bars, "all done").
- **Activity Categories**: one hue per stored key (`--cat-<key>`) plus its ink (`--cat-<key>-ink`). Every role is mixed from those two against the paper by the `.tone-*` classes, handed out by `paletteOf()` in `src/lib/colors.ts`. Keys like `emerald` are not CSS colors: always go through `.tone-*` (or `var(--cat-<key>)`). Dialogs and editors stay neutral; a category shows its color on the timeline, in chips and as the dot beside its name, not across a form. Avoid heavy single-side saturated border bars.
- **Shadows** are tinted brown (`rgb(60 40 20 / …)`), never slate or black, in light mode.

## Typography

- **One typeface**: Instrument Sans at every size, tight tracking on headings (`-0.02em` to `-0.035em`), relaxed leading for reading, and tabular numerals (`tabular-nums`) for every time, duration and count.
- **Scale**: page title 28–34px semibold; dialog title 18px semibold; card title 13px semibold with an optional muted meta beside it (`card-title` + `card-meta`); body 14px; row text 13px; captions 12px; nothing below 11px in the app.
- **Hierarchy**: headings without decorative kickers or eyebrows; labels speak for themselves. Sentence case everywhere ("Save changes", not "Save Changes").

## Layout

- **Desktop**: Month, Week and Day share one frame (`components/planner/`), so switching views never moves the furniture. `PlannerLayout`: the sidebar on the left (from `lg`, folded with the toolbar button or `\`), the toolbar and the grid in the middle (only the grid scrolls), and on the Day only, a panel on the right (from `xl`). `PlannerToolbar`, the same on every view: the sidebar button, the title and its totals on the left (the week adds its ISO week number); Categories, ‹ Today › and New block on the right. One date picker on screen at a time: beside the sidebar's mini calendar the title is plain text; without it (phones, tablets, sidebar folded) the title opens the date picker. `PlannerSidebar`, the same on every view: the mini calendar (where you are: the day as a disc, the week as a band, a dot on days with blocks) and the activities (what you plan with: drag one onto the day's timeline, a slot of the week or a day of the month). Which categories show is the toolbar's Categories control, remembered across views. What belongs to one day (its checklist and notes) is the Day's own panel, or sheets from its bottom bar below `xl`. Timelines (the week, and the day when it is today) open on now, a third of the way down; paging weeks keeps the hour in view. The same keys everywhere: ← → page, T today, N new block, G go to, \ sidebar; on a focused week block, ↑ ↓ move it a quarter hour and ← → a day.
- **Responsive**: Graceful collapse into stacked column on mobile viewports with sticky navigation and accessible touch targets (≥44px).
- **Touch conventions**:
  - Tap targets are ≥40px (primary controls 44px). Where the visual must stay small, extend the hit area with an `after:` pseudo-element.
  - Use the `touch:` variant (`hover: none` + `pointer: coarse`) for anything that depends on hover or finger size, and `short:` (height ≤ 500px) for landscape phones. Never hide an action behind hover without a touch alternative.
  - Fields are 16px on touch (global rule in `main.css`); smaller text makes iOS zoom the page on focus.
  - Dialogs and pickers are bottom sheets below `sm` (`Modal.tsx`, `CategorySelect.tsx`, `EmojiPicker.tsx`): `dvh` heights, safe-area padding, swipe-down to dismiss, and the primary action pinned in the `footer`.
  - **Mobile sheets** (`apps/mobile`, one anatomy, modelled on the phone's Calendar "New Event" sheet): `SheetScreen` gives a white close disc at the start, the title centred, and the sheet's one action as a disc at the end (filled once it can be used, grey until then); content sits on the canvas with a 16pt inset on all four sides. Fields live in `Card`s (20pt continuous corners) of 56pt rows with 17pt text: label left, value right, no icon tiles. A date or time is a grey pill on its row; touching it unfolds the calendar or wheel under the row. A name is a plain field with a grey hint ("Title"). Delete is its own card with a centred red label. Build a new sheet from these parts; do not restyle a row or a card in place.
  - Don't auto-focus fields on touch; it raises the keyboard over the sheet.
- **Native app** (`apps/mobile`): the phone's own grouped look, from the same tokens.
  - Calendar, Library, Settings and every sheet sit on `canvas` with `card` surfaces (`Card`, `Section`): no border and no shadow, the step from canvas to card is the elevation. The Day tab stays on `background`, so the timeline reads as one sheet of paper.
  - Screens open with a large title (`Text variant="largeTitle"`); lists and forms use the phone steps `headline` (17) and `callout` (15) on top of the shared scale, because 14px rows are hard to read at arm's length.
  - Rows (`ListRow`, `FieldRow`): 50pt, a grey `IconTile` for settings, a category-tinted tile for an activity's emoji, hairlines inset to where the text starts.
  - Header actions are round (`CircleButton`); the one primary action is the filled ink colour. Toasts drop in at the top as a pill, clear of the tab bar and of open sheets.
  - The Day tab has a week strip (selected day a filled disc, today in the now-line's red, category dots under each day); the Calendar's month grid uses the same discs and dots, and lists the chosen day under it.
  - `Text` defaults to the theme's foreground: React Native has nothing to inherit at the top of a text, so a colourless one is black in dark mode.

## Elevation & Depth

- Declare elevation once: either a 1px crisp border or a soft, diffuse shadow (`shadow-xs` / `shadow-sm`), never a border on top of heavy offset shadows.
- No neo-brutalist zero-blur block shadows or decorative glassmorphism.

## Shapes

- Radii: `6px` tiny marks (kbd, swatch chips), `8px` small controls and timeline blocks, `10px` buttons and fields, `14px` cards and menus, `18px` dialogs and the month grid, `24px` bottom sheets. Pills (`rounded-full`) for counts, duration chips, routines and avatars.
- Interactive controls maintain consistent rounded geometries.

## Shared parts (web)

Build screens from the classes in `styles.css` (`@layer components`, so a utility on the same element still wins) instead of restyling a control in place:

- **Buttons**: `btn` + a size (`btn-xs` 28, `btn-sm` 32, `btn-md` 36, `btn-lg` 44) + a variant (`btn-primary` ink, `btn-secondary` outlined paper, `btn-soft` tinted, `btn-ghost`, `btn-danger`, `btn-danger-soft`); `btn-icon` makes it square. Dialog footers use `btn btn-md h-11 px-5 sm:h-10`. Phones get 44px targets through `max-sm:`/`touch:` overrides.
- **Surfaces**: `card` (+ `card-title`, `card-meta`), `menu` (+ `menu-item`, `menu-label`) for every popover and context menu.
- **Fields**: `field` for every input, select and textarea (filled paper, hairline border, terracotta focus ring); `field-label` above it.
- **Small things**: `segmented`/`segmented-item` (header nav, sidebar tabs, scope toggles: the chosen item is a raised sheet), `count`, `kbd`, `progress`/`progress-bar`, `tick` (round done-control), `avatar`.
- **Wordmark**: `<Wordmark />` everywhere the logo appears.
- **Dialogs**: `Modal` is a bottom sheet on phones and a centred dialog from `sm`; `compactHeader` swaps the big title for a slim toolbar row (small label left, actions and close right) for content that brings its own headline; headers get a hairline once the body scrolls under them. With `side` it is a full-height drawer on the left with a lighter veil (Notion's side peek). The block editor opens in the default chosen under Profile & settings > Appearance (`useDefaultEditorLayout`, kept per browser); the Center / Side switch beside its close button changes only the editor that is open.
- **Settings that save**: account data (the profile form) has no inline save button; a bar pinned to the bottom of the screen appears only while there are unsaved changes (Discard / Save changes), says "Changes saved" after, and leaving the page first asks to keep editing or discard. Settings kept on the device (Appearance) apply at once and say "Saves automatically".
- **Times**: `TimeSelect` (a list of quarter-hour slots: popover on desktop, sheet on phones) instead of native time inputs; dates through `DatePickerModal` with `onPick`.

## Components

- **Block Cards**: Tactile tiles with 1px cohesive borders, dark readable labels, completion toggle, and subtle hover-only controls.
- **Activity Palettes**: Draggable items with clear drag handles and grab/grabbing cursors.
- **Timeline Grid**: Crisp 30-minute rows, clean gutter labels, and a precise current-time indicator.
- **Timeline Blocks** (`TimeBlock.tsx`): One anatomy at every length: emoji and title, the time beneath (beside it on 15-minute blocks), and a completion ring on the right. Opaque category tint (`tone-block`) with a matched 1px border, ink-colored text, no shadow, no side bar, and an 8px radius so short and long blocks share their corners. Blocks still to do carry a full tint and an empty ring in their color; done blocks drain back to the paper as soft grey shapes with no outline (grey ink, a struck-through title, a greyed emoji) and only their filled tick keeps the category color, so what is left to do stands out at a glance. The day runs 60px per half hour and blocks sit 3px inside their slot, so back-to-back 15-minute blocks keep a 6px gap and room to read. Notes, durations and other details live in the editor, not on the block.
- **Header**: Translucent paper bar with the wordmark (terracotta full stop), a segmented Calendar/Today switch, a ghost theme button and the avatar chip, which opens the account menu (`AccountMenu.tsx`: who is signed in, Profile & settings, Appearance, About dayro. → the landing page, policies, Log out). Signed-in visitors on the landing page get "Open calendar" to go back.

## Do's and Don'ts

- **Do** use drawn SVGs with consistent stroke weights (1.5px–2px) for icons and chrome.
- **Do** use tabular numbers for all clock times and duration counters.
- **Don't** use emoji as app icons or brand logos.
- **Don't** use thick 4px side-tab borders on task cards.
- **Don't** use kicker/eyebrow labels above headings.
- **Don't** use raw ASCII glyphs (`‹`, `›`) for interactive pagination controls.
