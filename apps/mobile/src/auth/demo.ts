import { newProfileData, toProfile, type UserProfile } from "@klndr/core";

import type { AuthUser } from "./types";

/** Who the app says you are in demo mode (`EXPO_PUBLIC_DEMO_MODE=1`): nobody real, and nothing leaves the phone. */
export const DEMO_USER: AuthUser = {
  uid: "demo",
  email: null,
  displayName: "Demo",
  photoURL: null,
  providerIds: [],
};

export const demoProfile = (): UserProfile =>
  toProfile(DEMO_USER.uid, {
    ...newProfileData({
      uid: DEMO_USER.uid,
      email: DEMO_USER.email,
      displayName: DEMO_USER.displayName,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  });
