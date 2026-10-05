import { ACCEPTED_COLOR_KEYS } from "./colors";

export const MAX_TITLE = 120;
export const MAX_NAME = 80;
export const MAX_CATEGORY = 40;
export const MAX_EMOJI = 8;
export const MAX_NOTES = 500;

const DEFAULT_COLOR = "indigo";
const DEFAULT_EMOJI = "📌";
const DEFAULT_CATEGORY = "General";
const MAX_DURATION = 24 * 60;

/** Document ids are interpolated into database paths, so accept nothing but a plain token. */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function isDocId(value: unknown): value is string {
  return typeof value === "string" && ID_PATTERN.test(value);
}

export function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function cleanNotes(value: unknown): string | null {
  return value ? String(value).slice(0, MAX_NOTES) : null;
}

export function isColorKey(value: unknown): value is string {
  return typeof value === "string" && (ACCEPTED_COLOR_KEYS as string[]).includes(value);
}

export function cleanColor(value: unknown): string {
  return isColorKey(value) ? value : DEFAULT_COLOR;
}

/** True when the value is a finite number or a numeric string. */
export function isNumeric(value: unknown): boolean {
  return value !== null && value !== "" && Number.isFinite(Number(value));
}

export const cleanEmoji = (value: unknown) => cleanText(value, MAX_EMOJI) || DEFAULT_EMOJI;
export const cleanCategory = (value: unknown) => cleanText(value, MAX_CATEGORY) || DEFAULT_CATEGORY;

/** Round to the nearest 15 minutes and clamp to a valid block length. */
export function clampDuration(value: unknown, fallback = 60): number {
  const num = Number(value);
  if (value === undefined || value === null || value === "" || Number.isNaN(num)) {
    return fallback;
  }
  return Math.max(15, Math.min(MAX_DURATION, Math.round(num / 15) * 15));
}

/** A block's preferred column among blocks that share its time (see `ScheduledTask.lane`). */
const MAX_LANE = 50;
export const clampLane = (value: unknown) => Math.max(0, Math.min(MAX_LANE, Math.round(Number(value))));

/** Round to the nearest 15 minutes and keep the block inside the day. */
export function clampStart(value: unknown, fallback = 540): number {
  const num = Number(value);
  const raw = value === undefined || value === null || value === "" || Number.isNaN(num) ? fallback : num;
  return Math.max(0, Math.min(MAX_DURATION - 15, Math.round(raw / 15) * 15));
}
