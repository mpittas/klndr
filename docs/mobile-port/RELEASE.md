# Releasing klndr to the Apple App Store

A runbook, in the order things have to happen. Tick items as you go. Items marked **(you)** need your own
accounts or decisions and cannot be done by a script. The app is `com.klndr.app`, built with EAS (account
`itsamemarios`, project `klndr`) and signed by Apple team **Marios Pittas (Y6H5QN6TFC)**.

Related: `HUMAN_TODO.md` (open owner tasks), `PLAN.md` (Phase 4), `apps/mobile/README.md` (simulator builds).

---

## 0. Before anything: decisions that cannot be undone

- [ ] **(you)** Confirm the bundle id `com.klndr.app`. It is fixed after the first App Store release.
- [ ] **(you)** Confirm the app name as it appears on the App Store ("klndr"). It must be unique on the store;
      if it is taken, App Store Connect tells you when you create the app (step 4) and you can add a subtitle or
      change the name then. The name on the home screen (`name` in `apps/mobile/app.config.ts`) can differ.

## 1. The production backend must be live  ✅ checked 2026-10-12

A store build talks to a public **HTTPS** API. iOS blocks plain `http://` in release builds, so the LAN addresses
used for development will not work, and the reviewer cannot reach your Mac.

Production is **`https://klndr.xyz` on Vercel** (the web app and the Hono API from `apps/api`, see `vercel.json`),
not the Cloud Run + Hosting plan in `HUMAN_TODO.md` Phase R. Checked live: `/api/health` returns `{"ok":true}`,
a data route without a token returns 401 (fail-closed), and `/privacy`, `/terms` and `/account-deletion` load.

- [x] API reachable over HTTPS with auth enforced.
- [x] EAS `production` environment has `EXPO_PUBLIC_API_BASE_URL=https://klndr.xyz` and
      `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
- [x] EAS `production` environment has the `GOOGLE_SERVICES_INFO_PLIST` file secret (the Firebase iOS app
      `1:379750636201:ios:161b661b9e698763dca7b8`). Without it the production build fails in prebuild.
- [x] `EXPO_PUBLIC_DEMO_MODE` is not set for `production` (demo mode skips sign-in; a store build must not).
- [x] Firestore rules: the live rules match `firestore.rules` (category emoji field and sync stamps present).
- [x] Decision: the AI-emoji feature stays **on** for v1. The privacy policy already discloses OpenAI. Make sure
      `OPENAI_API_KEY` is set on the Vercel project (Production), or the app just falls back to 📌 / 📁.

## 2. Sign-in has to work end to end

- [ ] **(you)** Firebase console → Authentication → enable **Email/Password**, **Google** and **Apple**.
- [ ] **(you)** Apple: create the Services ID and key for Sign in with Apple and add them in Firebase
      (`HUMAN_TODO.md`, Task 0.4). Apple's rule 4.8 requires Sign in with Apple whenever another social login
      (Google) is offered, so this is not optional.
- [ ] Google on iOS needs `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (already set on EAS `development`; set it for
      `production` too) and `GoogleService-Info.plist` (already stored as the EAS secret `GOOGLE_SERVICES_INFO_PLIST`;
      check it exists for the production environment: `npx eas-cli env:list production`).
- [ ] On a real build, test: email sign-up, sign-in, wrong password, password reset, Google, Apple, sign out,
      relaunch (stays signed in), delete a throwaway account.

## 3. Content Apple will check

- [ ] **Privacy policy URL**, public and reachable without signing in: `https://<your-domain>/privacy`
      (`apps/web-react/src/routes/privacy.tsx`). Check it names the operator and contact (`src/lib/legal.ts`) and
      that the placeholders listed in `HUMAN_TODO.md` Task 0.4 are gone.
- [ ] **Account deletion** is in the app (Settings → delete account) and on the web (`/account-deletion`). Apple
      requires both an in-app path and a working explanation.
- [ ] **Terms** page exists at `/terms`.
- [x] App icon: generated from the web calendar mark on the brand navy, 1024×1024, no alpha
      (`apps/mobile/assets/images/icon.png`, source `icon-source.svg`). Splash uses the same mark. Swap in final
      artwork any time; keep it opaque. The Android adaptive icons are still placeholders (not needed for iOS).
- [ ] **Demo account for App Review**: create a real account in the production Firebase project, with a little
      sample data, and keep its email and password for step 6. Reviewers cannot use Apple or Google sign-in
      reliably, so give them email + password.

## 4. Create the app in App Store Connect  **(you)**

At <https://appstoreconnect.apple.com> → Apps → **+** → New App:

- Platform **iOS**, name, primary language, **Bundle ID `com.klndr.app`** (it appears in the list because EAS
  already registered it), SKU (any unique string, e.g. `klndr-ios`).
- Then fill in the **App Information** and the first version page:
  - Subtitle (30 chars), promotional text, description, keywords (100 chars total), support URL (a page or a
    `mailto:` page that works), marketing URL (optional).
  - Category: **Productivity** (secondary: Lifestyle).
  - Age rating questionnaire (no objectionable content: expect 4+).
  - Copyright line.
  - **Screenshots**: 6.9-inch iPhone is required (e.g. iPhone 18 Pro Max); smaller sizes are scaled from it.
    Take them from a real build or the simulator, with demo data: Day timeline, new block, Calendar, Library,
    Settings, dark mode.
- **App Privacy** (the "nutrition label"): see the draft answers below.
- **Pricing**: Free. **Availability**: all countries, or pick.

### Draft App Privacy answers (verify against the code before submitting)

| Data | Collected | Linked to the user | Used for tracking |
|---|---|---|---|
| Email address, name, phone, location text (Settings → profile) | Yes | Yes | No |
| User content: blocks, activities, categories, checklists, notes | Yes | Yes | No |
| User ID (Firebase uid) | Yes | Yes | No |
| Diagnostics / crash data | Only if you add a crash reporter | – | No |

Purpose for all of the above: **App Functionality**. Answer **No** to "Do you or your third-party partners use
data for tracking": the app has no ads and no analytics SDK.

⚠ **Check before answering:** when `OPENAI_API_KEY` is set, the API sends a block, activity or category **title**
to OpenAI to choose an emoji (`apps/api`, see `HUMAN_TODO.md` "Emoji picked by AI"). Titles are user content
leaving your servers for a third party. Disclose it in the privacy policy, and in App Privacy treat it as user
content shared with a service provider, or leave the key unset for the first release.

## 5. Build and upload

```bash
cd apps/mobile
# Raise the build number first: eas.json uses appVersionSource "local".
#   app.config.ts -> ios.buildNumber (a string: "1", "2", ...). The first upload can be "1".
npx eas-cli build --profile production --platform ios
npx eas-cli submit --platform ios --latest
```

- The build runs on EAS (about 15–25 minutes). `submit` asks for your Apple ID, or an App Store Connect API key
  (App Store Connect → Users and Access → Integrations → Keys); the key avoids two-factor prompts next time.
- The build appears in App Store Connect → TestFlight after Apple's processing (10–30 minutes). You get an email.
- Each new upload needs a **higher build number**, and each new store version a higher `version`.
- Export compliance is pre-answered (`ITSAppUsesNonExemptEncryption: false` in the config), so Apple does not ask.

## 6. Test it in TestFlight before submitting

- [ ] Add yourself under TestFlight → Internal Testing, install the **TestFlight** app on your iPhone, install the build.
- [ ] Go through `HUMAN_TODO.md`'s device checklists (Tasks 1.2, 1.3, 2.1–2.7): sign-in paths, Day timeline, editor,
      Calendar, Library, Settings, dark mode, largest text size, relaunch.
- [ ] Check it against the **production** API, not your Mac: turn Wi-Fi off and on, create a block on the phone and
      see it on the web.

## 7. Submit for review

In App Store Connect → the version page:

- [ ] Select the processed build.
- [ ] **App Review Information**: the demo account's email and password (step 3), your contact phone and email,
      and notes. Suggested notes:
      > klndr is a daily planner. Sign in with the demo account above (email + password). Blocks are created with
      > the + button on the Day tab. Account deletion: Settings → Delete account. Sign in with Apple and Google
      > are also offered.
- [ ] Version release: **Manually release** is safest for a first version (you press the button after approval).
- [ ] Press **Add for Review**, then **Submit to App Review**. A first review usually takes 1–3 days.

## 8. If Apple rejects it

The message arrives in App Store Connect's Resolution Center and by email. Common ones for this kind of app:

- **Sign in with Apple missing or broken** (4.8): fix step 2, resubmit.
- **Cannot sign in** with the demo account: check it works against production, reply with a working one.
- **Privacy policy / data collection mismatch** (5.1.1): align the policy, the App Privacy labels and the app.
- **Account deletion** (5.1.1(v)): point the reviewer to Settings → Delete account.
- **Crash on launch**: reproduce with a TestFlight build; an iOS-version crash looks like the iOS 27 scene issue
  (see `apps/mobile/plugins/with-ios-scene-lifecycle.js`).

Fix, raise `buildNumber`, rebuild, upload, reply to the reviewer, resubmit.

## 9. Releasing updates later

JavaScript-only changes can ship without a new native build only if you add EAS Update (not set up). Until then,
every release is: bump `version` and `buildNumber` → `eas build --profile production` → `eas submit` → TestFlight
check → submit for review.

## Quick reference

| What | Where |
|---|---|
| EAS project | <https://expo.dev/accounts/itsamemarios/projects/klndr> |
| Build profiles | `apps/mobile/eas.json` (`development`, `preview`, `production`) |
| App config, bundle id, plugins | `apps/mobile/app.config.ts` |
| Apple team | Marios Pittas, `Y6H5QN6TFC` |
| Open owner tasks | `docs/mobile-port/HUMAN_TODO.md` |
| Simulator and dev builds | `apps/mobile/README.md` |
