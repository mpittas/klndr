import { DataProvider } from "@klndr/data";
import { useCallback, type PropsWithChildren } from "react";

import { api } from "@/api";
import { useAuth } from "@/auth";
import { useToast } from "@/components/ui";

import "./focus";
import "./online";
import { queryPersister } from "./persister";

/**
 * The app's data layer (`@klndr/data`) wired to this app: the API client, the signed-in person, a toast for
 * the messages the hooks produce, and the cache kept in MMKV.
 *
 * It renders nothing until auth has settled. `DataProvider` treats "no user" as *signed out* and wipes the
 * saved cache, which must not happen merely because Firebase hasn't yet said whether a session was restored.
 */
export function AppDataProvider({ children }: PropsWithChildren) {
  const { state } = useAuth();
  const toast = useToast();
  const notify = useCallback((message: string) => toast.show({ message }), [toast]);

  if (state.status === "loading") return null;
  const userId = state.status === "signed-in" ? state.user.uid : null;

  return (
    <DataProvider api={api} userId={userId} notify={notify} persister={queryPersister}>
      {children}
    </DataProvider>
  );
}
