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
