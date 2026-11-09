import { createMMKV } from "react-native-mmkv";

/**
 * The one place the app touches local storage.
 *
 * MMKV is synchronous and plain, which suits the handful of values kept on the device: the theme
 * preference here, and later the persisted query cache (task 1.4) and the emoji recents. Everything
 * that persists something goes through this instance, so there is one place to look when a value is
 * stale after an upgrade.
 */
export const storage = createMMKV({ id: "klndr" });
