# @klndr/mobile — the iOS and Android app

Expo (React Native) + Expo Router, sharing `@klndr/core` and `@klndr/tokens` with the web app. The
work is planned in `docs/mobile-port/PLAN.md`; the reasoning lives in `DECISIONS.md` next to it.

## Commands

Run from the repository root, so the workspace dependencies resolve:

```sh
npm install                          # once, at the root — installs every workspace
npm run typecheck                    # web, mobile, core and tokens
npm run start   -w apps/mobile       # Metro, then press a / i
npm run android -w apps/mobile       # Metro + an Android device or emulator
npm run ios     -w apps/mobile       # Metro + an iOS device or simulator
```

`npm start` needs a development build (`eas build --profile development`, see `eas.json`): once a
native module is in play, Expo Go cannot run the app.

## Signing in

- **With Firebase:** put `google-services.json` and `GoogleService-Info.plist` in this folder (or point
  `GOOGLE_SERVICES_JSON` / `GOOGLE_SERVICES_INFO_PLIST` at them), set `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`,
  and make a development build. The native Firebase, Google and Apple plugins switch on when a config file
  is present (and always on EAS, so a missing file fails the build).
- **Without Firebase:** set `EXPO_PUBLIC_DEMO_MODE=1`. There is no sign-in and the API is called without a
  token, so run the web app locally (`npm run dev`) and point `EXPO_PUBLIC_API_BASE_URL` at it.
- A build with neither shows a "Sign-in isn't set up" screen rather than crashing.

Auth lives in `src/auth/`: `types.ts` is the interface, `firebase.ts` implements it on React Native Firebase, and
`provider.tsx` drives the gate in `src/app/_layout.tsx`.

## Environment

Copy `.env.example` to `.env`, which is gitignored; that file lists the names and their meanings.
`EXPO_PUBLIC_*` values are inlined into the bundle at build time and read through `src/env.ts`.
