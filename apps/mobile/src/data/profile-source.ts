import { toProfile, type UserProfile } from "@klndr/core";
import type { ProfileSource } from "@klndr/data";

import { demoProfile } from "@/auth/demo";
import type { AuthService, AuthUser } from "@/auth/types";

/**
 * The profile as `@klndr/data`'s `useProfile` and `useUpdateProfile` read and write it: `users/{uid}` through
 * the auth service (the native Firestore SDK), or, in demo mode where there is no sign-in, a profile kept in
 * memory so the Settings screen still works.
 */
export function createProfileSource(user: AuthUser, service: AuthService | null): ProfileSource {
  if (service) {
    return {
      load: () => service.loadProfile(user),
      save: (fields) => service.saveProfile(user, fields),
    };
  }

  let demo: UserProfile = demoProfile();
  return {
    load: async () => demo,
    save: async (fields) => {
      demo = toProfile(demo.uid, { ...demo, ...fields });
      return demo;
    },
  };
}
