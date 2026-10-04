# Decisions

Short entries for choices not already fixed in the plan. Newest last. Record any forced
deviation here.

## 2026-10-03 — fixed by the project brief (not reopened)
- Mobile app: Expo (React Native) for iOS and Android; the Nuxt app stays the production
  web app. Written so it could later run on web too, without porting the web app now.
- Repo layout: npm workspaces — `apps/web` (Nuxt), `apps/mobile` (Expo), `packages/core`
  (framework-free TS), `packages/tokens` (design tokens). Workspace packages ship TS source
  with no build step.
- Mobile stack: latest stable Expo SDK + Expo Router + strict TypeScript; CNG (never commit
  `ios/`/`android/`); Uniwind for styling (NativeWind v5 only if forced, and then say why);
  React Native Reusables components; lucide-react-native; gesture-handler + reanimated;
  expo-haptics; React Native Firebase; Google/Apple sign-in SDKs; TanStack Query; MMKV; Inter.
- Offline: v1 works offline behind a switch. Mobile starts on the HTTP API ("api" mode);
  Phase 3 adds "firestore" mode, which becomes the default only after the owner approves.
- Devices: phones only, portrait, iOS `supportsTablet: false`.
- Navigation: native tabs Day / Calendar / Library / Settings; checklist, notes, task editor
  and pickers open as native sheets.

## 2026-10-03 — open choices to record as they are made
- Account-deletion wording and the exact confirmation string.
- Privacy-policy placeholders (legal name, contact email).
- Whether the mobile boot splash uses the drawn calendar mark.

## 2026-10-03 — forced deviation: pin `oxc-parser` to 0.144.0

`nuxt@3.21.11` depends on `oxc-parser: ^0.143.0`, which for 0.x resolves to exactly
`0.143.0`. On this machine Windows Smart App Control is enforced
(`VerifiedAndReputablePolicyState = 1`) and blocks that package's Windows native binary:

    require('@oxc-parser/binding-win32-x64-msvc')
    -> "An Application Control policy has blocked this file."

The binary is unsigned and has no cloud reputation, so SAC refuses to load it. `Unblock-File`
does not help (there is no Mark-of-the-Web), and copying the file does not help either — the
verdict is per content hash. The identical packages at 0.142.0, 0.144.0, 0.146.0, 0.150.0 and
0.152.0 all load fine, so only that one hash is affected. Nuxt imports oxc-parser from
`loadNuxt`, so `nuxt prepare` (and therefore `npm install`, via its `postinstall`), `nuxt dev`
and `nuxt build` all failed.

Workaround applied:
- `overrides.oxc-parser = "0.144.0"` in the root `package.json`.
- The matching lockfile sections patched to 0.144.0: `node_modules/oxc-parser`, its 19
  platform `@oxc-parser/binding-*` entries, and `node_modules/@oxc-project/types`.

npm does not re-apply a changed override when the lockfile already has a satisfying entry, and
dropping the lockfile entirely floats every transitive dependency (rolldown moved 1.2.11 →
1.2.12, which crashes `nuxt prepare` with "Class extends value undefined"), so the original
lockfile was kept and only those sections were edited. Every other pinned version is
unchanged.

Review notes:
- This is a machine-specific workaround, not an upstream requirement. 0.144.0 is one minor
  above Nuxt's tested range; the parser API Nuxt uses is unchanged and typecheck, build and
  dev all pass.
- Remove the override once Smart App Control is off or Nuxt bumps oxc-parser.
- The cleanest fix is to turn Smart App Control off, but it cannot be re-enabled without
  resetting Windows, so that is the owner's decision (see HUMAN_TODO.md).

## 2026-10-03 — 0.2: what @klndr/core is, and what stayed in the web app

`packages/core` ships TypeScript source and has no build step: Vite compiles it for the web app,
Vitest compiles it for its own tests, and Metro will compile it for the mobile app.
`apps/web/nuxt.config.ts` adds it to `build.transpile`, which Nuxt passes on to Nitro's
`externals.inline` (`@nuxt/nitro-server` builds that list from it). Without it Nitro would treat the
package as an external and try to `require` a `.ts` file at runtime. Verified on the build: no file
in `.output/server` mentions `@klndr/core`, and all twelve core modules appear in its source maps.

What did not move, because it belongs to the framework or to the bundler:
- `apps/web/lib/colors.ts` keeps the Tailwind classes (`PALETTE`, `paletteOf`); the keys, the labels
  and `canonicalColor` come from core.
- `apps/web/lib/emojis.ts` keeps the two `emojibase-data` dynamic imports and passes `localStorage`
  in as core's `KeyValueStorage`; grouping, search and the recent list are core's.
- `apps/web/lib/api.ts` is three lines now: `createApiClient({ getToken: getIdToken })`.
- `server/utils/validation.ts` keeps the two helpers that need the request (`parseId`,
  `readJsonObject`) and re-exports the pure ones, so nitro's auto-imports still find them under
  `server/utils`. Checked in the regenerated `.nuxt/types/nitro-imports.d.ts`.
- `useCategories` keeps the shared Vue state; the pure helpers (`withImplicitCategories`,
  `sortCategoriesByName`, `colorOfCategory`, `nextCategoryColor`, `CategoryEntry`) are core's.
- `useTimelineHistory` keeps only the Vue wiring around core's `TimelineHistory`.
- The `Store` interface moved; its two implementations stayed (they become `createStore(db)` in 3.1).

## 2026-10-03 — 0.2: the markdown split, and why the AST is by block

The plan asks for a parser with a small AST and a byte-identical HTML renderer. Here the split is by
block: `parseMarkdown(source)` returns paragraphs, headings, rules, quotes, fenced code and lists
(each item keeping its source line, its indentation and its checkbox), and `renderMarkdownHtml(blocks)`
turns that back into HTML.

Inline markup is deliberately not a tree. The inline passes (code spans, links, strong, em, del) are
global and ordered, and they are allowed to span a code span or wrap a link label — `**`code`**` has
to come out as `<strong><code>code</code></strong>`, and `[*x*](url)` emphasises inside the link — so
a tree built by a left-to-right tokeniser would produce different HTML in those cases. `renderInlineHtml`
is exported for the renderer to use, and the whole output is pinned by 53 fixtures generated from the
implementation *before* it moved (`packages/core/test/fixtures/markdown-cases.ts`; regenerate on
purpose, never to make a test pass). If 2.3 wants inline nodes for the native preview, those fixtures
are the contract to keep.

## 2026-10-03 — 0.2: Vitest 5.0.3, and a lockfile that only grew

Vitest 5.0.3 accepts Vite 6, 7 or 8, and the repo already had Vite 8.3.1, so nothing was duplicated
and no new native binary was pulled in — the Smart App Control problem only ever hit
`oxc-parser@0.143.0`. The install added 14 packages and 260 lockfile lines, all additions: the
`oxc-parser` pin and every other pinned version are untouched, so the fragile part of the 0.1
workaround is intact.

## 2026-10-03 — 0.2: tooling used for the move itself

The import rewrite (37 files importing the four moved modules) was done with a one-shot codemod that
merges each file's moved imports into a single `@klndr/core` statement and wraps the long ones. Its
first version was wrong — its statement regex matched across import statements and mangled the
formatting — so the affected files were reverted from git and the codemod fixed to match whole
statements by line before being re-run. The markdown fixtures were generated the same way: a one-shot
script run against the old implementation, then deleted. Neither script is part of the repo.

## 2026-10-03 — 0.3: how @klndr/tokens is built

`packages/tokens` has three inputs and two generated outputs. `src/theme.ts` is the theme's single
source of truth; `apps/web/lib/colors.ts` stays the place the palette classes live (the generator
reads the file and parses the object literal, so there is no second copy to keep in sync); and
Tailwind's own `theme.css` is what those classes name, because that is what a browser resolves them
to at runtime.

`npm run generate -w packages/tokens` writes two committed files: `generated/theme.css` (which
`main.css` imports as `@klndr/tokens/theme.css`) and `generated/palette.ts` (the palette as data).
Both are in git, so the web build needs no pre-step and a reviewer can read the diff; tests re-run the
generator's pure functions and fail if either file drifts. `culori` (and `@types/culori`, because
culori ships no types) is a devDependency — the apps read plain numbers and never do colour maths.

Moving `@theme inline` into an imported file was the one real risk in this, because Tailwind builds
its utilities from it. It is fine: the built stylesheet is byte-identical (see PROGRESS.md).

## 2026-10-03 — 0.3: Tailwind v4's palette resolves to different sRGB than the v3 hexes

Tailwind v4 defines its palette in oklch, and converting those values to sRGB does **not** return the
hexes the v3 palette is remembered by: `indigo-500` is `oklch(58.5% 0.233 277.117)`, which resolves to
`#615fff`, not `#6366f1`, and `rose-500` resolves to `#ff2056`, not `#f43f5e`. The low-chroma steps
(`indigo-50`, `slate-200`) do match their published hexes; the saturated mid-tones do not, because v4
re-derived them in oklch.

These tokens therefore describe what the web app actually paints: a browser resolves
`--color-indigo-500` to that oklch value and gamut-maps it to sRGB, which is what the generator does
with culori's `toGamut("rgb", "oklch")` (CSS Color 4's algorithm, the default `toGamut` arguments).

Two things follow. The values are sRGB, so on a P3 display the rendered colour is more saturated than
what the tokens say — if the phone should use the wide-gamut colour, that is a Phase 2 decision. And
the pinned tests use resolved values, not the remembered hexes.

## 2026-10-03 — 0.3: how a palette class becomes a value

- A plain utility (`bg-indigo-50`) applies in **both** themes; only a `dark:` one applies in the dark
  theme alone. Resolving dark therefore starts from the plain utilities and lets the `dark:` ones
  override them, and because the class lists keep their `dark:` utilities last, applying them in order
  lands where the cascade does. (Reading plain utilities as light-only would have left `dot`,
  `swatch`, `accent` and half of `selected` empty in dark mode.)
- An `/NN` alpha modifier becomes an 8-digit hex (`border-indigo-200/80` → `#c6d2ffcc`), which is what
  a phone paints without extra work. Every role also resolves its `hover:` variants so the data is
  complete; the mobile app has no pointer, so it simply will not use them.
- `color-mix(in oklab, var(--color-x-500) 16%, var(--background))` is computed in oklab with exactly
  those weights: 0% returns the colour it is mixed over, 100% returns the colour itself, and both are
  asserted (a check that needs no external oracle).
- The generator throws on anything it cannot read — an unknown Tailwind colour, a utility that is not
  `bg-`/`border-`/`text-`, a `color-mix` in another colour space — so adding a class the resolver does
  not understand fails loudly instead of quietly emitting a wrong colour.
- `swatch` is resolved too, even though it only repeats `dot`'s colour, because it is a role in the
  web palette and leaving a hole would invite a second source of truth.

## 2026-10-03 — 0.4: who deletes what when an account goes

The data and the identity are removed by different parties, in this order:

1. The client re-authenticates. Firebase refuses `deleteUser` when the sign-in is old, and it is the
   honest moment to ask anyway: a password account types its password, Google and Apple re-open their
   pop-up. This is also the only place the Apple access token comes from.
2. `DELETE /api/account` deletes the data: the collections first, the profile document last, so a
   failure half way leaves a profile that still says who owns the leftovers. Deletes on this path are
   unconditional (`currentDocument` preconditions are dropped), and each collection is emptied in
   batches of 300 until it is empty, so an account of any size goes.
3. Apple-linked accounts revoke the Apple token. Firebase 12 has no `User.revokeAccessToken()`; the
   revocation is the top-level `revokeAccessToken(auth, token)` and it wants the Apple *access* token,
   which only comes back from a fresh Apple credential — hence the pop-up in step 1. Failing to revoke
   is logged, not fatal: the account still has to go.
4. `deleteUser` on the client. Only the signed-in user may delete their own Auth user, and the API
   deliberately holds no admin credentials, so this cannot move to the server.

The server also forgets its in-memory seed markers, so a new account seeds from scratch.

## 2026-10-03 — 0.4: the rules change is four lines of `allow delete`

`users/{uid}` gained `allow delete: if isOwner(uid)` (it used to be `false`), and each of the three
`meta/*` markers gained its own `allow delete: if isOwner(uid)` while keeping `allow update: if false`.
Account deletion is the only thing that needs any of it; ownership, shapes, limits and immutability are
otherwise untouched.

## 2026-10-03 — 0.4: the policy pages, and what they claim

`/privacy` and `/account-deletion` are public (in PUBLIC_PATHS) and describe what the code actually
does: Firebase Authentication for identity (email/password, Google, Apple), Cloud Firestore for the
data under the user's own uid, a server that passes the caller's token through instead of holding
admin credentials, no analytics or advertising, and localStorage used only for the theme and the recent
emojis. The deletion page gives the in-app steps and an email route for someone who can no longer sign
in. The policy is marked DRAFT and carries `[COMPANY LEGAL NAME]`, `[CONTACT EMAIL]` and `[DATE]`
placeholders — HUMAN_TODO, for the owner to fill in before the app is published.

## 2026-10-03 — 1.1: keep the template's shape, throw away its content

`create-expo-app`'s `default` template (SDK 57, TypeScript, Expo Router) is worth keeping for its
skeleton: the `src/app` router root, the tsconfig that extends `expo/tsconfig.base`, the Metro and
Babel setup, `.gitignore`, and the placeholder icons the stores require. Its *content* is a demo:
tabs, an explore screen, themed-text/themed-view, an animated splash, Expo's own colours and a
`reset-project` script. All of it was deleted here rather than left to rot, because every part of it
would be replaced by the design system in 1.2 and the screens in Phase 2, and a demo tab bar in the
repo makes the real structure harder to see.

Two things also went that a template includes by default: the Expo *web* target (`react-native-web`,
`react-dom`, the `web` script) — the plan keeps the Nuxt app as the only web app — and the demo-only
packages (`expo-device`, `expo-symbols`, `expo-glass-effect`).

## 2026-10-03 — 1.1: app.config.ts, typed, with the identity in one constant

`app.json` was replaced by `app.config.ts` for three reasons:

- **Type checking.** `export default (): ExpoConfig => …` means a misspelled key is a compile error,
  which is how `android.edgeToEdgeEnabled` was caught: SDK 57 turns edge-to-edge on unconditionally
  and the key no longer exists in the config types, so it is a comment now instead of a dead setting.
- **One identity.** The iOS bundle id and the Android package must agree, and neither can change
  after the first store release, so both read `BUNDLE_ID`.
- **Conditional bits.** The two Firebase native config files are only added to the config when the
  file is actually on disk. That keeps the app startable on a machine without them (it runs in demo
  mode), while the path still comes from `GOOGLE_SERVICES_JSON` / `GOOGLE_SERVICES_INFO_PLIST` for
  builds. `npx expo config --type public` is the way to see what a build would actually use.

Both files are gitignored: they are per-environment project configuration, EAS supplies them per
build profile, and `app.config.ts` is where the names are documented.

The `EXPO_PUBLIC_*` values are a different kind of setting: Expo inlines them into the bundle, so
they are read once in `src/env.ts` (typed, with the defaults made explicit) rather than looked up at
the point of use.

## 2026-10-03 — 1.1: Metro has to be told about the workspace

`@klndr/core` and `@klndr/tokens` ship TypeScript source and no build step (DECISIONS, 0.2), which
is exactly what the web app wants — Vite compiles them. Metro, by default, only watches its own
project directory, so it would find neither package. `metro.config.js` therefore adds the workspace
root to `watchFolders`, lists both `node_modules` directories in `resolver.nodeModulesPaths`, and
sets `disableHierarchicalLookup` so a dependency can only ever resolve from those two places.

That is Metro *compiling* the shared source, not reading a build artifact, and the proof is the
export: `npx expo export --platform android` bundles 1260 modules and its source map lists all 12
core and all 5 tokens modules. This closes the acceptance task 0.2 left open.

## 2026-10-03 — 1.1: why the mobile tsconfig names its types

`expo/tsconfig.base` includes DOM and ESNext but no `types`, and Expo's own type package is meant to
arrive through the generated `expo-env.d.ts`. That file is gitignored (Expo regenerates it), so a
fresh checkout cannot rely on it: the app's CSS import failed to typecheck and `app.config.ts` had no
`node:fs`. The tsconfig now says `"types": ["expo/types", "node"]` — `expo/types` declares the CSS
and asset imports the bundler handles, `node` covers `app.config.ts` (which runs under Node, not in
the app) — and `@types/node` is a devDependency of the mobile package.

The web app needed no change: `@types/react`, hoisted for React Native, does not leak into it, and
`npm run typecheck` (all four workspaces) passes.

## 2026-10-03 — 1.1: eas.json before there is an EAS project

`eas.json` describes three profiles — development (a dev client, internal distribution), preview
(internal distribution) and production — and `appVersionSource` is `local` because there is no Expo
account behind this repository yet, so a project id would be a lie. `eas init` is in HUMAN_TODO;
switching to `remote` versioning is then a one-line change.

Every profile pins `EXPO_PUBLIC_DATA_MODE=api`, which makes the Phase 3 rule explicit at the level
where it can actually be enforced: Firestore mode is opt-in per run, never a build default.

## 2026-10-03 — 1.2: the token package generates for two engines, from one source

The web app and the phone get their colours from the same data (`src/theme.ts`, `src/scale.ts`), but
they do not get them the same way. Tailwind in a browser selects a theme with a `.dark` class; Uniwind
in React Native selects one with a `@variant`, scoped inside `@layer theme { :root { … } }`. So the
generator writes a second file, `generated/uniwind.css`, containing exactly that, plus the scale:

- the twenty theme variables, once per variant;
- `@theme inline` mapping them to `--color-*`, the same mapping the web's file has, so `bg-card`,
  `text-muted-foreground`, `border-border` and the rest mean the same thing on both;
- the scale — `--radius-*`, `--spacing-*` and `--text-*` — registered so `rounded-md`, `p-md` and
  `text-body` are DESIGN.md's numbers on the phone too.

Two details are deliberately different from the web's file. **Line height and tracking are resolved to
points at generation time**: React Native wants `21px` where the web writes `1.5`, and `-0.75px` where
it writes `-0.025em`, and a unitless line height would be a rendering bug rather than a small
difference. And **there is no `--font-sans`**: a font stack is a browser idea, and React Native needs
one exact family name, which the app's `Text` supplies from the scale's weight.

The generated file is a test fixture like the others: `test/uniwind.test.ts` pins the shape and the
computed numbers, and fails if the committed file drifts.

## 2026-10-03 — 1.2: the theme is a preference the app owns, the styling is Uniwind's

`Uniwind.setTheme('light' | 'dark' | 'system')` switches the CSS variables and the `dark:` variants;
what it has no concept of is remembering that choice, so `src/theme/preference.tsx` owns it and MMKV
stores it. Three decisions are worth stating:

- **It is applied at module scope in the root layout**, not in an effect, because an effect runs after
  the first paint and a cold start would flash the wrong theme. The same module-scope call keeps the
  splash screen up until Inter has loaded, so no frame shows a fallback face either.
- **"System" is resolved by asking the platform** (`useColorScheme`) rather than by reading Uniwind's
  current theme, so `resolved` in the provider is what the screen is actually showing — and it keeps
  up when the phone flips at dusk.
- **Native props that take a colour and no class name** — an `ActivityIndicator`, a picker's accent,
  a status bar — read `THEMES[resolved].values` from `@klndr/tokens` through `useThemeColors()`. The
  data is already resolved sRGB, so no colour maths happens at runtime.

The shared stylesheet is `apps/mobile/src/global.css`, which imports Tailwind, Uniwind and
`@klndr/tokens/uniwind.css`. Tailwind scans for class names from the directory the entry file is in,
which is `src` — where all of this app's code lives, so no `@source` directive is needed.

## 2026-10-03 — 1.2: typography goes through `Text`, and the family comes from the weight

React Native needs one exact family name per weight: with four static Inter files loaded, `fontWeight`
alone does not select the right face on Android. So `Text` takes a scale step, applies its `text-*`
utility (size, line height and tracking, from the tokens), and sets `fontFamily` from that step's
weight through `FONT_FOR_WEIGHT`. No `font-*` utility is used anywhere in the app.

Class names are always written out, never built: Tailwind finds candidates by reading the source, so
`text-${variant}` would produce a utility that was never generated. Every prop-to-class mapping in the
primitives is a `Record` of literal strings.

Large text is a constraint on the same subject: the primitives use `minHeight` and never a fixed
`height`, so a bigger system text size grows the control instead of clipping it.

## 2026-10-03 — 1.2: the icon barrel, and 2.1 MB

`import { CalendarX } from 'lucide-react-native'` pulls the whole barrel in, because Metro does not
tree-shake: 1867 icon modules, and the Android bundle went from 3.0 MB to 6.6 MB. Importing the file
itself (`lucide-react-native/icons/calendar-x`, which imports only the shared `createLucideIcon`)
brings that back to 4.45 MB across 2148 modules, and leaves a bundle whose size is dominated by the
Uniwind runtime and its compiled stylesheet rather than by icons nobody draws.

`src/icons.ts` is that list — the app's whole icon vocabulary in one file, so the deep import looks
deliberate rather than arbitrary, and adding an icon becomes a visible decision. Note that lucide's
file names are not always the component names: there is no `trash-2`, `Trash2` is an alias of `Trash`.

## 2026-10-03 — 1.2: what every primitive promises

- **A role and a label.** `IconButton`'s `label` is required, not optional: an icon has no text, so it
  is the only accessible name it will ever have. Rows, chips, swatches and pickers all name
  themselves, and a swatch says "indigo" (the name from `@klndr/core`), not a hex value.
- **A 44-point target**, from `MIN_TOUCH_TARGET`/`MIN_TAP_TARGET` in `components/ui/targets.ts` —
  numbers rather than utilities, so a hit area can never depend on the stylesheet. A small colour dot
  still gets a 44-point pressable.
- **Press feedback that is not motion** (opacity), and a `Skeleton` that stops moving when the system
  asks for less motion, since a pulsing rectangle is exactly what that setting is about.
- **Sheets through `formSheet()`**, which returns Expo Router's form-sheet options with the detents and
  the token radius, so the grabber, the swipe-to-dismiss and the detents are the platform's.
- **Native controls behind our API.** `Picker` and `DateTimePicker` wrap Expo UI's SwiftUI/Material
  picker and the community date/time picker, so a screen imports ours and never a vendor's: one place
  to change if a native control has to be replaced, and the place where the accent colour and the
  current scheme are handed over.

`app/index.tsx` is the catalogue: every primitive on one screen, in whichever theme and text size the
device is set to. It is temporary — task 1.3 puts the auth gate in front of it and Phase 2 replaces it
with the Day tab — but it is how all of this gets looked at before there are screens to put it in.

## 2026-10-03 — audit: Reusables was in the brief, and the primitives are hand-built

The brief lists React Native Reusables among the mobile components. Tasks 1.1-1.2 instead wrote the
primitives directly on Uniwind and `@klndr/tokens`, without recording the choice. Kept: they are small,
read DESIGN.md's scale and the shared tokens, and carry the accessibility rules (a required name on every
icon button, 44 pt targets) that Reusables' defaults would have had to be bent to. If a later screen wants
a Reusables component (a combobox, say), it can be added beside them and will pick up the same tokens.

## 2026-10-03 — 1.3: one definition of a first profile, in core

The web's `loadProfile` and the phone's both have to create `users/{uid}` the same way on a first
sign-in, because the rules, the web profile page and the API all read that document. Rather than copy the
web's twelve lines, `@klndr/core` owns it: `newProfileData` (the fields, minus the two timestamps the
database stamps) and `loadOrCreateProfile` (read, create if absent, read back) over a `ProfileDb` that a
platform implements in a few lines. The web still keeps its own Vue wrapper (shared state,
`pendingSignUpName`) and only swapped the field list for `newProfileData`; its output is the same object,
pinned by a test.

The sign-in wording follows the same rule: `authErrorMessage` is the web's `getFriendlyErrorMessage`
for login and sign-up, by context, with one addition (a lost connection). The web pages were left alone.

## 2026-10-03 — 1.3: one auth adapter, and the web one that was not kept

The plan asked for a `.native.ts` (React Native Firebase) and a `.web.ts` (Firebase JS SDK) adapter behind one
`AuthService`. Both were written; the web one was removed again before the first commit, with its `firebase`
dependency, its four `EXPO_PUBLIC_FIREBASE_*` variables and the `moduleSuffixes` setting, because nothing builds
or ships it (Expo web is out of scope) and untested code is a liability in a public repository. The interface
stays, so a web adapter is an afternoon's work if the app ever runs on the web: it is in this file's history.

## 2026-10-03 — 1.3: how each provider signs in

- **Email:** `signInWithEmailAndPassword`, `createUserWithEmailAndPassword` (then `updateProfile` with the
  typed name), `sendPasswordResetEmail`. Validation and wording come from core.
- **Google:** the native Google SDK, then `GoogleAuthProvider.credential(idToken)` into Firebase. The SDK
  is configured with the *web* client id on both platforms, because that is the audience Firebase accepts.
  It is configured lazily, so a build without the id only fails when someone taps the button.
- **Apple on iOS:** `expo-apple-authentication` with a random raw nonce whose SHA-256 goes to Apple; the
  identity token and the *raw* nonce go to Firebase through `OAuthProvider("apple.com").credential`.
  Apple shares the person's name only the first time, and Firebase does not read it from the token, so it
  is held as the pending name for the profile that sign-in may create. The button is Apple's own component.
- **Apple on Android:** Firebase's own OAuth provider flow (`signInWithPopup` in the RN Firebase API,
  which runs the native provider activity). There is no system sheet to use.
- A back-out (Apple `ERR_REQUEST_CANCELED`, Google `SIGN_IN_CANCELLED`, Firebase `web-context-canceled`)
  returns `"cancelled"` and shows nothing; it is not an error.
- **Apple token revocation on delete** (task 2.6) differs per platform: RN Firebase's
  `revokeToken(auth, authorizationCode)` works on iOS and is a no-op elsewhere, and `revokeAccessToken` (the
  web flow's) throws on native. 2.6 must therefore take a fresh Apple *authorization code* on iOS.

## 2026-10-03 — 1.3: the gate, and the states behind it

`Stack.Protected` is used rather than redirects in screens: it also guards deep links and flips by itself
when the state changes, so no screen navigates after signing in or out. The provider's four states —
`loading` (a restored session, or the profile being read, as the web waits for it), `signed-out`,
`signed-in`, and `unavailable` — exist for two reasons: the splash must hold until Firebase has answered or
a signed-in person sees a signed-out frame, and a checkout with neither Firebase config nor demo mode would
otherwise crash inside a native call. A profile that fails to load leaves the person signed in, with a
retry, like the web's `profileError`. A load generation counter stops a slow profile read for a previous
user from overwriting the screen.

## 2026-10-03 — 1.3: config plugins, and when they are on

`@react-native-firebase/app` throws at prebuild without `google-services.json` / the plist, so the plugins
(`app`, `auth`, and Google sign-in with its `iosUrlScheme`) are added only when either file exists — which
keeps a fresh checkout startable in demo mode — **or when `EAS_BUILD` is set**, so a store build missing a
file fails at build time instead of shipping with no sign-in. The URL scheme is read from the plist's
`REVERSED_CLIENT_ID` (override: `GOOGLE_IOS_URL_SCHEME`). `ios.usesAppleSignIn` stays in the config and
the `expo-apple-authentication` plugin is added.

**Correction (first iOS build):** this entry first said the Firebase iOS SDK would be built through
CocoaPods (`disableSPM: true`) because "CocoaPods works with either linkage". That was reasoned, not run,
and it was wrong: the EAS build failed in *Install pods* with "Swift pods cannot yet be integrated as
static libraries" (`FirebaseAuth`, `FirebaseFirestore`). React Native Firebase's own Expo guide
(rnfirebase.io/ios-spm) says to keep its default, Swift Package Manager, and build the pods as dynamic
frameworks, so `app.config.ts` now adds `expo-build-properties` with `ios.useFrameworks: "dynamic"` and
no `disableSPM`. Lesson kept: nothing about the iOS native build is verified until EAS has built it.



## 2026-10-03 — R: the web app moves to React; "Nuxt stays the production web app" is superseded

The first entry of this file fixed the Nuxt app as the production web app and PLAN.md listed replacing
it as out of scope. The owner has since decided to rewrite the web app in React (Vite, React, TanStack
Router) and retire Nuxt, so that web and mobile share data hooks as well as logic. Mobile keeps its own
native views on purpose; only logic, data and design tokens are shared. Plan: Phase R in PLAN.md. Nuxt
keeps serving production until the React app reaches parity (R.5).

## 2026-10-03 — R.1: the API is a Hono app in `apps/api`, and Nuxt forwards `/api/**` to it

Why take the server out of Nuxt: it is what the React web app and the mobile app both call, and it has to
outlive Nuxt. Everything in `apps/web/server` was already client-agnostic (REST plus a Firebase ID token
forwarded to Firestore), and its only Nitro coupling was `createError`, `getQuery`, `readBody`,
`getRouterParam`, `setResponseStatus`, `useRuntimeConfig` and `import.meta.dev`.

- **Hono**, because the app is a plain fetch handler (`createApp(config).fetch`): it runs on Node
  (`@hono/node-server`), inside Nitro, and on edge runtimes, and `app.request()` makes the routes testable
  without a server. Standalone Node is the default way to run it (`npm run dev -w apps/api`).
- **One implementation.** While Nuxt exists, `apps/web/server/api/[...].ts` hands every `/api/**` request to
  the same app (`toWebRequest`), so the deployed web app and the mobile app's base URL are unchanged.
  `@klndr/api` is in `build.transpile`, like `@klndr/core`, because it ships TypeScript source.
- **Configuration is injected, not read from Nitro.** `createApp({ firebaseProjectId, allowDevUser, keys?,
  storeFor? })`. Nuxt passes `useRuntimeConfig().public.firebaseProjectId` and `Boolean(import.meta.dev)`;
  the Node entry reads `FIREBASE_PROJECT_ID` (or `NUXT_PUBLIC_FIREBASE_PROJECT_ID`) and `NODE_ENV`, and refuses
  to start in production without a project id. `allowDevUser` is compiled to `false` in the Nuxt production
  bundle (checked in `.output`).
- **Same wire format.** Errors keep the Nitro keys (`error: true`, `statusCode`, `statusMessage`, `message`),
  which is what `createApiClient` reads. Unexpected failures answer a plain 500 and log the detail.
- **Small differences, all deliberate.** A body that is not valid JSON is a 400 "Expected a JSON object
  body" (it was whatever `readBody` threw). Repeated query keys use the first value (h3 returned an array,
  which the routes then ignored). The per-user in-memory stores for dev now belong to the app instance
  (`createStoreFactory`) instead of a module-level map, so tests and multiple apps are isolated.
  `Cache-Control: no-store` and `X-Content-Type-Options: nosniff` are set by the app itself.
- **No CORS.** Nuxt serves web and API from one origin, and the React dev server will proxy `/api`. If the
  React app and the API are ever hosted on different origins, add CORS then (HUMAN_TODO).
- **Not changed:** the stores and the Firestore REST client moved verbatim (`git mv`), so Phase 3.1
  (`createStore(db)` in core) starts from the same code. Validation stayed as it was; schema validation
  (zod) was left out so this move changes no behaviour.

## 2026-10-03 — line endings of the files tests compare byte for byte

`packages/tokens` tests compare generated files and a fixture with what the code produces. On Windows with
`core.autocrlf=true` (Git for Windows' default) they were checked out with CRLF and four tests failed
without anything being wrong. A `.gitattributes` now pins exactly those paths to LF. Nothing else about line
endings changed.

## 2026-10-03 — R.2: `@klndr/data`, the data layer both apps share

TanStack Query hooks over the `@klndr/core` API client, for the React web app and the Expo app. Views stay
each app's own; this is everything behind them.

- **Shape.** The logic is plain functions over a `QueryClient` (`cache.ts`, `blocks.ts`, `derive.ts`) and

## 2026-10-04 — R.5: the React screens

- **`lucide-react` is a dependency of `apps/web-react`.** The Nuxt app draws with `lucide-vue-next`; the
  React app needs the same glyphs, and the mobile app already uses `lucide-react-native`, so lucide is the
  consistent choice across all three. Added with
  `npm install lucide-react -w apps/web-react`; it resolved to 1.51.0 and moved no pin (the `overrides` for
  `oxc-parser` and `rolldown` still hold).
- **Tooltips are deferred, not ported.** The four `components/ui/tooltip/*.vue` files wrap `reka-ui`
  (Radix's Vue port) and exactly one component uses them (`daily-checklist/ChecklistQuickAdd.vue`). Rather
  than add `@radix-ui/react-tooltip` for one tooltip, that component will carry a small local tooltip when
  it is ported. If tooltips spread later, revisit this.
- **The enter/leave animation is a `usePresence` helper, not a library.** `<Transition name="modal">` in
  Vue delays teardown so the leave animation can run; React does not, and the alternatives were a new
  animation dependency or ~15 lines. The helper keeps the node mounted for the transition's duration and
  the CSS moved from the component's scoped block into `styles.css`, keyed off `data-state`. The same
  pattern is there for other transitions if they need it.
- **The profile screen reads and writes through `@klndr/data`, not the auth provider.** The Nuxt page used
  `useAuth().updateProfileData`; here `useProfile` / `useUpdateProfile` already exist and carry the
  optimistic update and rollback, so the page uses them. The auth provider still loads the profile for the
  gate, so there are briefly two reads of one document — the known duplication, still to collapse, and one
  this page is the wrong place to resolve (the gate's copy is what the header and the error state read).
- **The day view's locked scrolling lives in the root frame.** `app.vue` set `h-dvh overflow-hidden` on its
  outermost element for `/day*`; `routes/__root.tsx` does the same, keyed off the router's pathname, so the
  planner can still make only its timeline scroll.
- **Page titles are a one-line effect.** TanStack Router has no head manager and the screens only ever set
  `document.title` (the Nuxt `useHead`/`useSeoMeta` calls were title-only here). `useDocumentTitle` is that,
  rather than pulling in a head library for a string.

  mutations written as TanStack *options objects*, not hooks (`mutations/*`), so they run under a bare
  `MutationObserver` in tests. The hooks (`hooks/*`) are thin wrappers. Above them sits `useDayTimeline(day)`,
  the data half of `DayPlanner.vue`: tasks, add from an activity, move (with the neighbours' columns), resize,
  tick, delete, editor save, undo/redo, refresh. React and `@tanstack/react-query` are *peer* dependencies: the
  mobile app pins its own React (19.2.3, Expo's) and Metro resolves every import to that copy, which is why a
  bundled second copy would crash with "invalid hook call". Checked in the exported bundles: one React copy.
- **What is optimistic.** As in the Vue planner: add from an activity (temporary id, swapped for the saved
  block), move, resize, tick, delete, dragging an activity to another category, ticking a checklist routine.
  Everything with a form (editor save, activity and category edits, checklist edits) waits for the server and
  throws its message to the caller. Rollback restores only the blocks a mutation touched (not a whole-cache
  snapshot), so a failure never undoes an unrelated change made meanwhile.
- **Order.** Task mutations share a TanStack `scope`, so they *run* one after another while their optimistic
  effects appear at once: a drag followed quickly by a tick reaches the server in that order. The Vue planner
  sent them in parallel. The checklist has its own scope. (Tested: the second request is not sent until the
  first is answered.)
- **No refetch after each task change.** Refetching on settle would show the server's state from before a
  *queued* change and flicker the screen back. Responses are written into the cache instead; a failed move,
  which may have half-saved, does invalidate. The cache is trusted for 30 s (`staleTime`).
- **Deliberate differences from the Vue app** (each was a gap, not a feature):
  - a failed resize or tick now says so (it was silent), and a failed checklist tick is put back (it stayed
    ticked, with only a message);
  - the checklist messages the components built ("Skipped … for this day", "Restored …", "Added … for this
    day", "Removed …") are now shown; the planner discarded them;
  - deleting an activity says "Activity deleted" everywhere (it did only from the editor), and deleting a block
    from the editor is optimistic like deleting it from the timeline (it awaited, then closed);
  - the server's message is thrown to the caller instead of `alert()`;
  - fetching again after a category rename uses TanStack's cancel-and-refetch, replacing the hand-made
    "older reload must not win" counter.
- **Undo** is the existing `TimelineHistory` engine in core, reading and writing the day's list in the cache;
  a different day starts a fresh history. Month grids that show those blocks are refetched after an undo.
- **The device cache.** Persisted with `createKeyValuePersister(storage)` (MMKV on the phone). Its buster is
  `version:userId`, so a cache saved for one person is discarded on restore for anyone else (tested), and it
  is wiped when `userId` is `null`. That makes `null` mean *signed out*, never *not known yet*: the app must
  not mount `DataProvider` until auth has settled, or every cold start would erase the cache. `AppDataProvider`
  renders nothing while auth is `loading` for that reason. Saved data is shown at once and refreshed only if it
  is older than `staleTime`. One cache slot, 24 h `maxAge`, bump `CACHE_VERSION` when a cached shape changes.
- **Reconnect refetch is not done.** TanStack needs a network-state source for `onlineManager`; on a phone
  that is a native module (`expo-network` or NetInfo), and a new native dependency means a new development
  build. Foreground refetch is done (`AppState` to `focusManager`) and covers most of it; add the module with
  the next planned native build.
- **The profile** is a Firestore document read through each platform's own Firebase SDK, so `useProfile` takes
  an injected `ProfileSource` (`load`, `save`); values go through core's `cleanPatch` first. The phone's
  `AuthProvider` still loads the profile itself and doesn't use it yet; the Settings tab (2.6) will.
- **Test harness.** The tests run the real `@klndr/api` in memory behind a stubbed `fetch`, with requests that
  can be held or made to fail, so optimistic state is looked at while a request is in flight and rollbacks are
  forced for real. React's side is checked with a renderer (happy-dom). Two things learned: TanStack tells React
  about cache changes a tick later, so hook results are asserted with `waitFor`; and the default scheduler already
  coalesces updates made in one synchronous block, so `notifyManager.batch` in the category rename states the
  intent rather than being what keeps it consistent (the test checks the invariant either way).


## 2026-10-04 — R.3 and the mobile Day/editor screens

- Timeline functions used per frame carry the Reanimated `"worklet"` directive (including their snap
  helper dependencies). Node and web treat it as a string; Metro transforms it for the UI thread.
  Framework input/scroll logic remains in each view. R.3 preserves the original Vue formulas.
- The timeline and editor share one day's TimelineHistory in DataProvider, rather than independent
  hook-local instances. Changing day or person starts fresh. Delete returns a boolean for the editor's
  success-only Undo toast; errors are still reported by the mutation notifier.
- Reconnect is now wired through expo-network, added with the new simulator build. The initial async
  read yields to any later network event, and cannot update a listener after cleanup.
- iOS `useFrameworks: "dynamic"` is unconditional: the installed Firebase native modules are linked
  even without the config files when building demo mode. Making this conditional on credentials caused
  the local pod/build failures. Existing logs confirm the simulator build now succeeds.
- Expo config explicitly limits platforms to iOS and Android. Native views remain separate from the
  planned React web app. Android date/time dialogs are mounted only after their value control is tapped.


## 2026-10-04 — R.4 `apps/web-react`

- **File-based routes with TanStack Router**, so route names mirror the Nuxt `pages/` structure and R.5
  is a page-by-page move; `routeTree.gen.ts` is generated by the Vite plugin and **checked in**, the same
  convention as `packages/tokens/generated`, so `tsc` works on a fresh checkout. `_authed` is a pathless
  layout route, so the guard is written once for everything signed-in.
- **The router is not mounted until auth has settled**, exactly as `AppDataProvider` is not on mobile:
  `DataProvider` reads `userId: null` as *signed out* and wipes the cache, and the guard would send a
  signed-in visitor to /login. So `AuthState.loading` only ever happens **once** — a later sign-in moves
  straight to `signed-in` with the profile arriving a moment later — which is what keeps the router from
  being unmounted mid-sign-in. The Nuxt app got this for free: `useState` outlived every navigation.
- **The guard is the Nuxt app's `middleware/auth.global.ts`.** Only `signed-out` redirects (to `/login`
  with `?redirect=`, read back through the ported `safeRedirect`); `unavailable` — a build with no
  Firebase configuration — lets everyone through, which is credential-free development; `loading` cannot
  be reached. `router.invalidate()` on an auth change is what performs the redirect the moment someone
  signs out, since no navigation would otherwise re-run the guard.
- **Auth is the Nuxt app's `useAuth`, as a React context — not the phone's `AuthService` shape.** It
  reuses core's `loadOrCreateProfile`, `newProfileData`, `authErrorMessage`, `signInProblem` and
  `signUpProblem`, so a person reads the same words in both apps. `src/auth/service.ts` holds the Firebase
  calls and `src/auth/provider.tsx` the React state; the SDK's `User` never leaves `src/auth/`.
- **The profile.** `ProfileStore` is core's `ProfileDb` plus the merge an edit needs. It is the Firestore
  document with a project configured, and an in-memory Map without one — the same trick the API plays for
  `local-dev` — so the profile screen will work in credential-free development too.
  `createProfileSource(user)` is what `@klndr/data`'s `useProfile` / `useUpdateProfile` are given, while
  the provider still loads the profile itself for the gate, as the phone's provider does (a known
  duplication, recorded in PROGRESS, to collapse when the profile screen lands).
- **No cache persister on the web.** `DataProvider` gets no `persister`, so the query cache is memory-only
  — the R.2 decision. `localStorage` needs no new dependency, so it stays a small change if wanted.
- **`vite` is pinned to 8.3.1 and `rolldown` to `1.2.11`** (the latter in the root `overrides`). Vite 8
  asks for rolldown `~1.2.11`, and 1.2.12 crashes `nuxt prepare` on this machine — adding a second Vite
  consumer is exactly when npm would otherwise have been free to bump it.
- **CORS stays out.** The app only calls its own origin: `/api` is proxied to `apps/api` in development
  and the API is served behind the app in production (R.6). `apiBaseUrl` is empty by default, which also
  means the deploy cannot accidentally point at another origin.
- **A minimal sign-in form sits in `src/routes/login.tsx`** so the gate can be exercised before R.5. It is
  scaffolding, not the port: no reset flow, no Apple button, none of the real layout. `apps/web-react`
  also deliberately does not depend on `@klndr/api` — the app is a client, and the bundle must not carry
  the server (the same rule the mobile bundle is checked against).


## 2026-10-04 — R.6: the palette moved to the React app, and the API gate

- **`packages/tokens/scripts/generate.mts` reads the palette classes out of an *app*, and R.6 deletes that
  app.** The generator now reads `apps/web-react/src/lib/colors.ts`. This was safe to do before the delete
  precisely because the two files were byte-identical (SHA-256 match), so nothing was regenerated except
  the header — and the dependency was proved gone by running the generator with the old file hidden,
  rather than by grepping for the path. Keeping the generator pointed at an app instead of at a package is
  a wart, but it is the existing design (there is deliberately no second copy of the class list to keep in
  sync) and moving the file into `packages/tokens` is not R.6's job.
- **R.6 has a gate that is not "delete the folder": the API has no home yet.** Nuxt serves `/api/**` today
  through one catch-all, so the deploy has to come first or the API is orphaned for the deployed web app
  and for the mobile app. Recorded in PLAN.md, HUMAN_TODO.md and HANDOFF.md so a future session cannot
  delete its way into that.
- **R.6's repo half is split into "safe now" and "only with the delete".** The safe half (the generator
  path, the stale comments, the stray directories) is done. The half that changes which app `npm run dev`
  launches, and the Nuxt-only `overrides`, wait for the delete commit: flipping them early would make the
  default command run the half-ported app, which is worse than leaving them stale for one commit.

## 2026-10-04 — R.5: the landing page ported to React

- **The landing page does not redirect signed-in visitors.** `/` is in the Nuxt app's `PUBLIC_PATHS`
  (`apps/web/utils/publicPaths.ts`) and its global middleware only redirects *signed-out* visitors, so
  the Nuxt landing renders for a signed-in person too — which is why `start` has a signed-in wording at
  all. The R.4 placeholder's `navigate({ to: "/calendar" })` effect was a deviation from that, and it is
  gone. Parity means the page renders and the calls to action change wording.
- **`hero-rise` and `hero-drop` do nothing, and were left that way.** The hero uses
  `hero-rise` and `hero-drop`, but no rule for either exists anywhere in the Nuxt app: not in
  `assets/css/main.css`, not in any `<style>` block. The class names are inert, so the port keeps them
  inert rather than inventing the animation the names imply. Worth a look by the owner — the intent was
  presumably an entrance animation that was never written.
- **Vue scoped `<style>` blocks became plain, unlayered CSS in `src/styles.css`.** The Vue compiler's
  `data-v` attribute gave those rules a specificity edge over utilities; Tailwind's utilities live in
  `@layer utilities`, so unlayered CSS keeps the same edge. That is the same reasoning the file already
  gave for the touch rules, and it is why the landing CSS is appended at the end, outside every layer.
- **`PlannerMock` is split into a stateful half and a presentational one.** The Nuxt component measures
  the drag path with a `ResizeObserver` and gated the loop on an `IntersectionObserver`; both live in
  `PlannerMock`, which owns the refs, while `PlannerMockBody` is pure markup. Same DOM, same measured
  custom properties (`--dx`/`--dy`), no behaviour change.
- **Landing internals keep the Vue files' shape.** `LandingSteps`' three decorative scenes became three
  local components (`MonthScene`/`DragScene`/`TickScene`) and `LandingCta`'s CSS-string `style` props
  became style objects, because React cannot take a style string. Both are render-identical.

## 2026-10-04 — R.6: where the API lives, and how the site is served

- **`apps/api` runs on Cloud Run as `klndr-api`, in `klndr-app`, region `europe-west1`.** Chosen over
  Firebase Functions because it needs *no* adapter code: `createApp(config)` already returns a fetch
  handler and `src/server.ts` already runs it on plain Node, so the container runs the server that
  already exists and has already been tested. Region `europe-west1` is the closest fixed region to the
  `eur3` Firestore data (`eur3` is a multi-region, not a Cloud Run region). The image is
  `apps/api/Dockerfile`, built from the repo root; `NODE_ENV=production` makes it fail-closed, so a
  missing `FIREBASE_PROJECT_ID` stops the container instead of serving the `local-dev` user.
- **Firebase Hosting fronts it, so the API keeps the same origin as the web app.** `firebase.json`
  gained the `hosting` block the repo was missing: `apps/web-react/dist` is `public`, `/api/**` is
  rewritten to the `klndr-api` run service and `**` → `/index.html` covers the app's real paths.
  The rewrite order matters (`/api/**` first). This is what keeps CORS out of the design — the React
  app calls its own origin, exactly as it did behind Nuxt's `server/api/[...].ts` catch-all — and it is
  why the mobile app should be pointed at the Hosting origin rather than the Cloud Run URL.
- **The Nuxt rollback is a Hosting release, not a rebuild.** Because the React site replaces Nuxt on
  the same site, `firebase hosting:rollback` restores the previous release without rebuilding anything.
  That is also why deleting `apps/web` is the *last* step: until then Nuxt is both the live site and
  the source of the rollback.
- **`firebase deploy` now has a wider blast radius, and that is a deliberate trade.** Adding the `hosting`
  block means the bare command also publishes the site, where before it only released Firestore and Auth.
  That is a footgun while the React app is incomplete and the API is undeployed, so it is called out at the
  top of HUMAN_TODO.md's Phase R section and in HANDOFF.md's gotchas: deploy with `--only` until the
  sequence has been run, and `firebase hosting:rollback` if it slips through.
- **The `Dockerfile`'s `npm ci` layer copies every workspace `package.json`.** `npm ci` validates the
  lockfile against all workspace manifests, so they must be present even though only `packages/core`
  and `apps/api` are built from. **R.6 must drop the `apps/web/package.json` line in the same commit
  that deletes `apps/web`**, or that layer starts failing.

## 2026-10-04 — R.5: the day planner's leaves, and a hoisted dependency found on the way

- **The tooltip is hand-rolled, not a library.** `components/ui/tooltip/*.vue` were four thin wrappers
  over `reka-ui`, which is the Vue port of Radix. `apps/web-react` carries neither Radix nor any other
  tooltip primitive, and exactly one place in the whole app renders a tooltip
  (`ChecklistQuickAdd.vue`'s "Every day / This day only" buttons). Adding a dependency to reproduce four
  files for one usage is the wrong trade, so `src/components/ui/Tooltip.tsx` is ~90 lines with the same
  composition (`Tooltip` / `TooltipTrigger asChild` / `TooltipContent side`), the same `aria-describedby`
  wiring and the same hover+focus opening. If tooltips spread, this is the file to replace.
- **`emojibase-data` was a hoisted dependency, and that is a break waiting at the delete.**
  `apps/web-react/src/lib/emojis.ts` imports `emojibase-data/en/compact.json` and
  `emojibase-data/en/messages.json`, but the package was only ever declared by `apps/web`. It resolves
  today purely because npm hoists it into the repo-root `node_modules`, so `apps/web-react`'s build
  works while `apps/web` is in the tree. **The moment `apps/web` is deleted** — and the following
  `npm ci` rebuilds `node_modules` without it — the React app stops building. It is now declared in
  `apps/web-react/package.json` (`^17.0.0`, resolved 17.0.0) with the lockfile synced, so the delete is
  safe. Worth a general check before any similar delete: a workspace that imports a package it does not
  declare is invisible until the workspace that does is gone.
- **The checklist and the notes follow `@klndr/data`, not the Vue save loops.** `DailyChecklist.vue` and
  `DayNotes.vue` each carry their own debounce/optimistic/rollback machinery (~50 lines each). In React
  that is `useChecklist(day)` and `useNotesEditor(day)`, and the components only render. `DailyChecklist`
  takes the hook's full return value as a prop rather than calling the hook, so the shelf beside the
  timeline and the phone's sheet can drive one shared instance — the same reason `useTimelineHistory`
  keeps its engine in the data provider rather than the hook.



## 2026-10-04 — R.6: `apps/web` deleted, and the two Vue-only overrides kept

**Vue and Nuxt are gone from the repo.** The React port reached the point where `apps/web-react` draws the whole
product, including the day planner, so keeping the Nuxt app meant two implementations of one application — with the
maintenance cost and the "which one is authoritative?" ambiguity that comes with it. The deletion is an ordinary
commit: `git log`/`git revert` and the reflog reach the old app, and a deployed Nuxt release keeps serving until
Hosting is switched over, so nothing was destroyed that a checkout cannot restore.

Four things had to move in the same commit, each of which would otherwise have broken a build, a test or a deploy
(verified by the baseline in PROGRESS.md session 16):

- The root `package.json` scripts (`dev`/`build` now point at `apps/web-react`, `typecheck` no longer names
  `apps/web`) and the now-dead `typecheck:web`, the `dev`/`demo` configs in `.claude/launch.json`, and the
  `COPY apps/web/package.json` line in `apps/api/Dockerfile`.
- `apps/api/Dockerfile` deserves the note: its `npm ci` layer validates the lockfile against **every** workspace
  manifest, so a stale `COPY` there fails the image build, not the app. A front end's `package.json` is a build input
  even though no front-end code is ever copied in.
- `packages/tokens`' two byte-compare tests read `apps/web/lib/colors.ts` and `apps/web/assets/css/main.css` — they
  are the guard against the generated palette and theme drifting. They now read
  `apps/web-react/src/lib/colors.ts` and `apps/web-react/src/styles.css`. This is not a workaround: `generate.mts`
  already treated the React file as the source of truth (R.6's prerequisite), so the tests simply had to follow it.
- `apps/api/src/server.ts`'s `NUXT_PUBLIC_FIREBASE_PROJECT_ID` fallback, which only Nuxt — and only its public-env
  naming convention — ever set.

**Decision: keep the `oxc-parser` and `rolldown` `overrides`.** PLAN.md listed "try lifting them" at the delete,
since they read as Nuxt workarounds, and the instinct to remove the last trace of Nuxt is reasonable. They stay,
because their subject was never Nuxt: `oxc-parser@0.143.0`'s native binary is what this machine's Smart App Control
blocks, and Vite 8 also goes through rolldown and oxc. Lifting them could reintroduce a blocked binary, or move
`rolldown` onto the version that crashes, in exchange for nothing. Revisit only if the environment changes (Smart App
Control off, or a Vite/rolldown that no longer pulls that binding).

**Decision: no compatibility shim for anything that used to be Vue-only.** `reka-ui` (the Vue port of Radix) was
replaced by a hand-rolled `ui/Tooltip.tsx` during the port rather than kept as a dependency, and nothing was left in
the tree aliasing or stubbing the deleted app. One implementation, and it is the React one.

