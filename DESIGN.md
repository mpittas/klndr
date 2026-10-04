---
name: DayForge
description: Tactile daily time-block planner
colors:
  primary: "#0f172a"
  primary-hover: "#1e293b"
  accent: "#4f46e5"
  accent-hover: "#4338ca"
  surface-bg: "#f8fafc"
  surface-card: "#ffffff"
  surface-subtle: "#f1f5f9"
  border-subtle: "#e2e8f0"
  border-strong: "#cbd5e1"
  text-primary: "#0f172a"
  text-secondary: "#475569"
  text-muted: "#64748b"
  scrollbar-thumb: "rgb(148 163 184 / 0.35)"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    letterSpacing: "-0.025em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    letterSpacing: "-0.015em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
  micro:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
  nano:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 600
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
---

# Design System

<!-- impeccable:design-schema 1 -->

## Overview

DayForge is an intentional, distraction-free daily planner. The interface is calm, tactile, and typographic. Color is reserved for user-created task categories rather than competing UI decoration.

## Colors

- **Foundations**: Slate-50 background (`#f8fafc`), pure white card surfaces (`#ffffff`), slate-200 structural borders (`#e2e8f0`).
- **Foregrounds**: High-contrast slate-900 primary text (`#0f172a`), slate-600 secondary (`#475569`), slate-400 placeholder/tertiary (`#94a3b8`).
- **Activity Categories**: Muted, studio-grade pastel fills with matched 1px borders and deep high-contrast ink text. Avoid heavy single-side saturated border bars.

## Typography

- **Scale**: Inter / System sans-serif with tight tracking (`-0.01em` to `-0.025em`) for headers, relaxed line height for reading, and tabular numerals (`tabular-nums`) for timeline hours and elapsed time displays.
- **Hierarchy**: Bold headings without decorative kickers or eyebrows; labels speak for themselves.

## Layout

- **Desktop**: Two-panel split on the day view: flexible activity library drawer (left) and hour-by-hour timeline canvas (right). Calendar month view on a clean 7-column layout with right sidebar.
- **Responsive**: Graceful collapse into stacked column on mobile viewports with sticky navigation and accessible touch targets (≥44px).
- **Touch conventions**:
  - Tap targets are ≥40px (primary controls 44px). Where the visual must stay small, extend the hit area with an `after:` pseudo-element.
  - Use the `touch:` variant (`hover: none` + `pointer: coarse`) for anything that depends on hover or finger size, and `short:` (height ≤ 500px) for landscape phones. Never hide an action behind hover without a touch alternative.
  - Fields are 16px on touch (global rule in `main.css`); smaller text makes iOS zoom the page on focus.
  - Dialogs and pickers are bottom sheets below `sm` (`Modal.tsx`, `CategorySelect.tsx`, `EmojiPicker.tsx`): `dvh` heights, safe-area padding, swipe-down to dismiss, and the primary action pinned in the `footer`.
  - Don't auto-focus fields on touch; it raises the keyboard over the sheet.

## Elevation & Depth

- Declare elevation once: either a 1px crisp border or a soft, diffuse shadow (`shadow-xs` / `shadow-sm`), never a border on top of heavy offset shadows.
- No neo-brutalist zero-blur block shadows or decorative glassmorphism.

## Shapes

- Cohesive radii scale: `6px` for small chips and controls, `10px` for task cards and buttons, `14px` for structural panels and modals.
- Interactive controls maintain consistent rounded geometries.

## Components

- **Task Cards**: Tactile tiles with 1px cohesive borders, dark readable labels, completion toggle, and subtle hover-only controls.
- **Activity Palettes**: Draggable items with clear drag handles and grab/grabbing cursors.
- **Timeline Grid**: Crisp 30-minute rows, clean gutter labels, and a precise current-time indicator.
- **Timeline Blocks** (`TimeBlock.tsx`): One anatomy at every length: emoji and title, the time beneath (beside it on 15-minute blocks), and a completion ring on the right. Opaque category tint with a matched 1px border, no shadow, no side bar, and a 6px radius so short and long blocks share their corners. Done blocks keep their color but fade. Notes, durations and other details live in the editor, not on the block.
- **Header**: Minimalist top bar with custom vector logo and concise navigation.

## Do's and Don'ts

- **Do** use drawn SVGs with consistent stroke weights (1.5px–2px) for icons and chrome.
- **Do** use tabular numbers for all clock times and duration counters.
- **Don't** use emoji as app icons or brand logos.
- **Don't** use thick 4px side-tab borders on task cards.
- **Don't** use kicker/eyebrow labels above headings.
- **Don't** use raw ASCII glyphs (`‹`, `›`) for interactive pagination controls.
