# Handoff: where to pick up

Written 2026-10-04 at the end of a session on the owner's Windows machine, for an AI assistant (and the owner)
continuing on another device. Read this first, then the four files it points to. Everything here was true of
branch `feat/react-web` at the commit that added this file; if the code disagrees, trust the code and fix this.

Start a new session with something like:

> Read HANDOFF.md, then docs/mobile-port/PLAN.md (Phase R), PROGRESS.md (sessions 8 and 9), DECISIONS.md (the
> R.* entries) and HUMAN_TODO.md. Run the verification baseline. Then continue with R.3.

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

| Next | What |
|---|---|
| **R.3** | Move the timeline's pure interaction maths into `@klndr/core` (section 6). Also what mobile task 2.1 needs |
| R.4 | Scaffold `apps/web-react` (Vite, React, TanStack Router, Tailwind v4 on `@klndr/tokens`) |
| R.5 | Port the screens, page by page, against the Nuxt app |
| R.6 | Retire Nuxt (`apps/web`), deploy `apps/api`, point `EXPO_PUBLIC_API_BASE_URL` at it |
| Mobile 2.x | Day tab (the centerpiece), task editor, checklist and notes sheets, calendar, library, settings, polish. Then Phase 3 (offline-first Firestore mode) and 4 (reminders, deep links, icons, store release) |

The mobile tabs are still placeholders (`apps/mobile/src/app/(tabs)/*.tsx` render `PlaceholderTab`), so **no screen
uses the data hooks yet**.

## 3. Get running on a new machine

```bash
git fetch origin
git switch feat/react-web
npm install            # once, at the repo root (npm workspaces)
```

Not in git, so copy or recreate by hand (see `docs/mobile-port/HUMAN_TODO.md`):
- `apps/web/.env`: Firebase web config (`apps/web/.env.example` lists the names). Without it the web app and API run
  in a credential-free dev mode with in-memory data for a `local-dev` user, which is enough for most work.
- `apps/api/.env`: optional (`apps/api/.env.example`).
- `apps/mobile/.env` (`apps/mobile/.env.example`) and the Firebase native config files `google-services.json` and
  `GoogleService-Info.plist` in `apps/mobile/`. Both are gitignored. Only needed for real sign-in and store builds;
  `EXPO_PUBLIC_DEMO_MODE=1` runs the app without them against the web server's dev data.

Use a recent Node (development used Node 24): the API's dev scripts load their `.env` with `--env-file-if-exists`, which older Node versions lack (it is in Node 22.9+; not checked on anything older than 24). iOS builds cannot be
prebuilt on Windows; use EAS or a Mac. The development build on the owner's iPhone still works, because no native
dependency was added since it was built.

Run things (all from the repo root):

| Command | What |
|---|---|
| `npm run dev` | Nuxt web app on :3000 (serves `/api` itself) |
| `npm run dev:api` | the API alone on :3001, in-memory data without `FIREBASE_PROJECT_ID` |
| `npm run start -w apps/mobile` | Expo dev server |
| `.claude/launch.json` | named configs `dev`, `demo` (Nuxt without Firebase), `api`, `mobile` for the Claude desktop app's preview tools |

## 4. Verification baseline

Run these before changing anything, and again before reporting anything done.

```bash
npm run typecheck     # six workspaces: web, api, mobile, core, data, tokens. Expect exit 0
npm test              # core 264, data 127, api 93, tokens 41 (525 total). Expect all passing
npm run build -w apps/web   # optional, ~1.5 min. Expect "Build complete!"
```

For anything touching `apps/mobile` or a shared package it imports, also prove Metro can bundle it:
`npx expo export --platform android --output-dir <somewhere outside the repo>` (and `--platform ios`). Add
`--source-maps` to check what actually got bundled. Last checked: both bundle, exactly **one** React copy
(`apps/mobile/node_modules/react`, 19.2.3), no react-dom, no `@klndr/api`, no test tooling.

## 5. Repo map

```
apps/
  web/       Nuxt 3 + Vue app. Production web app until R.6. server/api/[...].ts forwards /api to apps/api
  api/       Hono REST API (createApp(config).fetch). src/db.ts has the Firestore + in-memory stores
  mobile/    Expo SDK 57, Expo Router, Uniwind. src/data/ wires @klndr/data. Screens are still placeholders
  web-react/ does not exist yet (R.4)
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

## 6. Next task in detail: R.3

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

After R.3: R.4. Notes for it: dev server proxies `/api` to `apps/api` (:3001); auth uses the Firebase **JS** SDK
through core's `loadOrCreateProfile` (`ProfileDb` port); pass `userId` and `notify` to `DataProvider`; mount
`DataProvider` only once auth has settled (see section 7).

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

## 8. Gotchas that cost time

- **Windows line endings.** Git for Windows has `core.autocrlf=true`, so the working tree is CRLF and git warns "LF
  will be replaced by CRLF". Normal. `.gitattributes` pins only the byte-compared token files to LF. With CRLF files,
  multi-line edit matches can fail: anchor on one line. Don't "fix" the warnings.
- **Smart App Control** on that machine blocks Nuxt's pinned `oxc-parser@0.143.0` native binary; the root `overrides`
  pin `0.144.0`. `npm install` may print an EPERM cleanup warning for `@oxc-parser`. Harmless. Don't remove the pin
  casually. NVM also tripped it; the owner uses a Node installer from nodejs.org.
- **`git checkout -- <file>` is dangerous after `git mv`.** It restores the *staged* (old) content and silently throws
  away unstaged edits. When trying a mutation on a file, back it up with `cp` and restore with `cp`.
- **TanStack tells React about cache changes a tick later.** In hook tests assert with `waitFor`, not right after `act`.
- **A test that passes first time proves little.** For new logic, break it on purpose and confirm the right test fails
  (done for R.1 and R.2; see PROGRESS.md).
- **Shell:** the Bash tool's working directory persists between calls (use absolute paths); very large heredocs with
  mixed quotes can fail to parse (write the file with the editor tool, then `cat >>`); Python is not installed.
- **Two React copies exist in `node_modules`** (root 19.3.0 via transitive deps, `apps/mobile` pins 19.2.3). Metro is
  configured so mobile always uses its own. Don't add `react` to a shared package's `dependencies`.

## 9. What is verified and what is not

Verified (and how): typecheck and 525 tests; the API over real HTTP, through Nuxt in dev, and as a production bundle
(fail-closed); Android and iOS JS bundles including the data package; rollbacks, ordering and per-user cache isolation
by tests that run the real API in memory.

**Not verified:** anything on a physical device since task 1.3 (see `HUMAN_TODO.md`: the cache across a relaunch, no
flash on cold start, sign-out emptying the cache, and the earlier sign-in checks); the Firestore code path with real
tokens and rules (the stores moved unchanged; Task 3.2's emulator tests need Java); `useProfile` against real
Firestore; a Vue hydration-mismatch warning in `AppHeader` on first load (in a component that was not touched; no
baseline was run to prove it pre-dates this work).

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

- Where will `apps/api` be deployed once Nuxt is retired (R.6)? Nothing changes until then.
- When to add `expo-network` (reconnect refetch), which needs a new development build.
- Placeholders still to fill: privacy-policy and account-deletion pages (`[COMPANY LEGAL NAME]`, `[CONTACT EMAIL]`,
  `[DATE]`), the iOS bundle id (`com.klndr.app`), Apple Services ID and keys. All in `HUMAN_TODO.md`.
