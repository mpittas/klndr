# Mobile port plan

Native iOS and Android apps for klndr (DayForge), built with Expo (React Native) while the
Nuxt web app in `apps/web` keeps working unchanged (until Phase R replaces it with a React app, decided
2026-10-03 after task 1.3). Tick each task as it finishes. Stop at
each CHECKPOINT and post a review summary.

Legend: `[ ]` todo, `[x]` done, `[~]` in progress / blocked.

## Phase 0 — groundwork (the web app keeps working)

### 0.1 Monorepo
- [x] Commit 1: pure `git mv` of the Nuxt app into `apps/web` (app.vue, nuxt.config.ts,
      assets, components, composables, lib, middleware, pages, plugins, server, utils,
      tsconfig.json, package.json, .env.example).
- [x] Commit 2: root `package.json` with npm workspaces, updated root `package-lock.json`,
      any fixes.
- [x] Keep at the root: firebase.json, .firebaserc, firestore.rules, firestore.indexes.json,
      PRODUCT.md, DESIGN.md, .agents/, agent/, skills-lock.json, .mcp.json.
- [x] Update `.claude/launch.json` so its configs still start the web app.
- [x] Acceptance: one `npm install` at the root works; web typecheck and build pass;
      `npm run dev -w apps/web` serves the same app.
- [x] Deviation logged: `oxc-parser` pinned to 0.144.0 (Smart App Control blocks the binary
      in the 0.143.0 package nuxt pins). See DECISIONS.md.
- [ ] HUMAN_TODO: move `.env` into `apps/web/`.
- [ ] HUMAN_TODO: if the web app is served by Firebase Hosting, point it at `apps/web`.

### 0.2 packages/core (@klndr/core)
- [x] Move: types and constants, time, layout.
- [x] Move: pure validation helpers and the profile model.
- [x] Move: color keys, labels and canonicalization (Tailwind classes stay in web).
- [x] Move: category helpers.
- [x] Move: emoji search and recents, behind an injected key-value storage interface.
- [x] Move: markdown, split into a parser (small AST) and an HTML renderer (byte-identical).
- [x] Move: API client as `createApiClient({ baseUrl, getToken })`.
- [x] Move: the `Store` interface and its types.
- [x] Move: undo/redo engine from useTimelineHistory as a plain class with `subscribe`
      (the Vue composable becomes a thin wrapper).
- [x] Nuxt (incl. the Nitro server build) compiles the TypeScript source; Metro must too.
- [x] Acceptance: web imports from `@klndr/core` and behaves the same.
- [x] Vitest: time, layout (layoutDay, columnsBeside, lanesFor, withLanes).
- [x] Vitest: markdown parity on fixtures, toggleTaskLine.
- [x] Vitest: validation.
- [x] Vitest: profile cleanPatch.
- [x] Vitest: the undo engine.
- [x] Also covered: colour canonicalization, the category helpers, emoji search and recents, and the
      API client (URL building, token, error mapping) — 10 suites, 251 tests.
- [x] Logged in DECISIONS.md: the markdown AST is by block and inline markup stays one ordered pass
      (so the HTML stays byte-identical), and what stayed in the web app as a thin adapter.

### 0.3 packages/tokens (@klndr/tokens)
- [x] Light and dark theme colors (exact values from apps/web/assets/css/main.css).
- [x] Radii, spacing and the type scale.
- [x] Every palette role in lib/colors.ts for all 12 colors (block, blockDone, chip, dot,
      accent, selected, ghost, icon, meta, check: background, border, text) as concrete sRGB
      for light and dark.
- [x] Resolve the palette: read Tailwind v4 oklch from tailwindcss/theme.css, apply alpha
      modifiers, compute `color-mix(in oklab, …)` exactly with culori.
- [x] Generate the CSS-variable blocks main.css imports, without changing any computed value.
- [x] Acceptance: tests pin a sample of resolved colors; the web's CSS variables are unchanged.
- [x] The theme data is the source of truth in `src/theme.ts`; `npm run generate -w packages/tokens`
      writes `generated/theme.css` (which main.css imports) and `generated/palette.ts` (the palette as
      data). Tests fail if either drifts, and `culori` is a devDependency only, so no app computes
      colours at runtime.
- [x] Logged in DECISIONS.md: Tailwind v4's oklch palette resolves to values that differ from the v3
      hexes (indigo-500 is #615fff, not #6366f1), and how a plain versus a `dark:` utility resolves.

### 0.4 Store compliance in the web app and server
- [x] Account deletion: "Delete account" section on the profile page (typed confirmation +
      re-authentication).
- [x] Account deletion deletes all user data (every subcollection under users/{uid}, the meta
      markers, then the profile doc), then the Auth user.
- [x] Data part as a `Store` method (MemoryStore + FirestoreStore) behind `DELETE /api/account`.
- [x] firestore.rules: owner may delete `users/{uid}` and `meta/*`; loosen nothing else.
- [x] Apple-linked accounts: revoke the Apple token on deletion.
- [ ] HUMAN_TODO: deploy the rules.
- [x] Public `/account-deletion` page (in-app steps + email request). Add to PUBLIC_PATHS.
- [x] Public `/privacy` page (draft policy, placeholders, marked DRAFT). Add to PUBLIC_PATHS.
- [x] Link both from the landing footer, the login page and the signup page.
- [x] Sign in with Apple on the web (Firebase OAuthProvider "apple.com") next to Google.
- [ ] HUMAN_TODO: Apple Services ID, key, and Firebase console setup.
- [x] The client deletes the Auth user — only the signed-in user may, and Firebase asks for a recent
      sign-in, which is why the flow re-authenticates first — and the API deletes the data.
- [x] Verified the deletion end to end against the dev store: seeded data, a written note and an
      extra checklist item, then `DELETE /api/account` left every collection empty. The Firestore
      path and the rules change are for a real project (see HUMAN_TODO, and 3.2 for the emulator).

### CHECKPOINT A
- [x] Stop and post a review summary: what moved, what changed in the web app, verification
      output, the HUMAN_TODO list. (Work ran on through 1.2 without stopping; the review was done
      afterwards, as the audit in PROGRESS.md session 7.)

## Phase 1 — mobile foundation

### 1.1 Create apps/mobile
- [x] `create-expo-app` (SDK 57, TypeScript, Expo Router). The template's demo screens, components
      and images were removed, and the package is `@klndr/mobile` inside the workspace.
- [x] app.config.ts: name "klndr", scheme "klndr", portrait, automatic light/dark.
- [x] app.config.ts: iOS bundle id + Android package from one constant (`BUNDLE_ID`), placeholder
      "com.klndr.app".
- [x] app.config.ts: Apple sign-in capability (`ios.usesAppleSignIn`), Android edge-to-edge — which
      SDK 57 turns on unconditionally, so the key no longer exists and the reason is a comment.
- [x] app.config.ts: typed env vars EXPO_PUBLIC_API_BASE_URL, EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      EXPO_PUBLIC_DEMO_MODE, EXPO_PUBLIC_DATA_MODE, read once through `src/env.ts` and listed in
      `.env.example` (`.env` is gitignored).
- [x] app.config.ts: Firebase native config file paths from env vars (GOOGLE_SERVICES_JSON,
      GOOGLE_SERVICES_INFO_PLIST). Both files are gitignored and are left out of the config when
      absent, so a checkout without them still starts (in demo mode).
- [x] eas.json: development (dev client, internal distribution), preview, production. Every profile
      pins `EXPO_PUBLIC_DATA_MODE=api`, so "api" stays the default (PLAN 3.4).
- [x] metro.config.js: the workspace root is watched and both `node_modules` trees form the
      resolution path, so Metro compiles `@klndr/core` and `@klndr/tokens` from TypeScript source —
      the acceptance task 0.2 left open. Proven below.
- [x] Acceptance: web typecheck still passes, unchanged; `@types/react` does not leak from the
      hoisted mobile dependencies.
- [x] Verified `npx expo export --platform android`: 1260 modules, 2.7 MB Hermes bytecode, and the
      source map lists all 12 `@klndr/core` and all 5 `@klndr/tokens` modules.
- [x] Deviation logged: the mobile tsconfig names its `types` explicitly ("expo/types" for the CSS
      and asset imports, "node" for app.config.ts), because the generated `expo-env.d.ts` is
      gitignored — see DECISIONS.md.
- [ ] HUMAN_TODO: confirm the bundle id before the first store build.
- [ ] HUMAN_TODO: `eas init` (needs an Expo account) before the first EAS build, and the Firebase
      native config files (`google-services.json`, `GoogleService-Info.plist`) for store builds.

### 1.2 Design system
- [x] Uniwind wired to @klndr/tokens. `packages/tokens` now generates a second artefact,
      `generated/uniwind.css`, from the same theme and scale data (Uniwind picks a theme by `@variant`,
      not by a `.dark` class), and `apps/mobile/src/global.css` imports Tailwind, Uniwind and that file.
      `metro.config.js` wraps the config with `withUniwindConfig`.
- [x] Theme preference (system/light/dark) persisted in MMKV, applied before the first frame.
- [x] Inter loaded via expo-font (the four weights the scale uses); tabular numerals through `Text`.
- [x] Primitives: Text (DESIGN.md type scale).
- [x] Primitives: Button (primary, secondary, ghost, destructive; 44px min height).
- [x] Primitives: IconButton, TextField, Switch, SegmentedControl, ListRow, Chip.
- [x] Primitives: Toast with an Undo action.
- [x] Primitives: ColorSwatch, EmptyState, Skeleton.
- [x] Sheets use Expo Router form-sheet presentation with detents (`formSheet()` in
      `components/ui/sheet.ts`, demonstrated by `app/sheet.tsx`).
- [x] Menus and date/time pickers use native controls: Expo UI's `Picker` (a SwiftUI menu / Material
      dropdown) inside its `Host`, and the community date/time picker handed the app's accent colour
      and the current scheme.
- [x] Every primitive: accessibility role and label (an icon-only button cannot exist without one),
      reduce-motion respected (Skeleton holds still), and large text left to work: no fixed heights,
      only `minHeight`.
- [x] Verified: the app bundles (`npx expo export --platform android`, 2148 modules); the stylesheet
      the tokens generate really does produce the utilities used (`bg-card`, `text-body`,
      `rounded-md`, `p-md`, `gap-sm`, semantic colours) with the values in both the class-based and the
      system-scheme paths; root typecheck, 294 tests and the web build all pass.
- [ ] HUMAN_TODO: try the design system on a device or simulator — theme switch and its persistence
      across a relaunch, sheet detents, the native menu and picker, dark mode, and the largest text
      size.

### 1.3 Auth
- [x] React Native Firebase auth with email/password and password reset.
- [x] Native Google sign-in (`@react-native-google-signin/google-signin`, ID token to Firebase).
- [x] Sign in with Apple on iOS (nonce flow, Apple's own button).
- [x] Apple sign-in on Android through Firebase's OAuth provider flow.
- [x] First sign-in creates users/{uid} exactly like loadProfile in useAuth.ts — both now call
      `newProfileData` / `loadOrCreateProfile` in `@klndr/core` (tested), instead of two copies.
- [x] Expo Router auth gate: signed-out stack vs the tabs (`Stack.Protected`, native tabs).
- [x] Demo mode (EXPO_PUBLIC_DEMO_MODE=1): no sign-in; API calls without a token.
- [x] Platform adapter: React Native Firebase (`src/auth/firebase.ts`). The planned `.web.ts` (Firebase JS SDK) was
      written, then removed before the first commit: the app ships on iOS and Android only (see DECISIONS.md).
- [x] Config plugins for RN Firebase, Google sign-in and Apple sign-in, added only when the Firebase
      config files exist (or on EAS, where a missing file must fail the build).
- [x] Verified: typecheck (all four workspaces), 265 core tests, Android and iOS bundles, the plugins
      applied by a real `expo prebuild --platform android` with dummy config files.
- [ ] HUMAN_TODO: try sign-in on a device — see HUMAN_TODO.md (Task 1.3).

### 1.4 Data  (decided 2026-10-03: written once in `packages/data`, see R.2, and shared with the React web app)
- [x] TanStack Query hooks over the core API client (day tasks, range tasks, templates,
      categories, checklist items, day checklist, day notes, profile).
- [x] Optimistic mutations matching DayPlanner.vue (temp ids, rollback, toasts).
- [x] Query cache persisted in MMKV.
- [x] Refetch on foreground (`src/data/focus.ts`) and on reconnect (`src/data/online.ts`, expo-network).
      The native module is included in the successful local iOS simulator build; device reconnect checks remain.

## Phase 2 — screens

### 2.1 Day tab (centerpiece)

Implementation and automated checks are done; native gesture/visual acceptance is pending (HUMAN_TODO).
- [x] Header: date title (tap → date picker sheet), Today, prev/next, undo/redo.
- [x] Swipe horizontally between days; routines shelf above the timeline.
- [x] Geometry: SLOT_MINUTES 30, SLOT_HEIGHT 48, SNAP_MINUTES 15, bit-for-bit formulas.
- [x] Short-block and two-line rules; hour gutter; now-line with a live pill (every 30 s).
- [x] On open, scroll to the first block (or 07:00).
- [x] Tap empty grid → task editor at the 15-minute slot.
- [x] Tap a block → edit; tap its ring → toggle done.
- [x] Long-press 300 ms → lift (scale 1.02, shadow, medium haptic).
- [x] Drag: follow finger, snap to 15 min, selection haptic on snap change.
- [x] Drag: horizontal picks the column via core layout functions; neighbours animate aside.
- [x] Drag: start/end times in the gutter; 72px edge auto-scroll, up to 16px/frame.
- [x] Drag: release → optimistic save + undo entry.
- [x] Resize from the bottom edge in 15-min steps (min 15, up to midnight), haptics + label.
- [x] Only discrete changes cross to the JS thread; nothing re-renders every frame.
- [x] Accessibility: announce title + time range; actions to move/lengthen/etc.
- [x] Unit-test geometry, snapping and lane planning.
- [ ] HUMAN_TODO: try the timeline on a device build.

### 2.2 Task editor sheet

Implemented and bundled for both platforms; native form/picker acceptance is pending (HUMAN_TODO).
- [x] Title, emoji (emoji picker sheet), category (native menu + "new category").
- [x] Start time and duration (native pickers, DURATION_CHOICES).
- [x] Notes and template quick-pick.
- [x] Save; delete with an undo toast.

### 2.3 Checklist and notes sheets
- [ ] Checklist: toggle, quick add (every day / only today), skip + restore, edit, delete.
- [ ] Notes: monospace editor, preview as native views from the core markdown parser,
      tappable task checkboxes (toggleTaskLine), same saving/error behavior as web.

### 2.4 Calendar tab
- [ ] Month grid with each day's first blocks and a "+N" overflow.
- [ ] Week start from the profile; swipe between months; jump-to-month picker.
- [ ] Tap a day → open it in the Day tab.

### 2.5 Library tab
- [ ] Categories with their activities, and search.
- [ ] Create/edit/delete activities.
- [ ] Create/rename/recolor categories.
- [ ] Delete a category with "move its activities to…" or "delete them too".

### 2.6 Settings tab
- [ ] Display name, timezone, week starts on Monday, default block duration.
- [ ] Theme, and reminder lead time (used in 4.1).
- [ ] Privacy policy link, sign out, and delete account (the 0.4 flow).

### 2.7 Polish
- [ ] Empty, loading (skeleton) and error states everywhere.
- [ ] Haptics only on meaningful actions.
- [ ] Keyboard avoidance in every sheet; no layout jumps.
- [ ] Correct in dark mode and at the largest text size.


## Phase 3 — offline-first data mode

### 3.1 Shared store logic
- [ ] Move server/utils/db.ts logic into @klndr/core as `createStore(db)`.
- [ ] Small document-database interface: get, query, batched commit with server timestamps.
- [ ] Adapters: REST client (server), in-memory (tests/dev), Firebase JS SDK (web),
      React Native Firebase (mobile).
- [ ] Server behavior unchanged; prove with core tests on the in-memory adapter.

### 3.2 Categories by id
- [ ] Add categoryId to templates and tasks (keep writing the name too).
- [ ] Resolve name and color by id, falling back to the name.
- [ ] Backfill existing docs lazily per user, behind a new meta marker.
- [ ] Update firestore.rules; write rules tests with @firebase/rules-unit-testing.
- [ ] HUMAN_TODO: run the rules tests (the emulator needs Java).

### 3.3 Mobile "firestore" mode
- [ ] React Native Firebase with offline persistence.
- [ ] Snapshot listeners feed the same TanStack Query cache.
- [ ] Writes apply locally at once; the UI never waits for the server.
- [ ] Subtle "Offline: changes will sync" indicator.

### 3.4 Keep "api" as the default in every build profile.

### CHECKPOINT B
- [ ] Stop and report the data-model changes, the rules diff, the test results, and exact
      steps to try "firestore" mode on a real account before switching the default.

## Phase 4 — store readiness

### 4.1 Local reminders (expo-notifications)
- [ ] Optional alert N minutes before each block, set in Settings.
- [ ] Schedule only the next 24–48 h; reschedule whenever blocks change.
- [ ] Ask for permission in context, not at launch.

### 4.2 Deep links
- [ ] klndr://day/YYYY-MM-DD and the web /day/YYYY-MM-DD and /calendar URLs.
- [ ] Add apple-app-site-association and assetlinks.json under apps/web/public/.well-known.
- [ ] HUMAN_TODO: Apple Team ID and the Android signing certificate SHA-256.

### 4.3 App icon and splash
- [ ] Generate from the calendar mark in nuxt.config.ts (SVG → PNG with sharp), including
      Android adaptive and monochrome icons.
- [ ] HUMAN_TODO: final artwork.

### 4.4 docs/mobile-port/RELEASE.md
- [ ] Apple App Privacy and Google Play Data safety answers derived from the code.
- [ ] Store listing drafts (name, subtitle, description, keywords, category, URLs).
- [ ] A screenshot list.
- [ ] App Review notes with a demo account. HUMAN_TODO: create the account.
- [ ] Exact EAS steps (dev builds, TestFlight, Play closed test, submission).

### CHECKPOINT C
- [ ] Final report.

## Phase R — the web app in React (decided 2026-10-03)

The Nuxt app is rewritten in React and then retired, so web and mobile share not only `@klndr/core`
and `@klndr/tokens` but also the data hooks. Only the views are written twice, on purpose: the mobile
app keeps its own native design. Nuxt stays the production web app until R.5 reaches parity.

### R.1 The API out of Nuxt (`apps/api`)
- [x] Move `apps/web/server` into `apps/api`, a Hono app: `createApp(config)` returns a fetch handler.
- [x] Routes rewritten one for one (tasks, templates, categories, checklist, notes, account, health);
      same URLs, bodies, status codes and error body (`error`, `statusCode`, `statusMessage`, `message`).
- [x] Firestore REST client, both stores (Firestore, in-memory) and the Firebase token check moved with it
      (`git mv`, history kept). The only Nitro-specific calls became a small `HttpError`.
- [x] Nuxt keeps serving `/api/**` through one catch-all (`apps/web/server/api/[...].ts`) that forwards to
      the same app, so nothing changes for the deployed web app or the mobile app's base URL.
- [x] Standalone Node entry: `npm run dev -w apps/api` (port 3001, tsx, in-memory without Firebase).
- [x] Tests (93): the token check with real signed tokens and a local key set (wrong issuer, audience, key,
      expiry, fail-closed), every route's success and refusal cases, and the `@klndr/core` API client driven
      against the app (every client method matches a route). Mutation-checked.
- [x] Verified: standalone over HTTP, through Nuxt in dev (calendar and day pages load), the production
      bundle has `allowDevUser` compiled to `false`, typecheck for all five workspaces.
- [ ] HUMAN_TODO: decide where `apps/api` is deployed before Nuxt is retired (R.6).

### R.2 Shared data hooks (`packages/data`)
- [x] TanStack Query hooks over the core API client (day tasks, range tasks, templates, categories,
      checklist items, day checklist, day notes, profile). This is task 1.4, written once.
- [x] Optimistic mutations matching DayPlanner.vue (temp ids, rollback, toasts) and the undo engine.
- [x] Persistence of the query cache is injected (`createKeyValuePersister`): MMKV on mobile, none on the web at first.
- [x] Hooks tested with the real API in memory behind `fetch` (127 tests): the mutations without React, the hooks with
      a renderer where React is the point (provider, undo wiring, notes, profile, per-user cache).
- [x] Wired into the Expo app: `AppDataProvider` under the auth gate, MMKV cache, refetch on foreground, toast as `notify`.
- [ ] HUMAN_TODO: check a cold start on the device (no flash, data from the last run shows at once) and sign-out wiping the cache.

### R.3 Timeline interaction maths in `@klndr/core`
- [x] Move the pure parts out of `DayTimelineGrid.vue` / `DayPlanner.vue` into `packages/core/src/timeline.ts`:
      position to minutes, grab offset, snapping, resize limits, the lane a drag lands in, edge-scroll speed,
      block geometry (top, height, one-line and two-line rules), where a day opens, nudges for the keyboard.
- [x] Unit tests (37): each function is also compared with the original Vue formula, copied verbatim, over a sweep
      of inputs; mutation-checked (three deliberate breaks, one of which first survived and got its own test).
- [x] The Vue components call them (behaviour unchanged, checked by dragging and resizing in the browser); the mobile
      timeline calls the same functions, from the UI thread (see DECISIONS.md, the `"worklet"` directive).
- [ ] The React web view calls them too (R.4/R.5).

### R.4 `apps/web-react` scaffold
- [x] Vite, React, TanStack Router, Tailwind v4 on `@klndr/tokens`, Firebase JS SDK auth through the same
      `@klndr/core` profile logic, `@klndr/data` for data. Proxy `/api` to `apps/api` in dev.
      Screens are placeholders (plus a minimal sign-in form so the gate can be exercised); R.5 is the port.

### R.5 Port the screens
- [~] Ported so far: the app chrome, sign-in/up, privacy, account deletion, the calendar, the profile,
      the landing page, and the day planner's leaves (checklist, notes, emoji picker, colour swatches,
      tooltip). Remaining: the rest of the day planner — the library, the activity palette, the block
      editor and the timeline grid, then `DayPlanner` itself. Parity still to be checked page by page
      in a browser against the Nuxt app.
- [x] Chrome and frame: `AppHeader.tsx` (logo, the Calendar/Today segmented toggle, the theme button, the
      profile chip and the no-Firebase banner) and the root frame's day-view scroll lock, both from `app.vue`.
- [x] Auth and static pages: `login.tsx` and `signup.tsx` (Apple + Google, the reset flow, the split card),
      `privacy.tsx`, `account-deletion.tsx` — wording unchanged, form checks and messages from `@klndr/core`.
- [x] Calendar: `MonthView` with its header, grid, sidebar and date navigator, reading the month through
      `@klndr/data`'s range query.
- [x] Profile: `ProfileCard`, `AccountActionsCard`, `DeleteAccountCard` and the form, on `@klndr/data`'s
      `useProfile` / `useUpdateProfile`.
- [x] Landing: `pages/index.vue` and the ten `components/landing/` files, ported into
      `src/components/landing/` (plus the shared `TimeBlock`, which the mockups draw blocks with). The
      reveal-on-scroll observer, the SEO title and the `start`/`signedIn` props came across; the scoped
      `<style>` blocks moved to `src/styles.css` (see DECISIONS.md for why they stay unlayered). The
      R.4 placeholder's redirect of signed-in visitors was dropped: `/` is public in the Nuxt app, so
      parity is to render the page for them and change the wording of the calls to action.
- [~] Day planner: `DayPlanner.vue` and everything it draws. Done: the checklist (`DailyChecklist.tsx`
      with `ChecklistHeader`/`ChecklistItemRow`/`ChecklistQuickAdd`), the notes (`DayNotes.tsx`), the
      emoji picker, and the shared pieces (`category/ColorSwatches.tsx`, `ui/Tooltip.tsx`) — each taking
      its behaviour from `@klndr/data`'s hooks rather than the Vue components' own save loops. Left:
      `CategorySelect`, `ActivityForm`, `LibraryPanel`/`LibraryModal`, the activity palette,
      `TaskEditor`, `DayTimelineGrid` (drag, resize, touch hold, edge scroll — all calling the R.3 maths
      in `@klndr/core`) and `DayPlanner` itself with its header, routines shelf and mobile nav, then the
      route shell swapping its placeholder for the real planner. Its route shell and data wiring are in
      place.

### R.6 Retire Nuxt
- [x] **Deleted `apps/web` (2026-10-04).** The React app now draws the whole product, so nothing was
      left behind in it. Recoverable from git history if ever needed (`git remote` / reflog), since the
      deletion is a normal commit.
- [ ] **The owner's half, and now the only thing outstanding:** deploy `apps/api` and put the React build
      up, in the order below / in HUMAN_TODO.md. A deployed Nuxt release keeps serving as it is — deleting
      the source does not take it down — but from now on it can no longer be rebuilt or redeployed from
      this repo, so `firebase hosting:rollback` and the existing Cloud Run/Hosting setup are the only
      rollback paths.
- [x] Prepared: `packages/tokens/scripts/generate.mts` read `apps/web/lib/colors.ts` — the only code
      dependency on the app being deleted — and now reads `apps/web-react/src/lib/colors.ts`. Verified by
      hiding the old file and regenerating: exit 0, and the only change under `packages/tokens/generated/`
      is the two-line `palette.ts` header. Comments that named the old path went with it.
- [x] Prepared: the stray `apps/web-legacy/` (four empty directories) and the stale root `.nuxt/` removed.
- [x] At the delete: the root `package.json` scripts now point at `apps/web-react` (`dev`, `build`, and
      `typecheck` no longer names `apps/web`); the `dev`/`demo` configs are gone from
      `.claude/launch.json`; `apps/api/Dockerfile`'s `COPY apps/web/package.json` line is gone (its `npm ci`
      layer validates the lockfile against every workspace manifest, so this had to go in the same commit);
      `.gitignore`/`.dockerignore` no longer carry `.nuxt`; `apps/api/src/server.ts` no longer reads the
      Nuxt-only `NUXT_PUBLIC_FIREBASE_PROJECT_ID` fallback; `apps/web-react/README.md` says the app is fully
      ported; and the two `packages/tokens` tests that read the deleted app's `colors.ts` and `main.css` now
      read `apps/web-react`'s. The `oxc-parser`/`rolldown` `overrides` were **kept** on purpose: they exist
      because Smart App Control blocks that pinned native binary, and Vite 8 still goes through rolldown/oxc,
      so lifting them would risk installs for no gain.
- [x] Checked for packages `apps/web-react` imports but does not declare, before deleting: the sweep found
      none left. `emojibase-data` had been exactly that (it is declared by `apps/web-react` now); one was
      known, so the pattern was assumed and checked rather than the instance.
- [x] Decided where `apps/api` is deployed (2026-10-04): the `klndr-api` Cloud Run service in
      `klndr-app`, region `europe-west1`, with Firebase Hosting rewriting `/api/**` to it so the API
      keeps the web app's own origin and CORS stays out of the design. `apps/api/Dockerfile` (built from
      the repo root) and the `hosting` block in `firebase.json` are in place; the exact commands are in
      HUMAN_TODO.md. Chosen over Firebase Functions because it needs no adapter: the app is already a
      fetch handler on plain Node. See DECISIONS.md.
- [x] Find out how the web app is deployed today: answered. `firebase.json` carries the `hosting`
      block (`public: apps/web-react/dist`, `/api/**` → the run service, `**` → `/index.html` for the
      app's real paths). Nuxt was served from `apps/web/.output/public`; deploying hosting replaces it,
      and `firebase hosting:rollback` brings it back without a rebuild.

## Out of scope
- Running the mobile app on the web (Expo web). The web app is replaced by a separate React app: Phase R.
- Tablet layouts, widgets and Live Activities, upgrading Nuxt.

