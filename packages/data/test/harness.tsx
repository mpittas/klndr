import type { UserProfile } from "@klndr/core";
import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { DataProvider } from "../src/provider";
import type { ProfileSource } from "../src/hooks/profile";
import type { Server } from "./world";
import { newClient } from "./world";

/** The provider the way an app mounts it, over the in-memory API; `messages` collects what `notify` is told. */
export function harness(
  server: Server,
  options: { userId?: string | null; profile?: ProfileSource; persister?: Parameters<typeof DataProvider>[0]["persister"] } = {},
) {
  const messages: string[] = [];
  const queryClient: QueryClient = newClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <DataProvider
      api={server.api}
      userId={options.userId === undefined ? "user-1" : options.userId}
      notify={(message) => messages.push(message)}
      profile={options.profile}
      persister={options.persister}
      queryClient={queryClient}
    >
      {children}
    </DataProvider>
  );
  return { wrapper, messages, queryClient };
}

export const aProfile = (extra: Partial<UserProfile> = {}): UserProfile => ({
  uid: "user-1",
  email: "a@example.com",
  displayName: "Ada",
  photoURL: null,
  bio: "",
  phone: "",
  location: "",
  timezone: "UTC",
  weekStartsOnMonday: true,
  defaultTaskDuration: 60,
  ...extra,
});
