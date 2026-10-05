# Human TODO

Things only the owner can do, grouped by what each item unblocks. Exact steps given.

## Task 0.1 — monorepo
- [ ] Move `.env` into `apps/web/` — Nuxt reads `.env` from the app folder. Do not commit it.
      The app still runs without it (credential-free dev mode serves the "local-dev" store),
      so the build is not blocked while this is pending.
- [ ] **How the web app is served — decided 2026-10-04 (see DECISIONS.md).** `firebase.json` now has
      the `hosting` block this repository was missing: the `klndr-app` Hosting site serves
      `apps/web-react/dist`, with `/api/**` rewritten to the `klndr-api` Cloud Run service (same
      origin, so no CORS) and `**` → `/index.html` for the app's real paths (`/calendar`,
      `/day/<date>`). The site it replaces was served from `apps/web/.output/public`; the exact
      deploy steps are under Phase R below. Nothing changes until you run them.

## Emoji picked by AI (2026-10-05)
- [ ] Deploy `firestore.rules` (`firebase deploy --only firestore:rules`) **before or with** the release that has this
      feature. Categories gained an optional `emoji` field, and until the rules allow it, creating or renaming a category
      is refused (403 "Not allowed") because the app now sends one. The same file also carries the pending color-key change.
- [ ] Set `OPENAI_API_KEY` on the Vercel project (Settings → Environment Variables, Production and Preview), and the same
      variable on the `klndr-api` Cloud Run service if that is still deployed. Without it nothing breaks: the API answers
      `{ "emoji": null }` and the app falls back to 📌 for an activity and 📁 for a category. Optional: `EMOJI_MODEL`
      (default `gpt-5.6-luna`). The key stays on the server; the browser never sees it. Env vars only reach a new deployment,
      so redeploy after setting it.
- [ ] Locally: put the key in `apps/api/.env`, run `npm run emoji:check -w apps/api` (asks the model for a few emoji and
      says why if it can't), then restart `npm run dev:api` (it does not re-read `.env` on its own).
- [ ] Try it once with the key set: add an activity named "Gym session" and a category named "Groceries". The forms were
      exercised in a browser with the API's answer stubbed, and the route and the request to OpenAI's API are covered by
      tests against a fake `fetch`, but no real model call has been made from this repository yet. `emoji:check` is the
      first thing that makes one: if it reports a 400, the message names the parameter OpenAI rejected.

## Environment (Windows) — Smart App Control
- [ ] Decide how to handle Smart App Control, which blocks the Windows binary in
      `@oxc-parser/binding-win32-x64-msvc@0.143.0` — the exact version `nuxt@3.21.11` pins.
      Until then the repo works around it by pinning `oxc-parser@0.144.0` in the root
      `overrides` (see DECISIONS.md).
      To remove the workaround: Windows Security → App & browser control → Smart App Control
      → Off. Note it cannot be turned back on without resetting Windows, so the choice is
      yours; leaving the override in place is harmless.

## Task 0.4 — store compliance
- [x] Deploy the updated `firestore.rules` (`firebase deploy --only firestore:rules`). The change is DONE 2026-10-03: released to klndr-app and re-read live.
      small: the owner may now delete their own profile document and the three `meta/*` seed markers
      (which is what account deletion needs) — updates to those documents are still refused.
- [ ] Apple Services ID, key, and the Firebase console setup for "Sign in with Apple" (the web button
      is in place, but Firebase needs the provider enabled before it works).
- [ ] Fill in the placeholders on the privacy policy and on the deletion page: `[COMPANY LEGAL NAME]`,
      `[CONTACT EMAIL]` and `[DATE]`. They are in `apps/web-react/src/routes/privacy.tsx` and
      `apps/web-react/src/routes/account-deletion.tsx`, and — while Nuxt is still the production app —
      in `apps/web/pages/privacy.vue` and `apps/web/pages/account-deletion.vue`. Then review the draft policy.
- [ ] Once Firebase is configured, delete a throwaway account and check in the Firestore console that
      nothing is left. The dev-mode run proves the endpoint and the in-memory store, but the Firestore
      path and the new rules can only be exercised against a real project (the emulator needs Java —
      see Task 3.2).

## Task 1.1 — mobile app identity
- [ ] Confirm the iOS bundle id / Android package (placeholder `com.klndr.app`). It cannot
      change after the first store release.
- [x] `eas init` once you have an Expo account (it writes the EAS project id). `eas.json` currently
      uses `"appVersionSource": "local"` so builds work without a project; switch it to `remote` if
      you would rather EAS own the build numbers.
- [x] Put the Firebase native config files in `apps/mobile/` (`google-services.json`,
      `GoogleService-Info.plist`) for store builds, or point `GOOGLE_SERVICES_JSON` /
      `GOOGLE_SERVICES_INFO_PLIST` at them. They are gitignored, so EAS needs them as file
      environment variables.

## Task 1.2 — the design system on a device
- [ ] On a device or simulator build: switch the theme (System / Light / Dark), then force-quit and
      relaunch — the choice has to survive, and no frame should flash the wrong theme.
- [ ] Open the sheet (the button on the home screen): check the detents, the grabber, swipe-down to
      dismiss, and the primary action staying above the home indicator.
- [ ] Check the native menu (Expo UI `Picker`) and the date/time picker in both themes.
- [ ] Set the largest system text size and confirm nothing clips — the header, buttons, list rows and,
      in Phase 2, the timeline.
- [ ] Turn on Reduce Motion and confirm the skeleton placeholder holds still.

## Task 1.3 — auth on a device
Needs a dev build with the Firebase config files in `apps/mobile/` (see Task 1.1) and a real Firebase project.
- [ ] Firebase console: enable the Email/Password, Google and Apple providers (Apple needs the Services ID and
      key from Task 0.4 as well; Apple on Android uses the same web flow, so the Firebase redirect handler
      must be an authorised return URL for that Services ID).
- [ ] Google: register the Android app's SHA-1 and SHA-256 (debug and the EAS keystore) in Firebase, then set
      `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` to the *web* client id. Without the SHA, Google sign-in on Android
      fails with a developer error.
- [ ] iOS only: confirm "Sign in with Apple" is enabled for the App ID, and do the first iOS dev build — the
      Firebase pods are built as dynamic frameworks (`expo-build-properties`), the setup React Native
      Firebase documents for Expo. The first attempt (`disableSPM`) failed in "Install pods" and was fixed;
      this one is not yet proven by a successful EAS build.
- [ ] Try each path: email sign-up (the name shows in Settings), email sign-in, a wrong password (message),
      password reset (email arrives), Google, Apple. Kill and relaunch: still signed in, no signed-out flash.
- [ ] Sign out lands on sign-in; a deep link while signed out (`klndr://`) lands on sign-in, not a blank screen.
- [ ] A new account has a `users/{uid}` document that looks the same as one created on the web.
- [ ] Demo mode: `EXPO_PUBLIC_DEMO_MODE=1` with the web dev server running opens straight into the tabs.
- [ ] Hand-check the keyboard on the sign-up form (four fields): the focused field and the button stay visible.

## Task 3.2 — rules tests
- [ ] Run the Firestore rules tests (the emulator needs Java installed).

## Task 4.2 — deep links
- [ ] Provide the Apple Team ID and the Android signing certificate SHA-256.

## Task 4.3 — artwork
- [ ] Provide final app-icon artwork.

## Task 4.4 — release
- [ ] Create the App Review demo account.

## Phase R — the web app in React
- [ ] **`firebase deploy` now publishes the website too — deploy with `--only` until the steps below are
      done.** `firebase.json` gained a `hosting` block (see the item under Task 0.1), so the bare command
      that used to release only Firestore and Auth would now also replace the live Nuxt site with
      `apps/web-react/dist` — whose API is not deployed yet. The React app does draw the whole product now
      (`apps/web` has been deleted from the repo, R.6), so the only thing between this deploy and a working
      site is the sequence below. Until it is complete, use `firebase deploy --only firestore:rules`,
      `--only firestore:indexes` or `--only auth`. If it does happen, `firebase hosting:rollback` puts
      the previous release (Nuxt) back.
- [ ] Once `apps/web-react` is the app you use, copy `apps/web-react/.env.example` to
      `apps/web-react/.env` and fill in the Firebase web config (the same values as the Nuxt app's
      `.env`). Without it the React app runs credential-free: the auth gate stays open and the API
      answers as its `local-dev` user. Nothing is blocked while this is pending.
- [ ] **Deploy the API, then move the site — decided 2026-10-04 (see DECISIONS.md).** `apps/api`
      runs as the `klndr-api` Cloud Run service in the `klndr-app` project (region `europe-west1`,
      next to the `eur3` Firestore data), and Firebase Hosting puts it behind the same origin as the
      web app. `apps/api/Dockerfile` and the `hosting` block in `firebase.json` are in place; these
      are the commands, and they are the whole of R.6's live half. **This is now the last thing outstanding
      in R.6**: `apps/web` has already been deleted from the repo, so the Nuxt catch-all that used to serve
      `/api/**` in production can no longer be rebuilt or redeployed. The running release keeps answering
      until Hosting is switched over; after that the API has to be up, or the web app and the mobile app's
      `EXPO_PUBLIC_API_BASE_URL` have nothing behind them.

      1. Build and push the image (Artifact Registry, `klndr` repository, same region):
         ```bash
         docker build -f apps/api/Dockerfile -t europe-west1-docker.pkg.dev/klndr-app/klndr/klndr-api .
         docker push europe-west1-docker.pkg.dev/klndr-app/klndr/klndr-api
         ```
      2. Deploy the service. `--allow-unauthenticated` is required: the API checks the Firebase ID
         token itself (`firebase.rules` is enforced through that token), and Hosting is a plain
         caller. The container is fail-closed, so `FIREBASE_PROJECT_ID` is not optional.
         ```bash
         gcloud run deploy klndr-api \
           --image europe-west1-docker.pkg.dev/klndr-app/klndr/klndr-api \
           --region europe-west1 --project klndr-app \
           --set-env-vars FIREBASE_PROJECT_ID=klndr-app \
           --allow-unauthenticated
         ```
      3. Check it answers on its own URL before anything is switched over: `/api/health` returns
         `{"ok":true}` with no token (it is the one unauthenticated route).
      4. Move the mobile app: point `EXPO_PUBLIC_API_BASE_URL` at the Hosting origin (not the Cloud
         Run URL), so phone and web use the same one.
      5. Put the React site up (this replaces the live Nuxt site on the same domain):
         ```bash
         npm run build:web-react && firebase deploy --only hosting
         ```
      6. **Rollback is now Hosting-only.** `firebase hosting:rollback` returns the site to the previous
         release, which is the last Nuxt deploy — nothing has to be built for it. `apps/web` has already
         been deleted from the repo (R.6, 2026-10-04), so that rollback target is the last one that will
         ever exist; recover the source from git history if it ever has to be changed.
- [x] **Done, in the commit that removed it: the hoisting check and the three delete-time edits.**
      No package `apps/web-react` imports is left undeclared (`emojibase-data`, the one case, is declared by
      `apps/web-react`). The root `package.json` scripts, the `dev`/`demo` configs in `.claude/launch.json`
      and the `COPY apps/web/package.json` line in `apps/api/Dockerfile` were all handled together with
      `.gitignore`/`.dockerignore`, the two `packages/tokens` tests that read the deleted app's `colors.ts`
      and `main.css`, and `server.ts`'s Nuxt-only `NUXT_PUBLIC_FIREBASE_PROJECT_ID` fallback.
- [x] CORS: not needed, and deliberately so. The API is reachable only through the Hosting rewrite
      (`/api/**` → Cloud Run), so the web app calls its own origin exactly as it did behind Nuxt's
      catch-all. The mobile app calls the same origin. If a later change puts them on different
      origins, CORS has to be added to the API at that point.

## Task R.2 — the data layer on a device
Needs a development build; the existing one works, because no native dependency was added.
- [ ] Cold start while signed in: no flash of a blank screen or the sign-in screen as the app opens (the
      navigator now mounts when auth has settled, not before).
- [ ] Sign out, then check the app's data is gone: sign in as someone else and confirm none of the first
      person's data appears, not even for a moment.
- [x] Add expo-network with the next native build (implemented 2026-10-04; successful local simulator build).
- [ ] Confirm stale data refetches after losing and regaining connection on a device.


## Tasks 2.1–2.2 — Day timeline and task editor on a device

The implementation is present and both native bundles pass. Interactive acceptance remains open.
The local simulator dev build includes expo-network; an older phone build needs rebuilding.

- [ ] Simulator: click Open in the pending “Open in klndr?” prompt. Local Metro is on 8082 and
      the demo API is on 3101. A physical phone needs the Mac's LAN address rather than 127.0.0.1.
- [ ] Header: previous/next, Today, date sheet, swipe both ways, cancel a swipe, undo and redo.
- [ ] Open a seeded day and an empty day: scroll to the first block or 07:00, check the live now-line.
- [ ] Tap an empty slot to create, tap a block to edit, tap its ring to toggle. Edit/delete in the sheet
      and undo/redo from the header.
- [ ] Hold 300 ms and drag to another quarter-hour and column, including overlap, top/bottom edge
      scrolling, canceled/interrupted gestures and a second finger. Resize to 15 minutes and midnight.
- [ ] Force a save failure: position/size/toggle roll back and show an error. Offline reconnect refreshes.
- [ ] New block: apply a template, choose an emoji, create a category, change the date/start/duration,
      write notes, save and reopen. Check start/duration near midnight and rapid repeated Save presses.
- [ ] Android: date and time dialogs open only after tapping their fields; cancel, reopen and confirm.
- [ ] iOS/Android: keyboard does not hide the focused field/footer; sheets dismiss and reopen cleanly.
- [ ] Dark theme, largest text size, Reduce Motion and VoiceOver/TalkBack: edit/toggle/move/resize
      actions work and labels include the task's title and time range.
