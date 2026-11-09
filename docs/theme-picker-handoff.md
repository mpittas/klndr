# Theme picker: handoff notes

Paste this file into a new Claude Code session (or point it here) to continue the work.

## The task

In the klndr web app (`apps/web-react`), the header's theme button (`aria-label="Toggle light/dark theme"`) is a light/dark
toggle. Turn it into a button that opens a dropdown where the user picks one of **5 themes**: the existing Light and
Dark, plus 3 new ones (designed below). Requirements:

- Every screen stays polished and readable in every theme: planner (day, week, month), modals, the block editor,
  category colors on blocks, the landing page.
- The choice survives a reload. People who never picked one keep today's default ("system": follows the OS light/dark).
- The dropdown matches the app's existing menus (copy the patterns in
  `apps/web-react/src/components/day-planner/BlockContextMenu.tsx`), shows each theme's name with a small color
  preview, marks the current theme, and works with the keyboard and on phones.
- Done means: header icon opens the dropdown; all 5 themes switch instantly; choice is remembered after reload;
  `npm run typecheck -w apps/web-react` and `npm run lint -w apps/web-react` pass; checked in the running app with a
  screenshot of each theme. **Don't commit** unless the user asks.
- Leave the unrelated uncommitted edits alone: `apps/web-react/src/components/TaskEditor.tsx`, `.claude/launch.json`,
  `uniwind-types.d.ts`.

## Where things stand

Only one small edit has been made so far, in `apps/web-react/src/styles.css`:

- The header comment now describes the theme setup (mentions `--shade` and a theme list in `src/theme.tsx`, neither of
  which exists yet).
- The first `:root {` block's selector became `:root,\n[data-theme="light"] {`.

Nothing else is changed. Nothing is committed.

## How theming works today (findings)

- **`packages/tokens`** generates `generated/theme.css` (`:root` + `.dark` blocks) that the web app imports first. But
  the web app then **overrides every variable** in `apps/web-react/src/styles.css`, so for the web, `styles.css` is the
  real source of truth. Plan: **don't touch `packages/tokens`** (its tests pin the generated files, and the mobile app
  reads it). Note: the tokens test "no longer defines the theme variables itself" looks like it already fails on main,
  because `styles.css` contains `--background:`. Run `npm run test -w packages/tokens` before your changes to see the
  baseline.
- **`apps/web-react/src/styles.css`**
  - Lines ~23–84: base variables in `:root` (warm paper light) and `.dark` (warm night), plus `--brand`,
    `--brand-foreground`, `--success`, `--success-foreground`, `--warning`, `--scrim`.
  - Lines ~91–159: category colors `--cat-<key>` / `--cat-<key>-ink` for `:root` and `.dark`.
  - `@custom-variant dark (&:where(.dark, .dark *));` — all `dark:` utilities key off the `.dark` class.
  - `.tone-*` rules (~line 400+) mix the category colors with `var(--card)` / `var(--muted)`, with `.dark .tone-*`
    variants. They adapt to any theme automatically as long as dark themes carry the `.dark` class.
  - Shadows in `@theme inline` and elsewhere are hard-coded brown: `rgb(60 40 20 / …)` and `rgb(52 36 20 / …)`
    (16 spots in styles.css).
- **`apps/web-react/src/theme.tsx`**: `ThemeProvider` + `useTheme()`. `ThemePreference = "system" | "light" | "dark"`.
  Saved in `localStorage` under `klndr-theme` (key removed for "system"). Applies `<html class="dark">`.
  `switchTheme()` turns transitions off for one frame so everything changes together. Listens to OS changes.
  Exposes `{ preference, setPreference, toggle }`.
- **`apps/web-react/index.html`**: an inline script applies `.dark` before first paint (no flash). Two
  `<meta name="theme-color">` tags are hard-coded to `#fbf8f3` (light) and `#1a1714` (dark).
- **Theme controls live in four places** (all must handle 5 themes):
  1. `src/components/AppHeader.tsx` ~line 86: the toggle button (`theme.toggle`, Moon/Sun icons).
  2. `src/components/landing/LandingNav.tsx` ~line 62: same toggle on the landing page.
  3. `src/components/AccountMenu.tsx` ~line 170: "Appearance" segmented control (Light / Dark / System icons,
     `role="menuitemradio"`).
  4. `src/components/profile/AppearanceCard.tsx`: "Theme" segmented radiogroup (Light / Dark / System).
- **Hard-coded colors in components** that would look wrong in the new themes:
  - Brown neutral shadows `rgb(60_40_20/…)` / `rgb(52_36_20/…)`: `Modal.tsx:260`, `MiniCalendar.tsx:161`,
    `PlannerMock.tsx:163,186`, `LandingHero.tsx:118,126,151`, `LandingNav.tsx:37`, `LandingCompare.tsx:77`.
  - Brand-colored shadows `rgb(120_40_20/…)`: `DayTimelineGrid.tsx:486`, `WeekGrid.tsx:494`, `MonthGrid.tsx:152`,
    `MiniCalendar.tsx:160`.
  - `Modal.tsx:245`: side-drawer veil `sm:bg-[rgb(28_20_12/0.14)]`.
  - `landing/LandingCta.tsx`: panel `bg-[#241d17]`, button text `text-[#241d17]`, glows `bg-[#c4553a]/30`,
    `bg-[#5f8f6a]/25`, `bg-[#e0b15a]/14`.
  - `dark:`-prefixed `rgb(0_0_0/…)` shadows are fine (dark themes keep the `.dark` class).

## Design decisions

- **Five themes** (`ThemeName`): `light`, `dark` (both unchanged), and three new ones:
  - **Lavender** (light scheme): soft lilac paper, deep violet ink, violet accent.
  - **Midnight** (dark scheme): deep navy, cool off-white ink, cornflower-blue accent.
  - **Forest** (dark scheme): deep pine green, honey-gold accent (warning moves to orange so it differs from the accent).
- `ThemePreference = "system" | ThemeName`. Default stays `"system"` (resolves to light or dark from the OS).
- `<html data-theme="<resolved name>">` is always set; dark-scheme themes **also** get the `dark` class, so every
  existing `dark:` utility and `.dark` rule (including the dark category colors) applies to Midnight and Forest.
- Theme blocks use attribute selectors that are **not** `:root`-only (`[data-theme="midnight"] { … }`), so a preview
  `<span data-theme="midnight" class="bg-background">` renders in that theme's real colors — no duplicated hex values
  in TypeScript. Keep previews free of `dark:` classes (they follow the page, not the preview).
- Same specificity for all blocks, so **order matters**: theme blocks go after the `:root` and `.dark` blocks.
- Two new variables so shadows follow the theme: `--shade` (neutral shadow tint, an RGB triplet) and `--brand-shade`
  (brand-tinted shadow triplet). Light and Dark keep today's values, so they look the same.
- Keep the `klndr-theme` localStorage key; old saved values `light`/`dark` stay valid.
- Header icon: use lucide `Palette` (it now opens a picker rather than toggling).

## Step-by-step plan

### 1. `styles.css` — variables and theme blocks

- Change `.dark {` (first one, base vars ~line 55) to `.dark,\n[data-theme="dark"] {`.
- Add to the light block: `--shade: 60 40 20;` and `--brand-shade: 120 40 20;`.
- Add to the dark block: `--shade: 60 40 20;` and `--brand-shade: 120 40 20;` (unchanged look).
- Right after the dark base block, add:

```css
[data-theme="lavender"] {
  color-scheme: light;
  --background: #f8f6fc;
  --foreground: #221d33;
  --card: #fefdff;
  --card-foreground: #221d33;
  --popover: #fefdff;
  --popover-foreground: #221d33;
  --primary: #2a2340;
  --primary-foreground: #f8f6fc;
  --secondary: #f0ecf8;
  --secondary-foreground: #2a2340;
  --muted: #f0ecf8;
  --muted-foreground: #6b6485;
  --accent: #e9e3f5;
  --accent-foreground: #2a2340;
  --destructive: #c8384d;
  --destructive-foreground: #fff8fa;
  --border: #e6e0f0;
  --input: #d8d0e6;
  --ring: #6d4fd0;
  --canvas: #f0ecf8;

  --brand: #6d4fd0;
  --brand-foreground: #fbf9ff;
  --success: #3a8a62;
  --success-foreground: #f5fbf7;
  --warning: #b7791f;

  --scrim: rgb(26 20 48 / 0.34);
  --shade: 50 40 90;
  --brand-shade: 70 40 150;
}

[data-theme="midnight"] {
  color-scheme: dark;
  --background: #0f141d;
  --foreground: #e6ebf3;
  --card: #151b26;
  --card-foreground: #e6ebf3;
  --popover: #1a2130;
  --popover-foreground: #e6ebf3;
  --primary: #e6ebf3;
  --primary-foreground: #0f141d;
  --secondary: #1b2230;
  --secondary-foreground: #e6ebf3;
  --muted: #1b2230;
  --muted-foreground: #8f9bb0;
  --accent: #232b3b;
  --accent-foreground: #e6ebf3;
  --destructive: #f06a6a;
  --destructive-foreground: #0f141d;
  --border: #262f40;
  --input: #333d51;
  --ring: #7ea6ff;
  --canvas: #0b0f16;

  --brand: #7ea6ff;
  --brand-foreground: #0d1220;
  --success: #6cc597;
  --success-foreground: #0c1a13;
  --warning: #e8b45c;

  --scrim: rgb(0 0 0 / 0.6);
  --shade: 2 6 18;
  --brand-shade: 20 40 110;
}

[data-theme="forest"] {
  color-scheme: dark;
  --background: #121a16;
  --foreground: #e8efe9;
  --card: #17211c;
  --card-foreground: #e8efe9;
  --popover: #1c2721;
  --popover-foreground: #e8efe9;
  --primary: #e8efe9;
  --primary-foreground: #121a16;
  --secondary: #1d2822;
  --secondary-foreground: #e8efe9;
  --muted: #1d2822;
  --muted-foreground: #96a89c;
  --accent: #25322b;
  --accent-foreground: #e8efe9;
  --destructive: #ec6f5e;
  --destructive-foreground: #121a16;
  --border: #28362e;
  --input: #35453b;
  --ring: #e6b866;
  --canvas: #0d1410;

  --brand: #e6b866;
  --brand-foreground: #1a1408;
  --success: #82c99c;
  --success-foreground: #0f1c14;
  --warning: #eb9a5b;

  --scrim: rgb(0 0 0 / 0.58);
  --shade: 0 10 5;
  --brand-shade: 90 60 10;
}
```

- Replace every `rgb(60 40 20 / X)` and `rgb(52 36 20 / X)` in styles.css with `rgb(var(--shade) / X)` (the `@theme
  inline` shadows, `.btn-primary`, `.segmented-item` active chip, landing `.lift-card`, `.word-block`).
- Category colors (`--cat-*`) need no new blocks: Lavender uses the `:root` set, Midnight and Forest the `.dark` set.
  Only tune them if the screenshots show a problem.
- Sanity-check contrast (aim for ≥ 4.5:1): `muted-foreground` on `background`, `brand-foreground` on `brand`,
  `foreground` on `card`, and category ink on a `.tone-block` in each theme. Estimated: Lavender muted ≈ 5.1:1,
  Lavender white-on-brand ≈ 5.7:1, Midnight muted ≈ 6.3:1, Midnight brand text ≈ 7.8:1.

### 2. `src/theme.tsx` — the model

Sketch:

```tsx
export type ThemeName = "light" | "dark" | "lavender" | "midnight" | "forest";
export type ThemePreference = "system" | ThemeName;
export type ThemeOption = { name: ThemeName; label: string; scheme: "light" | "dark"; description: string };

/** Keep in step with the scheme map in index.html and the blocks in styles.css. */
export const THEME_OPTIONS: readonly ThemeOption[] = [
  { name: "light", label: "Light", scheme: "light", description: "Warm paper" },
  { name: "dark", label: "Dark", scheme: "dark", description: "Warm night" },
  { name: "lavender", label: "Lavender", scheme: "light", description: "Soft lilac" },
  { name: "midnight", label: "Midnight", scheme: "dark", description: "Deep navy" },
  { name: "forest", label: "Forest", scheme: "dark", description: "Pine and honey" },
];
```

- `readPreference()`: accept any `ThemeName` from localStorage, else `"system"`.
- Keep `systemDark` in state (updated by the `prefers-color-scheme` media listener); resolved
  `theme = preference === "system" ? (systemDark ? "dark" : "light") : preference`.
- Apply in a `useLayoutEffect` on `theme`: set `document.documentElement.dataset.theme = theme`, toggle the `dark`
  class from the scheme, and update every `meta[name="theme-color"]` `content` to
  `getComputedStyle(document.documentElement).getPropertyValue("--background").trim()`. Use the existing
  `switchTheme` trick (no transitions for one frame) for changes after the first render.
- `setPreference(next)`: set state; `localStorage.removeItem` for `"system"`, else `setItem(next)` (try/catch as now).
- Optional nicety: listen to the `storage` event so other tabs follow.
- Context value: `{ preference, theme, setPreference }`. Remove `toggle` once nothing uses it.

### 3. `index.html` — pre-paint script

Replace the script with one that sets both `data-theme` and the `dark` class:

```html
<script>
  // Apply the saved (or OS) theme before first paint, so there is no flash (see src/theme.tsx).
  try {
    var schemes = { light: 0, dark: 1, lavender: 0, midnight: 1, forest: 1 };
    var t = localStorage.getItem("klndr-theme");
    if (!Object.prototype.hasOwnProperty.call(schemes, t)) {
      t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-theme", t);
    if (schemes[t]) document.documentElement.classList.add("dark");
  } catch (e) {}
</script>
```

### 4. New components

- **`src/components/ThemeSwatch.tsx`**: a tiny preview drawn in the theme's real colors, e.g.
  `<span data-theme={name} className="… rounded-md border border-border bg-background">` containing a `bg-card` bar,
  a `bg-brand` dot and a `bg-foreground/40` line. Sizes: small (menu rows / account menu circles), large (profile card).
  No `dark:` classes inside.
- **`src/components/ThemeMenu.tsx`**: trigger button + dropdown. Accept a `triggerClassName` prop so the header
  (`btn btn-ghost btn-icon h-10 sm:h-9`) and the landing nav (its own classes) can style it.
  - Trigger: `aria-haspopup="menu"`, `aria-expanded`, `aria-controls`, `aria-label="Theme"`, `title="Theme"`, `Palette`
    icon. ArrowDown/ArrowUp on the trigger opens it.
  - Panel: `menu absolute right-0 top-full z-50 mt-2 w-60 origin-top-right outline-none animate-in fade-in-0 zoom-in-95
    duration-150`, `role="menu"`, `aria-label="Theme"`. Start with a `menu-label` "Theme".
  - Rows: `role="menuitemradio"`, `aria-checked`, row classes as in BlockContextMenu
    (`flex h-8 … rounded-lg px-2.5 text-[13px] … touch:h-11` + `text-foreground focus:bg-accent`), content =
    swatch + label (+ muted description) + `Check` icon (invisible when not checked).
  - After a separator: a "Match device" / "System" row (`Monitor` icon), checked when `preference === "system"`.
  - Keyboard (copy from AccountMenu/BlockContextMenu): opened from the keyboard, focus the checked row; ArrowUp/Down
    wrap, Home/End, Escape closes and refocuses the trigger, Tab closes. Mouse: `followPointer` (row under the mouse
    takes focus). Pointerdown outside closes. Selecting a row sets the preference and closes, refocusing the trigger.
  - Phones: rows are `touch:h-11`; the panel is right-aligned under the trigger and 15rem wide, which fits a 320px
    screen. Check it in the mobile viewport.

### 5. Wire it in

- `AppHeader.tsx`: replace the toggle button with `<ThemeMenu triggerClassName="btn btn-ghost btn-icon h-10 sm:h-9" />`;
  drop the `Moon`/`Sun` imports and `useTheme`; update the doc comment.
- `LandingNav.tsx`: same, with its existing button classes.
- `AccountMenu.tsx`: the Light/Dark/System segmented control would show nothing checked for a new theme. Replace it
  with a row labelled "Theme" and a `segmented h-8` of six `w-7` items: five round swatches (`aria-label` = theme name,
  `title` too) + `Monitor` for System, all `role="menuitemradio"`. Width check: "Theme" + 6×w-7 fits the 17rem menu;
  "Appearance" + 6 items does not.
- `profile/AppearanceCard.tsx`: replace the segmented control with a radiogroup grid of cards (large swatch + name +
  description), 5 themes + System, styled like the existing "Open blocks in" cards in the same file (selected:
  `border-primary shadow-[0_0_0_1px_var(--primary)]`). Update the helper copy ("System follows your device's light or
  dark setting.").

### 6. Replace hard-coded colors (see the list above)

- Neutral shadows: `rgb(60_40_20/X)` / `rgb(52_36_20/X)` → `rgb(var(--shade)/X)`.
- Brand shadows: `rgb(120_40_20/X)` → `rgb(var(--brand-shade)/X)`.
- `Modal.tsx:245`: `sm:bg-[rgb(28_20_12/0.14)]` → `sm:bg-[color-mix(in_oklab,var(--scrim)_40%,transparent)]`
  (same color and alpha in Light).
- `LandingCta.tsx`: panel `bg-[#241d17]` → `bg-primary`; button text `text-[#241d17]` → `text-primary`; glow
  `bg-[#c4553a]/30` → `bg-brand/30`. The sage and amber glows can stay. Dark themes already switch the panel with
  `dark:bg-card`.

### 7. Checks

```bash
npm run typecheck -w apps/web-react
```

```bash
npm run lint -w apps/web-react
```

Only if `packages/tokens` was touched (the plan says don't):

```bash
npm run test -w packages/tokens
```

### 8. Check it in the running app

- `.claude/launch.json` has `category-api` (port 3011, in-memory API) and `category-web` (port 5183, no Firebase,
  signed in as the local dev user). Ports 3011 and 5183 were **already in use by another chat**, so add your own pair
  (copy those two configs as e.g. `theme-api` on 3013 and `theme-web` on 5185 with
  `VITE_API_PROXY_TARGET=http://localhost:3013`), and **remove them when done** (launch.json has the user's own
  uncommitted edits; only remove what you added).
- For each of the 5 themes, screenshot: month, week and day views, the block editor (dialog and side panel), a
  modal, the theme dropdown open, the landing page (`/`) including the dark CTA panel, and the profile page's
  Appearance card. Also a phone-size viewport with the dropdown open.
- Reload after picking a theme: it must stick, with no flash. Clear the key (`localStorage.removeItem("klndr-theme")`)
  and reload: it must follow the OS again.
- Keyboard: Tab to the header button, ArrowDown opens it with the current theme focused, arrows move, Enter picks,
  Escape closes and returns focus.

## Final message to the user

Keep it short and plain (they prefer 3–5 lines, no tables): what was done, the theme names, anything that failed or
was skipped, and that nothing is committed.
