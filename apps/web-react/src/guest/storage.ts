import type { MemorySnapshot } from "@klndr/api";

/**
 * Guest mode keeps everything in this browser's `localStorage`: the planner, the profile, and whether this
 * browser is in guest mode. Nothing here talks to a server, and nothing else in the app reads these keys.
 */

/** The uid a guest has everywhere the app keys data by person (the profile, the query cache). */
export const GUEST_UID = "guest";

const KEYS = {
  session: "klndr-guest-session",
  data: "klndr-guest-data",
  profile: "klndr-guest-profile",
} as const;

const SAVE_FAILED = "Couldn't save to this browser's local storage. Free up some space and try again.";

/** Whether this browser was last left in guest mode. A broken store just means it is not remembered. */
export function isGuestSession(): boolean {
  try {
    return localStorage.getItem(KEYS.session) === "1";
  } catch {
    return false;
  }
}

export function setGuestSession(active: boolean): void {
  try {
    if (active) localStorage.setItem(KEYS.session, "1");
    else localStorage.removeItem(KEYS.session);
  } catch {
    /* Without storage the guest session simply does not survive a reload. */
  }
}

export function loadGuestData(): MemorySnapshot | null {
  return readJson<MemorySnapshot>(KEYS.data);
}

export function saveGuestData(snapshot: MemorySnapshot): void {
  writeJson(KEYS.data, snapshot);
}

export function loadGuestProfile(): Record<string, unknown> | null {
  return readJson<Record<string, unknown>>(KEYS.profile);
}

export function saveGuestProfile(profile: Record<string, unknown>): void {
  writeJson(KEYS.profile, profile);
}

/** Forget everything a guest has made here. */
export function clearGuestData(): void {
  try {
    localStorage.removeItem(KEYS.data);
    localStorage.removeItem(KEYS.profile);
    localStorage.removeItem(KEYS.session);
  } catch {
    /* Nothing to clear if storage is unavailable. */
  }
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    // Unreadable data is treated as none, so the guest starts again rather than getting stuck.
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A change that cannot be saved must not look saved, so this one is reported.
    throw new Error(SAVE_FAILED);
  }
}
