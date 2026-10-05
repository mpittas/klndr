import type { ConfigContext, ExpoConfig } from "expo/config";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
/**
 * The app identity. iOS cannot change the bundle id after the first store release and Android
 * cannot change the package either, so both come from this one constant — HUMAN_TODO: confirm it
 * before the first store build.
 */
const BUNDLE_ID = "com.klndr.app";

/** The EAS project (itsamemarios/klndr), written by `eas init`, which cannot edit a dynamic config. */
const EAS_PROJECT_ID = "da8a4d07-9389-46ab-bdd2-ff2bb3f87e04";

/** The project root and the two Firebase native config files (build inputs, not bundle values). */
const projectRoot = __dirname;
const GOOGLE_SERVICES_JSON = process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json";
const GOOGLE_SERVICES_PLIST = process.env.GOOGLE_SERVICES_INFO_PLIST ?? "./GoogleService-Info.plist";

/**
 * The path to a config file, if it is actually there. Both files are gitignored (they are project
 * configuration, and EAS supplies them per environment), so a checkout without them still starts:
 * the app runs in demo mode without Firebase, and a build for the stores needs them present.
 */
function nativeConfigFile(relativePath: string): string | undefined {
  return existsSync(resolve(projectRoot, relativePath)) ? relativePath : undefined;
}

/**
 * The iOS URL scheme Google sign-in needs: the reversed client id, which GoogleService-Info.plist holds.
 * `GOOGLE_IOS_URL_SCHEME` overrides it (and is the only source when the plist is supplied some other way).
 */
function googleIosUrlScheme(plistPath: string | undefined): string | undefined {
  if (process.env.GOOGLE_IOS_URL_SCHEME) return process.env.GOOGLE_IOS_URL_SCHEME;
  if (!plistPath) return undefined;
  const plist = readFileSync(resolve(projectRoot, plistPath), "utf8");
  return plist.match(/<key>REVERSED_CLIENT_ID<\/key>\s*<string>([^<]+)<\/string>/)?.[1];
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleServicesJson = nativeConfigFile(GOOGLE_SERVICES_JSON);
  const googleServicesPlist = nativeConfigFile(GOOGLE_SERVICES_PLIST);
  const iosUrlScheme = googleIosUrlScheme(googleServicesPlist);

  // The native Firebase plugins need the config files and throw without them. A checkout that has neither
  // still starts (it runs in demo mode), so the plugins are added when either file is there — and on EAS
  // always, so a store build with a file missing fails at build time instead of shipping without sign-in.
  const withFirebase = Boolean(googleServicesJson || googleServicesPlist || process.env.EAS_BUILD);

  const firebasePlugins: NonNullable<ExpoConfig["plugins"]> = withFirebase
    ? [
        "@react-native-firebase/app",
        "@react-native-firebase/auth",
        // Google sign-in's iOS URL scheme (the reversed client id); the plugin throws without one.
        ...(iosUrlScheme ? [["@react-native-google-signin/google-signin", { iosUrlScheme }] as [string, object]] : []),
      ]
    : [];

  return {
    ...config,
    name: "klndr",
    slug: "klndr",
    scheme: "klndr",
    version: "0.1.0",
    orientation: "portrait",
    platforms: ["ios", "android"],
    // Both themes are real, and the app follows the system setting (see 1.2 for the override).
    userInterfaceStyle: "automatic",
    icon: "./assets/images/icon.png",
    ios: {
      bundleIdentifier: BUNDLE_ID,
      // The day planner is a phone app; a tablet layout is out of scope.
      supportsTablet: false,
      icon: "./assets/expo.icon",
      // Task 1.3 uses this; the capability has to be declared for the native build.
      usesAppleSignIn: true,
      // The app only uses the encryption the OS and HTTPS provide, which is exempt: this answers
      // Apple's export-compliance question once, instead of at every build and every TestFlight upload.
      infoPlist: { ITSAppUsesNonExemptEncryption: false },
      ...(googleServicesPlist ? { googleServicesFile: googleServicesPlist } : {}),
    },
    android: {
      package: BUNDLE_ID,
      // Edge-to-edge is always on from SDK 57, so it is not a setting any more.
      // Android 16 predictive back, off until expo-router declares support.
      predictiveBackGestureEnabled: false,
      ...(googleServicesJson ? { googleServicesFile: googleServicesJson } : {}),
    },
    plugins: [
      "expo-router",
      "expo-apple-authentication",
      // The Firebase iOS SDK comes in through Swift Package Manager (React Native Firebase's default), which needs
      // the iOS pods built as dynamic frameworks. It is not tied to the config files below: the Firebase native
      // modules are linked whether or not they are there, so a build without them (a local simulator build in demo
      // mode) fails in "Install pods" without it, as the first EAS build did (see DECISIONS.md, task 1.3).
      ["expo-build-properties", { ios: { useFrameworks: "dynamic" } }],
      ...firebasePlugins,
      [
        "expo-splash-screen",
        {
          // Placeholder artwork and colour: task 4.3 generates the real ones from the calendar mark.
          backgroundColor: "#ffffff",
          image: "./assets/images/splash-icon.png",
          imageWidth: 76,
        },
      ],
    ],
    extra: {
      ...config.extra,
      eas: { projectId: EAS_PROJECT_ID },
    },
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
  };
};
