export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Format a Date as a local `YYYY-MM-DD` string. */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parse a `YYYY-MM-DD` or `YYYY-MM` string into a local Date at midnight. */
export function parseISODate(iso: string): Date {
  const parts = iso.split("-").map((part) => Number.parseInt(part, 10));
  const y = parts[0];
  const m = parts[1];
  const d = parts[2] !== undefined && !Number.isNaN(parts[2]) ? parts[2] : 1;
  if (Number.isNaN(y) || Number.isNaN(m)) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  return new Date(y, m - 1, d);
}

export function isValidISODate(iso: unknown): iso is string {
  return typeof iso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(iso);
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function getYear(iso: string): number {
  return parseISODate(iso).getFullYear();
}

export function getMonthIndex(iso: string): number {
  return parseISODate(iso).getMonth();
}

export function addDaysISO(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function addMonths(iso: string, months: number): string {
  const date = parseISODate(iso);
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  return toISODate(date);
}

export function setYearMonth(iso: string, year: number, monthIndex: number): string {
  const date = parseISODate(iso);
  const day = date.getDate();
  const maxDay = new Date(year, monthIndex + 1, 0).getDate();
  const safeDay = Math.min(day, maxDay);
  return toISODate(new Date(year, monthIndex, safeDay));
}

/** 6x7 grid of ISO dates covering the month that `iso` belongs to. */
export function monthMatrix(iso: string): string[] {
  const anchor = parseISODate(iso);
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const cells: string[] = [];
  for (let i = 0; i < 42; i += 1) {
    const cell = new Date(start);
    cell.setDate(start.getDate() + i);
    cells.push(toISODate(cell));
  }
  return cells;
}

export function isSameMonth(iso: string, reference: string): boolean {
  return iso.slice(0, 7) === reference.slice(0, 7);
}

export function monthRange(iso: string): { from: string; to: string } {
  const cells = monthMatrix(iso);
  return { from: cells[0], to: cells[cells.length - 1] };
}

export function longDate(iso: string): string {
  const date = parseISODate(iso);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function mediumDate(iso: string): string {
  const date = parseISODate(iso);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function monthTitle(iso: string): string {
  const date = parseISODate(iso);
  return `${MONTH_LABELS[date.getMonth()]} ${date.getFullYear()}`;
}

export function snapMinutes(minutes: number, step = 30): number {
  "worklet"; // also run on the phone's UI thread while a block is dragged (see timeline.ts)
  return Math.max(0, Math.min(24 * 60, Math.round(minutes / step) * step));
}

/** Start of the step that contains `minutes` (what a click on a time slot should mean). */
export function floorMinutes(minutes: number, step = 30): number {
  "worklet";
  return Math.max(0, Math.min(24 * 60 - step, Math.floor(minutes / step) * step));
}

/** 495 -> "8:15 AM" */
export function formatTime(minutes: number): string {
  const total = ((minutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${`${m}`.padStart(2, "0")} ${suffix}`;
}

/** 540, 660 -> "9:00 – 11:00 AM"; AM/PM is written once when both ends share it. */
export function formatTimeRange(start: number, end: number): string {
  const from = formatTime(start);
  const to = formatTime(end);
  return from.slice(-2) === to.slice(-2) ? `${from.slice(0, -3)} – ${to}` : `${from} – ${to}`;
}

/** Gutter label: hours only get a label, half hours stay blank. */
export function gutterLabel(minutes: number): string | null {
  if (minutes % 60 !== 0) return null;
  const h24 = minutes / 60;
  if (h24 === 0) return "12 AM";
  if (h24 === 12) return "12 PM";
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12} ${suffix}`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export const DURATION_CHOICES = [15, 30, 45, 60, 90, 120, 180, 240];

export function timeInputValue(minutes: number): string {
  const total = Math.max(0, Math.min(24 * 60, minutes));
  const h = `${Math.floor(total / 60)}`.padStart(2, "0");
  const m = `${total % 60}`.padStart(2, "0");
  return `${h}:${m}`;
}

export function fromTimeInput(value: string): number {
  const [h, m] = value.split(":").map((part) => Number.parseInt(part, 10));
  if (Number.isNaN(h)) return 540;
  return Math.max(0, Math.min(24 * 60, h * 60 + (Number.isNaN(m) ? 0 : m)));
}

export function nowMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export const HOUR_OPTIONS = Array.from({ length: 48 }, (_, i) => i * 30);
