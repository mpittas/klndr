import { QueryClient } from "@tanstack/react-query";
import { CACHE_MAX_AGE_MS } from "./persistence";

/**
 * How long fetched data counts as fresh. Every refetch is a serverless function run, and changes made on
 * other devices arrive by `LiveChanges` rather than by asking again, so this can be generous.
 */
export const STALE_MS = 120_000;

/**
 * The query client every app uses. Data is trusted for two minutes before a screen asks again, and kept in
 * memory for as long as it may be saved on the device, so a persisted cache isn't dropped the moment nothing
 * is looking at it. Mutations are never retried: a write that failed once is reported, not repeated.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: STALE_MS, gcTime: CACHE_MAX_AGE_MS, retry: 1 },
      mutations: { retry: 0 },
    },
  });
}
