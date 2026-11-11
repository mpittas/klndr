import type { Context, MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { Env } from "./env";
import { errorBody } from "./errors";

/**
 * Abuse protection for the API: response headers, a cap on request size, and rate limits.
 *
 * The rate limits are counted in memory, per server instance. They stop one client or one account from
 * hammering the API (or running up the OpenAI bill through the emoji and category pickers), but on a
 * platform that runs many instances they are a floor, not a ceiling: volumetric DDoS protection belongs
 * at the edge (Vercel Firewall, or Cloud Armor in front of Cloud Run).
 */

/** How many requests a key may make in one window. */
export type Limit = { limit: number; windowMs: number };

export type RateLimits = {
  /** Every `/api` request, by client IP, checked before the token is verified. */
  perIp: Limit;
  /** Every signed-in request, by user. */
  perUser: Limit;
  /** The AI-backed routes (`/api/emoji`, `/api/suggest-category`), by user. */
  ai: Limit;
};

export const DEFAULT_RATE_LIMITS: RateLimits = {
  perIp: { limit: 600, windowMs: 60_000 },
  perUser: { limit: 300, windowMs: 60_000 },
  ai: { limit: 30, windowMs: 60_000 },
};

/** The largest request body accepted. A day's notes (20,000 characters) is the biggest legitimate one. */
export const MAX_BODY_BYTES = 256 * 1024;

/** Keys kept per limiter before expired ones are swept and, if still too many, the oldest dropped. */
const MAX_KEYS = 50_000;

export type RateLimiter = (key: string, now?: number) => { ok: true } | { ok: false; retryAfterSeconds: number };

/** A fixed-window counter per key, held in memory and bounded in size. */
export function createRateLimiter({ limit, windowMs }: Limit, maxKeys = MAX_KEYS): RateLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>();

  const sweep = (now: number) => {
    for (const [key, entry] of windows) if (entry.resetAt <= now) windows.delete(key);
    // Still full (a flood of distinct keys): forget the oldest, which a Map keeps first.
    for (const key of windows.keys()) {
      if (windows.size <= maxKeys * 0.9) break;
      windows.delete(key);
    }
  };

  return (key, now = Date.now()) => {
    let entry = windows.get(key);
    if (!entry || entry.resetAt <= now) {
      if (!entry && windows.size >= maxKeys) sweep(now);
      entry = { count: 0, resetAt: now + windowMs };
      windows.delete(key);
      windows.set(key, entry);
    }
    entry.count += 1;
    if (entry.count <= limit) return { ok: true };
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
  };
}

/**
 * The caller's IP, as the platform in front reports it. Vercel sets `x-vercel-forwarded-for` and
 * `x-real-ip` itself; elsewhere the first `x-forwarded-for` entry is used, which a client can forge, so
 * there the per-IP limit is only a first line and the per-user limit is the one that holds.
 */
export function clientIp(c: Context): string {
  const header = c.req.header("x-vercel-forwarded-for") || c.req.header("x-real-ip") || c.req.header("x-forwarded-for");
  const first = header?.split(",")[0]?.trim();
  return first ? first.slice(0, 64) : "unknown";
}

function tooMany(c: Context, retryAfterSeconds: number) {
  c.header("Retry-After", String(retryAfterSeconds));
  return c.json(errorBody(429, "Too many requests. Please wait a moment and try again."), 429);
}

/** Limit requests by a key taken from the request; a `null` key is not limited. */
export function rateLimit<E extends Env>(
  limiter: RateLimiter,
  keyOf: (c: Context<E>) => string | null,
): MiddlewareHandler<E> {
  return async (c, next) => {
    const key = keyOf(c);
    if (key !== null) {
      const verdict = limiter(key);
      if (!verdict.ok) return tooMany(c, verdict.retryAfterSeconds);
    }
    await next();
  };
}

/** Refuse bodies over `MAX_BODY_BYTES` with a JSON 413, before they are read into memory. */
export const limitBody = (maxSize = MAX_BODY_BYTES) =>
  bodyLimit({
    maxSize,
    onError: (c) => c.json(errorBody(413, "Request is too large"), 413),
  });

/**
 * Headers on every API response: never cached, never sniffed, never framed, never rendered as a page, and
 * only readable by this site (the API answers JSON to its own origin and to the native apps).
 */
export const apiHeaders: MiddlewareHandler = async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "no-referrer");
  c.header("Cross-Origin-Resource-Policy", "same-origin");
  c.header("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
};
