# Homepage "Our Work" Showcase: Handoff Plan

Goal: add an **"Our work"** section to the klndr landing page (`/`) that shows work items as cards with thumbnail images. Build five minimal layouts, compare them in the browser, then keep one.

This plan is written so a smaller model (Sonnet or Haiku) can execute each task without more context. Do the tasks in order. Each task lists the exact files, what to build, and how to check it.

---

## 0. Ground rules (read first)

- **Only touch** `apps/web-react/` and `docs/homepage-showcase/`. Do not edit `apps/mobile`, `apps/api`, or `packages/`.
- **Do not commit or push.** The user decides when to commit.
- The working tree already has many unrelated uncommitted changes (for example `apps/web-react/src/theme.tsx`). **Do not revert, reformat, or "clean up" files you did not create or were not told to change.**
- Match the existing landing code: same class-name style (Tailwind utilities), same icon library (`lucide-react`), same theme tokens (`bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`), same section pattern (`data-reveal` on blocks, `px-5 sm:px-8` gutters, `max-w-6xl` container).
- Look at `apps/web-react/src/components/landing/LandingMarquee.tsx` and `LandingFeatures.tsx` as the reference for style and structure.
- Design direction (from `DESIGN.md` and the existing landing page): calm, minimal, typographic. Hairline borders (`border-border`), soft shadows (`shadow-2xs`), rounded corners (`rounded-2xl`), colour only as small accents. No gradients-for-decoration, no emoji-heavy UI, no heavy shadows.
- Text: no eyebrows or kicker labels above headings (DESIGN.md says "Bold headings without decorative kickers"). Heading first, then one short line of body text.

### Assumption to confirm with the user

"Our work" is taken to mean **showcase items about klndr and its related work** (projects, screenshots, case studies). No real work items exist in the repo yet, so this plan uses **placeholder items** that are clearly marked. Replace them with real content once the user provides it. If the user meant something else, stop and ask before Phase 1.

---

## 1. Target structure

New files (all under `apps/web-react/src/components/landing/showcase/`):

```
showcase/
  types.ts              // ShowcaseItem type
  showcase-data.ts      // placeholder items + SHOWCASE_LAYOUT constant
  ShowcaseThumb.tsx     // thumbnail image with a guaranteed fallback (Phase 0)
  ShowcaseSection.tsx   // section wrapper: heading + body text + chosen layout (Phase 0)
  layouts/
    GridLayout.tsx          // Layout 1
    FeaturedLayout.tsx      // Layout 2
    StripLayout.tsx         // Layout 3
    AlternatingLayout.tsx   // Layout 4
    FilterLayout.tsx        // Layout 5
```

New public folder for real thumbnails (Vite serves `apps/web-react/public/` at the site root):

```
apps/web-react/public/showcase/<slug>.webp   // 1600 x 1000 px (16:10), optional
```

Changed file:

- `apps/web-react/src/routes/index.tsx`: add `<ShowcaseSection />` between `<LandingFeatures />` and `<LandingCta />`.

---

## 2. Data contract (shared by all layouts)

`showcase/types.ts`:

```ts
export type ShowcaseItem = {
  slug: string;          // unique, kebab-case, also used for the thumbnail file name
  title: string;         // 2–4 words
  summary: string;       // one sentence, max ~110 characters
  category: "Product" | "Design" | "Build";  // used by FilterLayout; keep to these three
  color: string;         // a key accepted by paletteOf() in apps/web-react/src/lib/colors.ts, e.g. "indigo"
  thumbnail?: string;    // optional public path, e.g. "/showcase/planner-week.webp"
  href?: string;         // optional link; omit to render a non-link card
};
```

`showcase/showcase-data.ts`:

```ts
import type { ShowcaseItem } from "./types";

// Preview override: in dev only, ?showcase=grid|featured|strip|alternating|filter.
// Change this constant to pick the layout that ships.
export const SHOWCASE_LAYOUT: ShowcaseLayoutName = "grid";

export type ShowcaseLayoutName = "grid" | "featured" | "strip" | "alternating" | "filter";

// PLACEHOLDER content. Replace with real work items.
export const showcaseItems: ShowcaseItem[] = [
  { slug: "day-planner", title: "Day planner", summary: "Drag activities onto an hour-by-hour timeline.", category: "Product", color: "indigo" },
  { slug: "month-view", title: "Month view", summary: "See the whole month with time totals per day.", category: "Design", color: "emerald" },
  { slug: "guest-mode", title: "Guest mode", summary: "Start planning in the browser with no account.", category: "Build", color: "amber" },
  { slug: "live-sync", title: "Live sync", summary: "Changes appear across open tabs and devices at once.", category: "Build", color: "rose" },
  { slug: "routines", title: "Daily routines", summary: "Small habits you tick off each day.", category: "Product", color: "cyan" },
  { slug: "keyboard", title: "Keyboard nudges", summary: "Move a block by 15 minutes with the arrow keys.", category: "Design", color: "violet" },
];
```

Rules for every layout:

- Read items only from `showcaseItems`. Do not hard-code titles in a layout.
- Each layout component takes one prop: `items: ShowcaseItem[]`.
- Render at most 6 items. If the data has more, use `items.slice(0, 6)`.

---

## 3. Thumbnail requirement (must always show something)

The user requires that a thumbnail appears. The placeholder items have no image yet, so `ShowcaseThumb` must **always render a visible frame**:

1. If `thumbnail` is set, render `<img>` with the image.
2. If `thumbnail` is missing **or the image fails to load** (`onError`), render a **fallback mock**: a 16:10 panel in the item's colour, with a minimal "window" of three faint bars and the item's first letter. This must look intentional, not broken.

`ShowcaseThumb.tsx` requirements:

- Props: `{ item: ShowcaseItem; className?: string; priority?: boolean }`.
- Outer wrapper: `relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-muted ring-1 ring-border`.
- `<img>` attributes: `alt={item.title}`, `width={1600}`, `height={1000}`, `loading={priority ? "eager" : "lazy"}`, `decoding="async"`, class `h-full w-full object-cover`.
- Track failure with `useState<boolean>` (`failed`). Set it in `onError`. When `failed` is true or there is no `thumbnail`, render the fallback instead of the `<img>`.
- Fallback colours come from `paletteOf(item.color).icon` (see `apps/web-react/src/lib/colors.ts`). Use that for the letter badge background. Keep the panel neutral (`bg-muted` or `bg-card`) with the coloured badge on top.
- Fallback must not depend on the image file existing.
- Hover (layouts that link): `transition duration-500 group-hover:scale-[1.03]` on the `<img>` or fallback. Respect `motion-reduce:transition-none`.

---

## 4. Phase 0: shared pieces (do this first, once)

**Task 0.1: types and data.** Create `showcase/types.ts` and `showcase/showcase-data.ts` exactly as in section 2. Set `SHOWCASE_LAYOUT = "grid"` for now.

**Task 0.2: thumbnail component.** Create `ShowcaseThumb.tsx` per section 3.

**Task 0.3: section wrapper.** Create `ShowcaseSection.tsx`:

- Root: `<section aria-labelledby="showcase-title" className="relative bg-background py-20 sm:py-28">` with an inner `mx-auto max-w-6xl px-5 sm:px-8`.
- Heading: `<h2 id="showcase-title" data-reveal className="text-balance text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">Our work</h2>`
- Body: `<p data-reveal className="mt-3 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground">` with one sentence, for example: "Recent things we have built, designed and shipped for klndr."
- Layout choice: read `SHOWCASE_LAYOUT`. In **dev only**, also read `new URLSearchParams(window.location.search).get("showcase")` and use it if it is one of the five valid names. Map the name to a component (`grid` → `GridLayout`, etc.) and render it with `items={showcaseItems.slice(0, 6)}`.
- Use `import.meta.env.DEV` to gate the query override. Validate the query value against the five names. Fall back to `SHOWCASE_LAYOUT` for anything else.

**Task 0.4: wire into the homepage.** In `apps/web-react/src/routes/index.tsx`, import `ShowcaseSection` from `@/components/landing/showcase/ShowcaseSection` and render `<ShowcaseSection />` between `<LandingFeatures />` and `<LandingCta start={start} signedIn={signedIn} />`.

**Phase 0 check:** run `npm run typecheck` in `apps/web-react`. It must pass. Then run `npm run dev` and open `/`. The "Our work" section should show the grid layout (placeholder, since the grid is not written yet, so render a temporary `<div>` in `ShowcaseSection` and note it; Phase 1 replaces it).

---

## 5. Phase 1: the five layouts

Each layout is independent. They can be built in parallel. Each must follow sections 2 and 3, use `ShowcaseThumb`, and work at 375px width and 1280px width, in light and dark mode.

### Layout 1: Grid (`GridLayout.tsx`)

Clean, even card grid. The safest choice.

- Container: `grid gap-5 sm:grid-cols-2 lg:grid-cols-3`.
- Each card: `group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xs`.
- Inside: `ShowcaseThumb` on top, then `p-5` with the title (`text-base font-semibold text-foreground`), summary (`mt-1.5 text-sm leading-relaxed text-muted-foreground`), and category as a small pill (`rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground`) at the top of the body.
- If `href` is set, wrap the card in `<a>`. If not, use a `<div>`.
- Each card: `data-reveal` with a stagger via `[--reveal-delay:...]` (`0ms`, `80ms`, `160ms`, ...). Use the existing `data-reveal` pattern from `LandingMarquee.tsx`.

**Done when:** three columns on desktop, two on tablet, one on phone. No horizontal scroll at 375px.

### Layout 2: Featured (`FeaturedLayout.tsx`)

One large lead item with a compact list beside it. Looks editorial.

- Grid: `grid gap-6 lg:grid-cols-5`.
- Lead card (first item): `lg:col-span-3`. Thumbnail on top, large title (`text-2xl font-semibold tracking-tight`), summary, and category pill.
- Right column (`lg:col-span-2 flex flex-col divide-y divide-border`): the remaining items as rows. Each row: a small `ShowcaseThumb` (use a fixed width `w-28 shrink-0`, with the `aspect-[16/10]` still applied), then the title and summary beside it.
- Phone: stacks in one column. Lead card first, then rows.

**Done when:** on desktop the lead card is roughly 60% wide. On phone there is no horizontal scroll, and the rows keep their thumbnails.

### Layout 3: Strip (`StripLayout.tsx`)

A single horizontal row of cards that the user scrolls. Compact and modern.

- Scroll container: `-mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-4 sm:-mx-8 sm:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`.
- Each card: `w-[80vw] shrink-0 snap-start sm:w-[22rem]`, using the same card style as Layout 1.
- Add two round buttons (previous and next) above the strip, right-aligned. Use `ChevronLeft` and `ChevronRight` from `lucide-react`. Each button scrolls the container by one card width with `scrollBy({ left: ±cardWidth, behavior: "smooth" })`. Use a `useRef` for the container. Give each button an `aria-label`.
- Use `motion-reduce:scroll-auto` on the smooth scroll.

**Done when:** cards swipe on phone and scroll with the buttons on desktop. No visible scrollbar. The last card can be reached.

### Layout 4: Alternating rows (`AlternatingLayout.tsx`)

Each item is a full-width row. The thumbnail alternates left and right. Feels like a portfolio.

- Stack: `flex flex-col gap-16 sm:gap-24`.
- Each row: `grid items-center gap-8 md:grid-cols-2`. For odd items add `md:[&>*:first-child]:order-last` (or set the order directly), so the thumbnail alternates.
- Text side: category pill, title (`text-2xl sm:text-3xl font-semibold tracking-tight`), summary (`text-base leading-relaxed text-muted-foreground`), and an optional link with `ArrowRight` (`text-sm font-medium text-foreground`) if `href` is set.
- Thumbnail side: `ShowcaseThumb`, `rounded-2xl`, with `shadow-[0_24px_48px_-24px_rgb(15_23_42/0.25)] dark:shadow-[0_24px_48px_-24px_rgb(0_0_0/0.6)]`.
- Each row: `data-reveal`.

**Done when:** the thumbnail side alternates on desktop. On phone, every row stacks with the thumbnail above the text.

### Layout 5: Filter gallery (`FilterLayout.tsx`)

A category filter above a grid. Practical and interactive.

- Filter bar: buttons for `All` plus each unique `category` from the items. Build the list with `Array.from(new Set(items.map(i => i.category)))`. Use `role="tablist"` / `role="tab"` with `aria-selected`, or plain buttons with `aria-pressed`. Pick one and stay consistent.
- Active chip: `bg-foreground text-background`. Inactive chip: `border border-border text-muted-foreground hover:bg-accent`. Chips: `rounded-full px-4 h-9 text-sm`.
- Grid: same as Layout 1 (`grid gap-5 sm:grid-cols-2 lg:grid-cols-3`). Filter with `useState<string>("All")`.
- If the filter leaves no items, show one line: "Nothing in this category yet."
- Do not animate with heavy libraries. A plain re-render is enough.

**Done when:** each chip filters the grid, "All" restores everything, and the selected chip is visible in both themes.

---

## 6. Phase 2: compare and choose

1. Start the dev server (`npm run dev` in `apps/web-react`, or use the preview tool with the existing `.claude/launch.json`).
2. Open `/?showcase=grid`, `/?showcase=featured`, `/?showcase=strip`, `/?showcase=alternating`, `/?showcase=filter`. Check each one.
3. For each layout, check: 375px width (phone), 1280px width (desktop), light mode, dark mode. Confirm no horizontal page scroll and that every thumbnail is visible (fallback counts as visible).
4. Take one screenshot per layout (desktop) and show them to the user. Ask which one to keep.

Do not pick a layout on the user's behalf. Phase 2 ends with the question.

---

## 7. Phase 3: finish the chosen layout

After the user picks one (say `<name>`):

1. Set `SHOWCASE_LAYOUT = "<name>"` in `showcase-data.ts`.
2. Delete the four unused layout files in `layouts/`.
3. Keep the `?showcase=` override only if the user wants it. Otherwise remove it from `ShowcaseSection.tsx` and the `ShowcaseLayoutName` union should only list the kept name.
4. Remove the temporary placeholder from Task 0.3 if one remains.
5. Run `npm run typecheck` and `npm run lint` in `apps/web-react`. Both must pass with no new errors.
6. Check `/` once more at 375px and 1280px, light and dark.
7. Do not commit. Tell the user the changed file paths.

---

## 8. Thumbnail images (optional, can be done later)

The fallback in section 3 already keeps the layout clean without images. When real images are ready:

1. Save each as `apps/web-react/public/showcase/<slug>.webp`, 1600 x 1000 px, under 300 KB each.
2. Add `thumbnail: "/showcase/<slug>.webp"` to that item in `showcase-data.ts`.
3. Reload `/` and confirm the image shows. If it does not, the fallback should appear. Confirm that.

Screenshot source: take them from the running app (for example the planner mock or a real day view) at 1600 x 1000. Use the user's own screenshots only.

---

## 9. Acceptance checklist (final)

- [ ] "Our work" heading appears on `/` between Features and the final call to action.
- [ ] Exactly one layout ships. The other four are deleted.
- [ ] Every card shows a thumbnail, either a real image or the fallback. No broken-image icons.
- [ ] No horizontal page scroll at 375px.
- [ ] Looks right in light and dark mode.
- [ ] Keyboard focus is visible on links and buttons (`focus-visible:ring-2 ring-ring`).
- [ ] `npm run typecheck` and `npm run lint` pass in `apps/web-react`.
- [ ] No files changed outside `apps/web-react/` and `docs/homepage-showcase/`.
- [ ] Nothing committed.

---

## 10. Handoff notes for the smaller model

- Work one task at a time. Finish and check it before starting the next.
- If a file you need is missing or a name differs from this plan, search with Grep before creating a duplicate.
- If a Tailwind class does not exist in this project, use the nearest existing class from the landing files. Do not add new CSS unless the task says so.
- If you are unsure whether something is in scope, do not do it. Write a note in the final message instead.
- Report back with: which tasks are done, which checks passed, and anything that failed (with the error text).
