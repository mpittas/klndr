import { createApp } from "@klndr/api";
import { createApiClient, type ScheduledTask, type TaskDraft } from "@klndr/core";
import { MutationObserver, QueryClient, type MutationObserverOptions } from "@tanstack/react-query";
import { afterEach, beforeEach, vi } from "vitest";
import type { MutationDeps } from "../src/mutations/types";

/** A far-away day, so the demo schedule a fresh in-memory account starts with never gets in the way. */
export const DAY = "2031-04-14";

type Matcher = string | RegExp;
const matches = (matcher: Matcher, line: string) => (typeof matcher === "string" ? line.startsWith(matcher) : matcher.test(line));

/**
 * The real API (`@klndr/api`) with an in-memory account, behind `fetch`. A request can be held until the test
 * lets it go, or made to fail, which is how the optimistic state and the rollbacks are looked at.
 */
export function createServer() {
  const app = createApp({ firebaseProjectId: "", allowDevUser: true });
  /** "METHOD /path?query", in the order the client sent them. */
  const sent: string[] = [];
  const holds: Array<{ matcher: Matcher; gate: Promise<void> }> = [];
  const failures: Array<{ matcher: Matcher; status: number; message: string; times: number }> = [];

  const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
    const request = new Request(url, init);
    const { pathname, search } = new URL(request.url);
    const line = `${request.method} ${pathname}${search}`;
    sent.push(line);

    for (const hold of holds.filter((h) => matches(h.matcher, line))) await hold.gate;

    const failure = failures.find((f) => f.times > 0 && matches(f.matcher, line));
    if (failure) {
      failure.times -= 1;
      return Response.json(
        { error: true, statusCode: failure.status, statusMessage: failure.message, message: failure.message },
        { status: failure.status },
      );
    }
    return app.fetch(request);
  };

  const api = createApiClient({ baseUrl: "http://api.test", getToken: async () => null });

  return {
    api,
    sent,
    fetch: fetchImpl,
    /** Requests matching this wait until the returned function is called. */
    hold(matcher: Matcher): () => void {
      let release!: () => void;
      holds.push({ matcher, gate: new Promise<void>((resolve) => (release = resolve)) });
      return release;
    },
    /** The next `times` requests matching this answer with an error. */
    fail(matcher: Matcher, message = "boom", status = 500, times = 1) {
      failures.push({ matcher, status, message, times });
    },
    async seedTask(day: string, extra: Partial<TaskDraft> = {}): Promise<ScheduledTask> {
      return api.createTask({
        day,
        title: "Seed",
        emoji: "🌱",
        color: "sky",
        category: "Work",
        startMinutes: 540,
        durationMinutes: 60,
        ...extra,
      });
    },
  };
}

export type Server = ReturnType<typeof createServer>;

/** A server for each test, installed as the global `fetch` the API client uses. */
export function useServer(): { current: Server } {
  const box = { current: undefined as unknown as Server };
  beforeEach(() => {
    box.current = createServer();
    vi.stubGlobal("fetch", (url: string, init?: RequestInit) => box.current.fetch(url, init));
  });
  afterEach(() => vi.unstubAllGlobals());
  return box;
}

export const newClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });

/** What a test needs to run mutations: a client, the messages shown, and the undo steps recorded. */
export function createDeps(server: Server) {
  const queryClient = newClient();
  const messages: string[] = [];
  const history = { record: vi.fn() };
  const deps: MutationDeps = { api: server.api, queryClient, notify: (message) => messages.push(message) };
  return { deps, queryClient, messages, history };
}

/** Run a mutation the way `useMutation` does, without React. */
export function run<TData, TVars, TContext>(
  queryClient: QueryClient,
  options: MutationObserverOptions<TData, Error, TVars, TContext>,
  vars: TVars,
): Promise<TData> {
  return new MutationObserver(queryClient, options).mutate(vars);
}

export const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
