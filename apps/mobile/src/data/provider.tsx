import { DataProvider } from "@klndr/data";
import { useCallback, useMemo, useRef, type PropsWithChildren } from "react";

import { api } from "@/api";
import { useAuth } from "@/auth";
import { useToast } from "@/components/ui";

import "./focus";
import "./online";
import { createLiveChanges } from "./live-changes";
import { queryPersister } from "./persister";
import { createProfileSource } from "./profile-source";

/**
 * The app's data layer (`@klndr/data`) wired to this app: the API client, the signed-in person, a toast for
 * the messages the hooks produce, the profile source the Settings screen reads, the cache kept in MMKV and the
 * live feed of what the person changes on their other devices.
 *
 * It renders nothing until auth has settled. `DataProvider` treats "no user" as *signed out* and wipes the
 * saved cache, which must not happen merely because Firebase hasn't yet said whether a session was restored.
 */
export function AppDataProvider({ children }: PropsWithChildren) {
  const { state, service } = useAuth();
  const toast = useToast();
  const notify = useCallback((message: string) => toast.show({ message }), [toast]);

  const signedIn = state.status === "signed-in" ? state.user : null;
  const userId = signedIn?.uid ?? null;
  const latestUser = useRef(signedIn);
  latestUser.current = signedIn;

  // One source per person, not per render: its identity is what the profile query is keyed on.
  const profile = useMemo(
    () => (userId && latestUser.current ? createProfileSource(latestUser.current, service) : undefined),
    [userId, service],
  );

  // Only a real, signed-in person has other devices to hear from (not demo mode).
  const liveChanges = useMemo(() => (userId && service ? createLiveChanges(userId) : undefined), [userId, service]);

  if (state.status === "loading") return null;

  return (
    <DataProvider api={api} userId={userId} notify={notify} persister={queryPersister} profile={profile} liveChanges={liveChanges}>
      {children}
    </DataProvider>
  );
}
