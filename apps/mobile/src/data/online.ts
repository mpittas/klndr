import { onlineManager } from "@tanstack/react-query";
import { addNetworkStateListener, getNetworkStateAsync } from "expo-network";

/**
 * Tells TanStack Query when the phone is online. It pauses requests while there is no connection and, the moment
 * the connection is back, fetches again what is stale and retries what failed for lack of it — which is what a
 * person walking out of a lift expects. (TanStack Query listens for the browser's `online` and `offline` events by
 * default, and there are none here.)
 *
 * "Online" is `isInternetReachable` where the platform knows it, and plain `isConnected` where it does not yet.
 */
onlineManager.setEventListener((setOnline) => {
  let live = true;
  let observed = false;
  void getNetworkStateAsync().then((state) => {
    if (live && !observed) setOnline(state.isInternetReachable ?? state.isConnected ?? true);
  }).catch(() => { /* Keep the current state if the OS could not answer. */ });
  const subscription = addNetworkStateListener((state) => {
    observed = true;
    setOnline(state.isInternetReachable ?? state.isConnected ?? true);
  });
  return () => {
    live = false;
    subscription.remove();
  };
});
