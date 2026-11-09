import { cleanPatch, type ProfilePatch, type UserProfile } from "@klndr/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../keys";
import { useData } from "../provider";

/**
 * Where the profile lives. It is a Firestore document, read and written through each platform's own
 * Firebase SDK, so the app supplies this (the web app's Firebase JS SDK, the phone's React Native Firebase).
 * `save` receives fields already checked by `cleanPatch`.
 */
export type ProfileSource = {
  /** Read the profile, creating it on a first sign-in (see `loadOrCreateProfile`). */
  load(): Promise<UserProfile>;
  save(patch: Record<string, string | number | boolean>): Promise<UserProfile>;
};

function sourceOf(profile: ProfileSource | null): ProfileSource {
  if (!profile) throw new Error("Pass a `profile` source to <DataProvider> to use the profile hooks");
  return profile;
}

/** The signed-in user's profile. Does nothing until the provider has a `profile` source. */
export function useProfile() {
  const { profile } = useData();
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: () => sourceOf(profile).load(),
    enabled: profile !== null,
  });
}

/**
 * Edit the profile. The change shows at once and is put back if saving fails; a value the profile doesn't
 * accept is refused with a message fit to show (`error.message`) before anything is shown or sent.
 */
export function useUpdateProfile() {
  const { profile } = useData();
  const queryClient = useQueryClient();

  return useMutation<UserProfile, Error, ProfilePatch, { before?: UserProfile }>({
    mutationKey: ["profile", "update"],
    mutationFn: (patch) => sourceOf(profile).save(cleanPatch(patch)),
    onMutate: async (patch) => {
      const clean = cleanPatch(patch); // throws before anything changes
      await queryClient.cancelQueries({ queryKey: queryKeys.profile });
      const before = queryClient.getQueryData<UserProfile>(queryKeys.profile);
      if (before) queryClient.setQueryData<UserProfile>(queryKeys.profile, { ...before, ...clean });
      return { before };
    },
    onSuccess: (saved) => queryClient.setQueryData(queryKeys.profile, saved),
    onError: (_error, _patch, context) => {
      if (context?.before) queryClient.setQueryData(queryKeys.profile, context.before);
    },
  });
}
