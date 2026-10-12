const { withAppDelegate, withInfoPlist } = require("expo/config-plugins");

/** The scene delegate's Objective-C name: what Info.plist points at, and what AppDelegate.swift declares. */
const SCENE_DELEGATE = "KlndrSceneDelegate";

/**
 * iOS 27 traps at launch (EXC_BREAKPOINT in `UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`, which
 * the user sees as "klndr shut down unexpectedly") unless the app adopts the UIScene life cycle. Expo ships the
 * pieces (`ExpoAppSceneDelegate`, `ExpoReactNativeFactoryProvider`) but its prebuild template does not use them
 * yet, so this plugin wires them in. It lives in the config, not in `ios/`, because `ios/` is generated and
 * gitignored: a fresh checkout, `expo prebuild --clean` or an EAS build all get the fix.
 *
 * Remove it once the template adopts scenes itself. (Plain CommonJS: Expo loads config plugins with `require`,
 * which does not read TypeScript.)
 */
/** @type {import("expo/config-plugins").ConfigPlugin} */
const withIosSceneLifecycle = (config) => {
  config = withInfoPlist(config, (mod) => {
    mod.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          { UISceneConfigurationName: "Default Configuration", UISceneDelegateClassName: SCENE_DELEGATE },
        ],
      },
    };
    return mod;
  });

  return withAppDelegate(config, (mod) => {
    if (mod.modResults.language !== "swift") {
      throw new Error("with-ios-scene-lifecycle: expected a Swift AppDelegate.");
    }
    mod.modResults.contents = adoptScenes(mod.modResults.contents);
    return mod;
  });
};

/** The Swift edits. Idempotent, and loud when the template has changed shape rather than half-applied. */
/** @param {string} source */
function adoptScenes(source) {
  if (source.includes(SCENE_DELEGATE)) return source;

  let next = source.replace(
    /class AppDelegate: ExpoAppDelegate \{/,
    "class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {",
  );

  // The scene delegate creates the window and starts React Native now, so the app delegate must not.
  next = next.replace(
    /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/,
    "\n    // iOS 27 requires the scene life cycle: the scene delegate creates the window and starts React Native.\n",
  );

  next = next.replace(
    /\nclass ReactNativeDelegate:/,
    `\n@objc(${SCENE_DELEGATE})\nclass ${SCENE_DELEGATE}: ExpoAppSceneDelegate {}\n\nclass ReactNativeDelegate:`,
  );

  const adopted =
    next.includes("ExpoReactNativeFactoryProvider") &&
    next.includes(`class ${SCENE_DELEGATE}`) &&
    !next.includes("factory.startReactNative");
  if (!adopted) {
    throw new Error(
      "with-ios-scene-lifecycle: AppDelegate.swift no longer looks like the template this plugin patches. " +
        "Check whether Expo's template adopts scenes itself, and update or remove the plugin.",
    );
  }
  return next;
}

module.exports = withIosSceneLifecycle;
module.exports.adoptScenes = adoptScenes;
