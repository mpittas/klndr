import { QueryClient } from "@tanstack/react-query";
import { CACHE_MAX_AGE_MS } from "./persistence";

/**
 * The query client every app uses. Data is trusted for half a minute before a screen asks again, and kept in
 * memory for as long as it may be saved on the device, so a persisted cache isn't dropped the moment nothing
 * is looking at it. Mutations are never retried: a write that failed once is reported, not repeated.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, gcTime: CACHE_MAX_AGE_MS, retry: 1 },
      mutations: { retry: 0 },
    },
  });
}
