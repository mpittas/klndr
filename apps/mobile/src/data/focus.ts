import { focusManager } from "@tanstack/react-query";
import { AppState } from "react-native";

/**
 * On a phone, "the window got focus" is "the app came to the foreground": stale data is fetched again then,
 * which is what a person coming back to the app expects to see updated. (TanStack Query listens for the
 * browser's `visibilitychange` by default, which doesn't exist here.)
 */
focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener("change", (status) => handleFocus(status === "active"));
  return () => subscription.remove();
});
