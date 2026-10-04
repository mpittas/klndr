import { DataProvider } from "@klndr/data";
import { useCallback, type PropsWithChildren } from "react";

import { api } from "@/api";
import { DEV_USER, useAuth } from "@/auth";
import { useToast } from "@/toast";

/**
 * The app's data layer (`@klndr/data`) wired to this app: the one API client, the signed-in person, the
 * toast for the messages the hooks produce, and the profile source the profile screen reads.
 *
 * **It must not be mounted while auth is still finding out who is signed in.** `DataProvider` treats
 * `userId: null` as *signed out* — it wipes the saved cache for that person — which must not happen merely
 * because Firebase has not answered yet. That is why `main.tsx` renders the splash, not this, until the
 * first auth answer has arrived.
 *
 * No `persister` yet: the decided web behaviour is to keep the cache in memory only (see DECISIONS.md).
 */
export function AppDataProvider({ children }: PropsWithChildren) {
  const { state, profileSource } = useAuth();
  const toast = useToast();
  const notify = useCallback((message: string) => toast.show(message), [toast]);

  const userId =
    state.status === "signed-in" ? state.user.uid : state.status === "unavailable" ? DEV_USER.uid : null;

  return (
    <DataProvider api={api} userId={userId} notify={notify} profile={profileSource ?? undefined}>
      {children}
    </DataProvider>
  );
}
