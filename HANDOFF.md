# Handoff: where to pick up

## Latest continuation — 2026-10-04 (Codex, then the R.5/R.6 session)

The historical handoff below describes the committed baseline. The current checkout also has the
R.3 extraction, the mobile Day tab and task editor, shared editor/timeline undo, reconnect handling, the
R.4 `apps/web-react` scaffold, **all of R.5, and R.6's deletion**: `apps/web` (Nuxt 3 + Vue) is gone from
the repo, `apps/web-react` draws the entire product, and the root scripts point at it. The planner's logic
is `@klndr/data`'s hooks; the components only render.

Verification after the delete: `npm install` pruned the workspace, a sweep finds no `.vue` file and no
vue/nuxt dependency in any manifest, and typecheck (six workspaces) + 565 tests + the production build all
pass with `apps/web` gone. What is *not* verified anywhere is anything rendered in a browser or on a
device — no `apps/web-react` screen has ever been opened. Native interactive acceptance is pending; 2.3
checklist/notes is next on the mobile side, and the owner's API deploy is the only work left in R.6.
CHECKPOINT B remains open.

Written 2026-10-04 at the end of a session on the owner's Windows machine, for an AI assistant (and the owner)
continuing on another device. Read this first, then the four files it points to. Everything here was true of
branch `feat/react-web` at the commit that added this file; if the code disagrees, trust the code and fix this.

Start a new session with something like:

> Read HANDOFF.md, then docs/mobile-port/PLAN.md (Phase R), PROGRESS.md (the latest sessions), DECISIONS.md (the
> R.* entries) and HUMAN_TODO.md. Run the verification baseline. Then continue with the next open item.

## 1. The project and the goal

**klndr** (product name DayForge) is a daily time-block planner: a month calendar plus a half-hour day timeline you
drag activities onto. See `PRODUCT.md` and `DESIGN.md`. Backend: Firebase Auth, Firestore (rules in
`firestore.rules`), and a small REST API.

The owner's goals, which every decision below serves:
- keep the architecture and the code clean;
- reuse as much as possible between web and mobile;
- while the **mobile app has its own custom design** and uses the latest native UI/UX (so views are *not* shared).

The app started as Vue/Nuxt, which made a mobile port painful. The agreed direction: **React web app + Expo (React
Native) mobile app + shared TypeScript logic, data hooks and design tokens**, with the Nuxt app kept in production
until the React one reaches parity, then retired. Sharing stops at views, on purpose.

## 2. Where things stand

Branch: `feat/react-web`, based on `feat/mobile-app` (which was never merged to `main` and has no PR). It contains all
of `feat/mobile-app`'s history, so pulling this one branch is enough. `main` is behind and untouched.

| Done | What |
|---|---|
| Phase 0 | npm workspaces; `@klndr/core` (framework-free logic, 264 tests); `@klndr/tokens` (design tokens, 41 tests); store compliance (account deletion, Apple sign-in on web, privacy pages) |
| Phase 1.1-1.3 | Expo app shell, design system (Uniwind + tokens), auth (email, Google, Apple) with the auth gate and four placeholder tabs. Ran on the owner's iPhone as a dev build |
| **R.1** | `apps/api` (`@klndr/api`): the server moved out of Nuxt into a Hono app; Nuxt still serves `/api/**` through one catch-all that forwards to it. 93 tests |
| **R.2 (= task 1.4)** | `packages/data` (`@klndr/data`): TanStack Query hooks, optimistic mutations with rollback, undo, notes saver, device cache. Wired into the Expo app. 127 tests |
| **R.3** | The timeline's pure interaction maths moved into `@klndr/core`; the Vue components call it, behaviour unchanged |
| **R.4** | `apps/web-react` scaffold: Vite 8 + React 19 + TanStack Router + Tailwind v4 on `@klndr/tokens`; Firebase JS auth through core's `loadOrCreateProfile`; `@klndr/data` mounted once auth has settled; `/api` proxied to `apps/api` in dev. Screens are placeholders (R.5) |

| Next | What |
|---|---|
| **R.5** | Port the screens, page by page. **Done, and the port is complete** (2026-10-04): chrome, auth, the static pages, calendar, profile, landing page, and the whole day planner — `CategorySelect`, `ActivityForm`, `LibraryPanel`/`LibraryModal`, the activity palette, `TaskEditor`, `DayTimelineGrid` (the R.3 maths), `DayPlanner` with its header / routines shelf / mobile nav, and the route shell. Everything is driven by `@klndr/data`'s hooks, so the components render and nothing else. **Not verified: what any of it looks like** — no browser has been opened against a running app |
| R.6 | Retire Nuxt (`apps/web`). **The app is deleted from the repo** (2026-10-04): the React app draws the whole product, so nothing was left behind. **What remains is the owner's deploy** — `apps/api` (Cloud Run `klndr-api` + Firebase Hosting rewrites, in HUMAN_TODO.md). A deployed Nuxt release keeps serving as it is, but it can no longer be rebuilt from this repo; see PLAN.md and DECISIONS.md |
| Mobile 2.x | Checklist and notes sheets, calendar, library, settings, polish. Then Phase 3 (offline-first Firestore mode) and 4 (reminders, deep links, icons, store release) |

The mobile tabs are still placeholders (`apps/mobile/src/app/(tabs)/*.tsx` render `PlaceholderTab`), so **no screen
uses the data hooks yet**.

## 3. Get running on a new machine

```bash
git fetch origin
git switch feat/react-web
npm install            # once, at the repo root (npm workspaces)
```

Not in git, so copy or recreate by hand (see `docs/mobile-port/HUMAN_TODO.md`):
- `apps/web-react/.env`: the Firebase web config (`apps/web-react/.env.example` lists the names; the values are in the
  Firebase console, or `firebase_get_sdk_config`). Not needed to build or run it: without it the app skips its auth
  gate and runs in a credential-free dev mode with in-memory data for a `local-dev` user, which is enough for most work.
- `apps/api/.env`: `FIREBASE_PROJECT_ID` (`apps/api/.env.example`). Leave it empty for the in-memory dev mode; set it
  to `klndr-app` whenever the web app has a Firebase config, or signed-in requests are never verified and never reach Firestore.
- `apps/mobile/.env` (`apps/mobile/.env.example`) and the Firebase native config files `google-services.json` and
  `GoogleService-Info.plist` in `apps/mobile/`. Both are gitignored. Only needed for real sign-in and store builds;
  `EXPO_PUBLIC_DEMO_MODE=1` runs the app without them against the web server's dev data.

Use a recent Node (development used Node 24): the API's dev scripts load their `.env` with `--env-file-if-exists`, which older Node versions lack (it is in Node 22.9+; not checked on anything older than 24). iOS builds cannot be
prebuilt on Windows; use EAS or a Mac. The development build on the owner's iPhone still works, because no native
dependency was added since it was built.

Run things (all from the repo root):

| Command | What |
|---|---|
| `npm run dev` | React web app on :5173 (proxies `/api` to :3001, so run `dev:api` too) |
| `npm run dev:api` | the API alone on :3001, in-memory data without `FIREBASE_PROJECT_ID` |
| `npm run start -w apps/mobile` | Expo dev server |
| `npm run lint` | ESLint (`react-hooks` rules) over `apps/web-react` |
| `.claude/launch.json` | named configs `web-react`, `web-react-demo` (no Firebase, on :5174), `api`, `mobile` for the Claude desktop app's preview tools |

## 4. Verification baseline

Run these before changing anything, and again before reporting anything done.

```bash
npm run typecheck     # six workspaces: web-react, api, mobile, core, data, tokens. Expect exit 0
npm run lint          # apps/web-react. Expect no output
npm test              # core 301, data 130, api 93, tokens 41 (565 total). Expect all passing
npm run build -w apps/web-react  # optional, fast. Typecheck, then Vite into dist/
```

For anything touching `apps/mobile` or a shared package it imports, also prove Metro can bundle it:
`npx expo export --platform android --output-dir <somewhere outside the repo>` (and `--platform ios`). Add
`--source-maps` to check what actually got bundled. Last checked: both bundle, exactly **one** React copy
(`apps/mobile/node_modules/react`, 19.2.3), no react-dom, no `@klndr/api`, no test tooling.

## 5. Repo map

```
apps/
  api/       Hono REST API (createApp(config).fetch). src/db.ts has the Firestore + in-memory stores
  mobile/    Expo SDK 57, Expo Router, Uniwind. src/data/ wires @klndr/data. Screens are still placeholders
  web-react/ React SPA (Vite, TanStack Router, Tailwind v4 on the tokens) and **the whole web app**: the
             Nuxt one (`apps/web`) was deleted in R.6 (2026-10-04)
packages/
  core/      framework-free TS: types, time, layout (lane/overlap), colors, categories, validation, profile,
             markdown, API client (createApiClient), Store interface, TimelineHistory (undo engine)
  data/      @klndr/data: TanStack Query hooks and mutations over core's API client (needs react + react-query)
  tokens/    design tokens: themes, scales, resolved palette. generated/ files are checked in and tested
docs/mobile-port/   PLAN.md (checklist), PROGRESS.md (log), DECISIONS.md, HUMAN_TODO.md
firestore.rules, firebase.json   at the root
```

Workspace packages ship TypeScript **source** (no build step); each consumer compiles them (Nuxt via
`build.transpile`, Metro via `metro.config.js`, Vite and Vitest directly).

## 6. R.3 in detail (done — kept as the reference for what moved)

Goal: the Vue components currently mix *interaction maths* (pure) with *input plumbing* (DOM pointer events, rAF,
scroll containers). Move the pure part into `@klndr/core` with tests, call it from the Vue components so behaviour
is unchanged, and so the React and mobile views can use it. Mobile 2.1 requires the formulas "bit for bit".

Already in core: `SLOT_MINUTES` 30, `SNAP_MINUTES` 15, `SLOT_HEIGHT` 48 (`types.ts`); `snapMinutes`, `floorMinutes`
(`time.ts`); `layoutDay`, `columnsBeside`, `lanesFor`, `withLanes`, `boxOf` (`layout.ts`).

To extract (find them by name; line numbers drift):
- `apps/web/components/day-planner/DayTimelineGrid.vue`:
  - `updateDrag`: a held block's top edge is `pointerMinutes - grabMinutes`, clamped to `[0, 1440 - duration]`, then
    snapped to 15 minutes without passing the last whole step; `fraction` = how far across the grid the pointer is.
  - `dragPlan` / `changedLanes`: the column the block lands in is `floor(fraction * (beside.length + 1))` among
    `columnsBeside(...)`, then `lanesFor` / `withLanes` / `layoutDay`; lanes are only saved if someone's column changed.
  - `edgeScrollTick`: auto-scroll speed within `EDGE_SCROLL_ZONE` (72 px) of the scroller's edge, up to
    `EDGE_SCROLL_MAX` (16 px per frame).
  - the thresholds `TOUCH_HOLD_MS` 300, `TOUCH_SLOP` 10, `MOUSE_SLOP` 4.
  - block geometry: `blockTop`, `blockHeight` (`MIN_BLOCK_HEIGHT` 16), `isShort`, `titleLines`, `hasGrip`.
  - `onBlockKeydown`: keyboard move by one snap step, clamped to the day.
  - `updateHover`: the quarter hour under the cursor, and when no ghost block is shown.
- `apps/web/components/DayPlanner.vue`: `minutesFromEvent` (y to minutes), `startResize` and its `snapDuration`
  (resize in 15-minute steps, at least 15, up to midnight), `scrollToUsefulPosition`, `GRID_HEIGHT`.

Method that worked for R.1 and R.2: write the pure functions in core, pin today's behaviour with unit tests
*before* swapping the Vue code over, then swap and confirm the web app still behaves (use the `demo` config and
drive the day page). Keep the old behaviour; if you find a bug, note it in DECISIONS.md rather than silently fixing.

After R.3 came R.4, which is done: `apps/web-react` exists with file-based TanStack Router routes (`_authed` is
the guard, the generated tree is checked in), Firebase JS auth through core's `loadOrCreateProfile`, `@klndr/data`
mounted only once auth has settled, and `/api` proxied to `apps/api` (:3001). R.5 is the port, page by page:
`apps/web/pages/*.vue` and `apps/web/components/**`, with the shared tokens and the `@klndr/data` hooks
underneath. Chrome, auth, the static pages, the calendar, the profile and the landing page are done; **the day
planner is what is left**, and it is the large one — `DayPlanner.vue` plus the timeline grid, activity palette,
block editor, library, checklist and notes, about 5,000 lines of Vue across twenty components. The R.3 functions
above are what the React day timeline must call — "the React web view calls them too" is still an open box in
PLAN.md.

## 7. Decisions that are made (don't reopen without the owner)

Full reasoning is in `docs/mobile-port/DECISIONS.md`. The load-bearing ones:

- **Views are not shared.** Logic, data hooks and tokens are. Mobile keeps its own native design.
- **The API is a Hono app (`apps/api`)**, one implementation whether it runs inside Nuxt or standalone. It forwards the
  caller's Firebase ID token to Firestore, so `firestore.rules` is enforced and the server holds no admin
  credentials. Errors keep the shape `{ error, statusCode, statusMessage, message }`, which `createApiClient` reads.
  `allowDevUser` must stay `false` in production builds (it was verified compiled to `false`).
- **`@klndr/data` shape:** mutations are TanStack *options objects* (testable without React); hooks are thin wrappers;
  `useDayTimeline(day)` is the data half of the Vue day planner. React and react-query are **peer** dependencies,
  because the mobile app pins its own React and a second bundled copy crashes with "invalid hook call".
- **Optimistic vs waiting:** moving, resizing, ticking, deleting and adding from an activity are optimistic and roll
  back with a message; anything with a form waits for the server and throws its message. Task mutations share a
  TanStack `scope`, so they reach the server in the order they were made.
- **`DataProvider`'s `userId`: `null` means signed out and wipes the device cache.** Never mount it while auth is still
  `loading`, or every cold start erases the cache. `AppDataProvider` (mobile) renders nothing until auth settles.
- **Device cache** is keyed to the person (buster `version:userId`) so one person's data is never shown to another.
  Bump `CACHE_VERSION` when a cached shape changes.
- **Not done on purpose:** zod/schema validation on the API (kept behaviour identical), refetch on reconnect (needs a
  native network module, so a new dev build), CORS (same origin through Nuxt or a dev proxy; add if web and API ever
  live on different origins), Phase 3 offline mode.
- **The React web app (R.4).** File-based TanStack Router routes; `routeTree.gen.ts` is generated and checked in
  (like `packages/tokens/generated`). The router mounts only once auth has settled, and `AuthState.loading`
  therefore happens exactly once, so a later sign-in never unmounts it. `_authed` is the old
  `middleware/auth.global.ts`; `unavailable` (no Firebase config) means credential-free development. CORS is not
  needed: the app only ever calls its own origin (`/api` is proxied in dev, served behind the app in production).
  Auth reuses core's profile and message helpers, so no wording is duplicated. No cache persister on the web.

## 8. Gotchas that cost time

- **A bare `firebase deploy` now publishes the website, not just Firestore and Auth.** `firebase.json` has
  a `hosting` block as of R.6 (2026-10-04) that serves `apps/web-react/dist` — which *is* the product now,
  but whose API has not been deployed yet. Follow the order in HUMAN_TODO.md (`--only firestore:rules` /
  `--only firestore:indexes` / `--only auth` until then); `firebase hosting:rollback` undoes a slip.
- **A workspace can build against a package it does not declare, until the workspace that does is deleted.**
  npm hoists a dependency to the repo-root `node_modules` as soon as *any* workspace names it. So
  `apps/web-react/src/lib/emojis.ts` importing `emojibase-data` worked for as long as `apps/web` declared it
  — and `npm ci` after `git rm -r apps/web` would have failed to build the React app, *after* the delete was
  committed. Found and fixed 2026-10-04 (`apps/web-react` now declares `emojibase-data@^17.0.0`). Before any
  similar delete, check for imports that resolve only by hoisting.
- **Windows line endings.** Git for Windows has `core.autocrlf=true`, so the working tree is CRLF and git warns "LF
  will be replaced by CRLF". Normal. `.gitattributes` pins only the byte-compared token files to LF. With CRLF files,
  multi-line edit matches can fail: anchor on one line. Don't "fix" the warnings.
- **Smart App Control** on that machine blocks Nuxt's pinned `oxc-parser@0.143.0` native binary; the root `overrides`
  pin `0.144.0`. `npm install` may print an EPERM cleanup warning for `@oxc-parser`. Harmless. Don't remove the pin
  casually. NVM also tripped it; the owner uses a Node installer from nodejs.org. `rolldown` is pinned the same way
  (`overrides`, 1.2.11): Vite 8 asks for `~1.2.11` and 1.2.12 crashes `nuxt prepare`. Both pins were **kept** at
  R.6 even though Nuxt is gone: the `oxc-parser` one is about the native binary this machine blocks, and Vite 8
  also goes through rolldown/oxc, so lifting them would risk installs for no gain.
- **`git checkout -- <file>` is dangerous after `git mv`.** It restores the *staged* (old) content and silently throws
  away unstaged edits. When trying a mutation on a file, back it up with `cp` and restore with `cp`.
- **TanStack tells React about cache changes a tick later.** In hook tests assert with `waitFor`, not right after `act`.
- **A test that passes first time proves little.** For new logic, break it on purpose and confirm the right test fails
  (done for R.1 and R.2; see PROGRESS.md).
- **Shell:** the Bash tool's working directory persists between calls (use absolute paths); very large heredocs with
  mixed quotes can fail to parse (write the file with the editor tool, then `cat >>`); Python is not installed.
- **Two React copies exist in `node_modules`** (root 19.3.0 via transitive deps, `apps/mobile` pins 19.2.3). Metro is
  configured so mobile always uses its own. Don't add `react` to a shared package's `dependencies`. Vite resolves
  `apps/web-react`'s `react` to the hoisted 19.3.0, which satisfies `@klndr/data`'s `^19.2.3` peer.

## 9. What is verified and what is not

Verified (and how): typecheck across six workspaces and 565 tests; the API over real HTTP and as a production bundle
(fail-closed); Android and iOS JS bundles including the data package; rollbacks, ordering and per-user cache isolation
by tests that run the real API in memory; the `apps/web-react` production build and, in dev, `/api/health` answering
through the Vite proxy. The R.6 deletion was verified after the fact: `npm install` pruned the workspace, the lockfile
no longer names it, a sweep finds no `.vue` file and no vue/nuxt dependency in any manifest, and typecheck + the 565
tests + the production build all pass with `apps/web` gone.

**Not verified:** anything rendered in a browser or on a physical device — no `apps/web-react` screen has ever been
opened, so the whole port (the landing page, the calendar, the profile, and every part of the day planner) rests on
the compiler, the tests and the build. On the device side: anything since task 1.3 (see `HUMAN_TODO.md`: the cache
across a relaunch, no flash on cold start, sign-out emptying the cache, and the earlier sign-in checks); the Firestore
code path with real tokens and rules (the stores moved unchanged; Task 3.2's emulator tests need Java); `useProfile`
against real Firestore.

## 10. Working with the owner

- Ask before committing, pushing, deleting or anything outward-facing. They said "commit and push" for this handoff;
  that approval does not carry to later work.
- Report outcomes faithfully: say what failed, what you did not verify, what you assumed. Prefer evidence (a run, a
  test, a bundle inspection) over assertion.
- Keep the code clean and match the surrounding style (comments explain *why*; conventional commit prefixes such as
  `feat(core):`, `refactor(web):`, `chore:`, `docs:`; commits end with the Co-Authored-By trailer in use).
- Log work in `docs/mobile-port/`: tick `PLAN.md`, add a `PROGRESS.md` session, record non-obvious choices in
  `DECISIONS.md`, and put things only the owner can do in `HUMAN_TODO.md`.
- The owner wants recommendations, not option surveys.

## 11. Open questions for the owner

- Where `apps/api` is deployed: answered and configured (Cloud Run `klndr-api` + Firebase Hosting rewrites). What is
  left is running the deploy — HUMAN_TODO.md, Phase R.
- When to add `expo-network` (reconnect refetch), which needs a new development build.
- Placeholders still to fill: privacy-policy and account-deletion pages (`[COMPANY LEGAL NAME]`, `[CONTACT EMAIL]`,
  `[DATE]`), the iOS bundle id (`com.klndr.app`), Apple Services ID and keys. All in `HUMAN_TODO.md`.
