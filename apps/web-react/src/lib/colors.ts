import { COLOR_LABELS, canonicalColor, type ColorKey } from "@klndr/core";

/** The Tailwind classes behind every role a color plays; the keys and their labels live in @klndr/core. */
export type PaletteEntry = {
  label: string;
  swatch: string;
  block: string;
  blockDone: string;
  chip: string;
  dot: string;
  accent: string;
  selected: string;
  ghost: string;
  icon: string;
  /** Secondary text on a block (its time), tinted toward the block's hue. */
  meta: string;
  /** The completion ring on a block that isn't done yet. */
  check: string;
};

export const PALETTE: Record<ColorKey, PaletteEntry> = {
  indigo: {
    label: COLOR_LABELS.indigo,
    swatch: "bg-indigo-500",
    block: "bg-indigo-50 border-indigo-200/80 text-indigo-950 hover:bg-indigo-100 hover:border-indigo-300/80 dark:bg-[color-mix(in_oklab,var(--color-indigo-500)_16%,var(--background))] dark:border-indigo-400/25 dark:text-indigo-50 dark:hover:bg-[color-mix(in_oklab,var(--color-indigo-500)_24%,var(--background))] dark:hover:border-indigo-400/40",
    blockDone: "bg-[color-mix(in_oklab,var(--color-indigo-50)_45%,var(--background))] border-indigo-200/50 text-indigo-950/45 hover:border-indigo-200 dark:bg-[color-mix(in_oklab,var(--color-indigo-500)_6%,var(--background))] dark:border-indigo-400/15 dark:text-indigo-50/40 dark:hover:border-indigo-400/30",
    chip: "bg-indigo-50 border-indigo-200 text-slate-900 dark:bg-indigo-500/15 dark:border-indigo-400/30 dark:text-slate-50",
    dot: "bg-indigo-500",
    accent: "bg-indigo-500",
    selected: "bg-indigo-600 border-indigo-600 text-white",
    ghost: "bg-indigo-50/90 border-indigo-300 dark:bg-indigo-500/15 dark:border-indigo-400/50",
    icon: "bg-indigo-100 text-indigo-950 dark:bg-indigo-500/25 dark:text-indigo-100",
    meta: "text-indigo-900/60 dark:text-indigo-100/55",
    check: "border-indigo-400/80 hover:border-indigo-600 hover:text-indigo-600 dark:border-indigo-300/45 dark:hover:border-indigo-200 dark:hover:text-indigo-200",
  },
  emerald: {
    label: COLOR_LABELS.emerald,
    swatch: "bg-emerald-500",
    block: "bg-emerald-50 border-emerald-200/80 text-emerald-950 hover:bg-emerald-100 hover:border-emerald-300/80 dark:bg-[color-mix(in_oklab,var(--color-emerald-500)_16%,var(--background))] dark:border-emerald-400/25 dark:text-emerald-50 dark:hover:bg-[color-mix(in_oklab,var(--color-emerald-500)_24%,var(--background))] dark:hover:border-emerald-400/40",
    blockDone: "bg-[color-mix(in_oklab,var(--color-emerald-50)_45%,var(--background))] border-emerald-200/50 text-emerald-950/45 hover:border-emerald-200 dark:bg-[color-mix(in_oklab,var(--color-emerald-500)_6%,var(--background))] dark:border-emerald-400/15 dark:text-emerald-50/40 dark:hover:border-emerald-400/30",
    chip: "bg-emerald-50 border-emerald-200 text-slate-900 dark:bg-emerald-500/15 dark:border-emerald-400/30 dark:text-slate-50",
    dot: "bg-emerald-500",
    accent: "bg-emerald-500",
    selected: "bg-emerald-600 border-emerald-600 text-white",
    ghost: "bg-emerald-50/90 border-emerald-300 dark:bg-emerald-500/15 dark:border-emerald-400/50",
    icon: "bg-emerald-100 text-emerald-950 dark:bg-emerald-500/25 dark:text-emerald-100",
    meta: "text-emerald-900/60 dark:text-emerald-100/55",
    check: "border-emerald-400/80 hover:border-emerald-600 hover:text-emerald-600 dark:border-emerald-300/45 dark:hover:border-emerald-200 dark:hover:text-emerald-200",
  },
  amber: {
    label: COLOR_LABELS.amber,
    swatch: "bg-amber-500",
    block: "bg-amber-50 border-amber-200/80 text-amber-950 hover:bg-amber-100 hover:border-amber-300/80 dark:bg-[color-mix(in_oklab,var(--color-amber-500)_16%,var(--background))] dark:border-amber-400/25 dark:text-amber-50 dark:hover:bg-[color-mix(in_oklab,var(--color-amber-500)_24%,var(--background))] dark:hover:border-amber-400/40",
    blockDone: "bg-[color-mix(in_oklab,var(--color-amber-50)_45%,var(--background))] border-amber-200/50 text-amber-950/45 hover:border-amber-200 dark:bg-[color-mix(in_oklab,var(--color-amber-500)_6%,var(--background))] dark:border-amber-400/15 dark:text-amber-50/40 dark:hover:border-amber-400/30",
    chip: "bg-amber-50 border-amber-200 text-slate-900 dark:bg-amber-500/15 dark:border-amber-400/30 dark:text-slate-50",
    dot: "bg-amber-500",
    accent: "bg-amber-500",
    selected: "bg-amber-600 border-amber-600 text-white",
    ghost: "bg-amber-50/90 border-amber-300 dark:bg-amber-500/15 dark:border-amber-400/50",
    icon: "bg-amber-100 text-amber-950 dark:bg-amber-500/25 dark:text-amber-100",
    meta: "text-amber-900/60 dark:text-amber-100/55",
    check: "border-amber-400/80 hover:border-amber-600 hover:text-amber-600 dark:border-amber-300/45 dark:hover:border-amber-200 dark:hover:text-amber-200",
  },
  rose: {
    label: COLOR_LABELS.rose,
    swatch: "bg-rose-500",
    block: "bg-rose-50 border-rose-200/80 text-rose-950 hover:bg-rose-100 hover:border-rose-300/80 dark:bg-[color-mix(in_oklab,var(--color-rose-500)_16%,var(--background))] dark:border-rose-400/25 dark:text-rose-50 dark:hover:bg-[color-mix(in_oklab,var(--color-rose-500)_24%,var(--background))] dark:hover:border-rose-400/40",
    blockDone: "bg-[color-mix(in_oklab,var(--color-rose-50)_45%,var(--background))] border-rose-200/50 text-rose-950/45 hover:border-rose-200 dark:bg-[color-mix(in_oklab,var(--color-rose-500)_6%,var(--background))] dark:border-rose-400/15 dark:text-rose-50/40 dark:hover:border-rose-400/30",
    chip: "bg-rose-50 border-rose-200 text-slate-900 dark:bg-rose-500/15 dark:border-rose-400/30 dark:text-slate-50",
    dot: "bg-rose-500",
    accent: "bg-rose-500",
    selected: "bg-rose-600 border-rose-600 text-white",
    ghost: "bg-rose-50/90 border-rose-300 dark:bg-rose-500/15 dark:border-rose-400/50",
    icon: "bg-rose-100 text-rose-950 dark:bg-rose-500/25 dark:text-rose-100",
    meta: "text-rose-900/60 dark:text-rose-100/55",
    check: "border-rose-400/80 hover:border-rose-600 hover:text-rose-600 dark:border-rose-300/45 dark:hover:border-rose-200 dark:hover:text-rose-200",
  },
  sky: {
    label: COLOR_LABELS.sky,
    swatch: "bg-sky-500",
    block: "bg-sky-50 border-sky-200/80 text-sky-950 hover:bg-sky-100 hover:border-sky-300/80 dark:bg-[color-mix(in_oklab,var(--color-sky-500)_16%,var(--background))] dark:border-sky-400/25 dark:text-sky-50 dark:hover:bg-[color-mix(in_oklab,var(--color-sky-500)_24%,var(--background))] dark:hover:border-sky-400/40",
    blockDone: "bg-[color-mix(in_oklab,var(--color-sky-50)_45%,var(--background))] border-sky-200/50 text-sky-950/45 hover:border-sky-200 dark:bg-[color-mix(in_oklab,var(--color-sky-500)_6%,var(--background))] dark:border-sky-400/15 dark:text-sky-50/40 dark:hover:border-sky-400/30",
    chip: "bg-sky-50 border-sky-200 text-slate-900 dark:bg-sky-500/15 dark:border-sky-400/30 dark:text-slate-50",
    dot: "bg-sky-500",
    accent: "bg-sky-500",
    selected: "bg-sky-600 border-sky-600 text-white",
    ghost: "bg-sky-50/90 border-sky-300 dark:bg-sky-500/15 dark:border-sky-400/50",
    icon: "bg-sky-100 text-sky-950 dark:bg-sky-500/25 dark:text-sky-100",
    meta: "text-sky-900/60 dark:text-sky-100/55",
    check: "border-sky-400/80 hover:border-sky-600 hover:text-sky-600 dark:border-sky-300/45 dark:hover:border-sky-200 dark:hover:text-sky-200",
  },
  violet: {
    label: COLOR_LABELS.violet,
    swatch: "bg-violet-500",
    block: "bg-violet-50 border-violet-200/80 text-violet-950 hover:bg-violet-100 hover:border-violet-300/80 dark:bg-[color-mix(in_oklab,var(--color-violet-500)_16%,var(--background))] dark:border-violet-400/25 dark:text-violet-50 dark:hover:bg-[color-mix(in_oklab,var(--color-violet-500)_24%,var(--background))] dark:hover:border-violet-400/40",
    blockDone: "bg-[color-mix(in_oklab,var(--color-violet-50)_45%,var(--background))] border-violet-200/50 text-violet-950/45 hover:border-violet-200 dark:bg-[color-mix(in_oklab,var(--color-violet-500)_6%,var(--background))] dark:border-violet-400/15 dark:text-violet-50/40 dark:hover:border-violet-400/30",
    chip: "bg-violet-50 border-violet-200 text-slate-900 dark:bg-violet-500/15 dark:border-violet-400/30 dark:text-slate-50",
    dot: "bg-violet-500",
    accent: "bg-violet-500",
    selected: "bg-violet-600 border-violet-600 text-white",
    ghost: "bg-violet-50/90 border-violet-300 dark:bg-violet-500/15 dark:border-violet-400/50",
    icon: "bg-violet-100 text-violet-950 dark:bg-violet-500/25 dark:text-violet-100",
    meta: "text-violet-900/60 dark:text-violet-100/55",
    check: "border-violet-400/80 hover:border-violet-600 hover:text-violet-600 dark:border-violet-300/45 dark:hover:border-violet-200 dark:hover:text-violet-200",
  },
  teal: {
    label: COLOR_LABELS.teal,
    swatch: "bg-teal-500",
    block: "bg-teal-50 border-teal-200/80 text-teal-950 hover:bg-teal-100 hover:border-teal-300/80 dark:bg-[color-mix(in_oklab,var(--color-teal-500)_16%,var(--background))] dark:border-teal-400/25 dark:text-teal-50 dark:hover:bg-[color-mix(in_oklab,var(--color-teal-500)_24%,var(--background))] dark:hover:border-teal-400/40",
    blockDone: "bg-[color-mix(in_oklab,var(--color-teal-50)_45%,var(--background))] border-teal-200/50 text-teal-950/45 hover:border-teal-200 dark:bg-[color-mix(in_oklab,var(--color-teal-500)_6%,var(--background))] dark:border-teal-400/15 dark:text-teal-50/40 dark:hover:border-teal-400/30",
    chip: "bg-teal-50 border-teal-200 text-slate-900 dark:bg-teal-500/15 dark:border-teal-400/30 dark:text-slate-50",
    dot: "bg-teal-500",
    accent: "bg-teal-500",
    selected: "bg-teal-600 border-teal-600 text-white",
    ghost: "bg-teal-50/90 border-teal-300 dark:bg-teal-500/15 dark:border-teal-400/50",
    icon: "bg-teal-100 text-teal-950 dark:bg-teal-500/25 dark:text-teal-100",
    meta: "text-teal-900/60 dark:text-teal-100/55",
    check: "border-teal-400/80 hover:border-teal-600 hover:text-teal-600 dark:border-teal-300/45 dark:hover:border-teal-200 dark:hover:text-teal-200",
  },
  orange: {
    label: COLOR_LABELS.orange,
    swatch: "bg-orange-500",
    block: "bg-orange-50 border-orange-200/80 text-orange-950 hover:bg-orange-100 hover:border-orange-300/80 dark:bg-[color-mix(in_oklab,var(--color-orange-500)_16%,var(--background))] dark:border-orange-400/25 dark:text-orange-50 dark:hover:bg-[color-mix(in_oklab,var(--color-orange-500)_24%,var(--background))] dark:hover:border-orange-400/40",
    blockDone: "bg-[color-mix(in_oklab,var(--color-orange-50)_45%,var(--background))] border-orange-200/50 text-orange-950/45 hover:border-orange-200 dark:bg-[color-mix(in_oklab,var(--color-orange-500)_6%,var(--background))] dark:border-orange-400/15 dark:text-orange-50/40 dark:hover:border-orange-400/30",
    chip: "bg-orange-50 border-orange-200 text-slate-900 dark:bg-orange-500/15 dark:border-orange-400/30 dark:text-slate-50",
    dot: "bg-orange-500",
    accent: "bg-orange-500",
    selected: "bg-orange-600 border-orange-600 text-white",
    ghost: "bg-orange-50/90 border-orange-300 dark:bg-orange-500/15 dark:border-orange-400/50",
    icon: "bg-orange-100 text-orange-950 dark:bg-orange-500/25 dark:text-orange-100",
    meta: "text-orange-900/60 dark:text-orange-100/55",
    check: "border-orange-400/80 hover:border-orange-600 hover:text-orange-600 dark:border-orange-300/45 dark:hover:border-orange-200 dark:hover:text-orange-200",
  },
  pink: {
    label: COLOR_LABELS.pink,
    swatch: "bg-pink-500",
    block: "bg-pink-50 border-pink-200/80 text-pink-950 hover:bg-pink-100 hover:border-pink-300/80 dark:bg-[color-mix(in_oklab,var(--color-pink-500)_16%,var(--background))] dark:border-pink-400/25 dark:text-pink-50 dark:hover:bg-[color-mix(in_oklab,var(--color-pink-500)_24%,var(--background))] dark:hover:border-pink-400/40",
    blockDone: "bg-[color-mix(in_oklab,var(--color-pink-50)_45%,var(--background))] border-pink-200/50 text-pink-950/45 hover:border-pink-200 dark:bg-[color-mix(in_oklab,var(--color-pink-500)_6%,var(--background))] dark:border-pink-400/15 dark:text-pink-50/40 dark:hover:border-pink-400/30",
    chip: "bg-pink-50 border-pink-200 text-slate-900 dark:bg-pink-500/15 dark:border-pink-400/30 dark:text-slate-50",
    dot: "bg-pink-500",
    accent: "bg-pink-500",
    selected: "bg-pink-600 border-pink-600 text-white",
    ghost: "bg-pink-50/90 border-pink-300 dark:bg-pink-500/15 dark:border-pink-400/50",
    icon: "bg-pink-100 text-pink-950 dark:bg-pink-500/25 dark:text-pink-100",
    meta: "text-pink-900/60 dark:text-pink-100/55",
    check: "border-pink-400/80 hover:border-pink-600 hover:text-pink-600 dark:border-pink-300/45 dark:hover:border-pink-200 dark:hover:text-pink-200",
  },
  lime: {
    label: COLOR_LABELS.lime,
    swatch: "bg-lime-500",
    block: "bg-lime-50 border-lime-200/80 text-lime-950 hover:bg-lime-100 hover:border-lime-300/80 dark:bg-[color-mix(in_oklab,var(--color-lime-500)_16%,var(--background))] dark:border-lime-400/25 dark:text-lime-50 dark:hover:bg-[color-mix(in_oklab,var(--color-lime-500)_24%,var(--background))] dark:hover:border-lime-400/40",
    blockDone: "bg-[color-mix(in_oklab,var(--color-lime-50)_45%,var(--background))] border-lime-200/50 text-lime-950/45 hover:border-lime-200 dark:bg-[color-mix(in_oklab,var(--color-lime-500)_6%,var(--background))] dark:border-lime-400/15 dark:text-lime-50/40 dark:hover:border-lime-400/30",
    chip: "bg-lime-50 border-lime-200 text-slate-900 dark:bg-lime-500/15 dark:border-lime-400/30 dark:text-slate-50",
    dot: "bg-lime-500",
    accent: "bg-lime-500",
    selected: "bg-lime-600 border-lime-600 text-white",
    ghost: "bg-lime-50/90 border-lime-300 dark:bg-lime-500/15 dark:border-lime-400/50",
    icon: "bg-lime-100 text-lime-950 dark:bg-lime-500/25 dark:text-lime-100",
    meta: "text-lime-900/60 dark:text-lime-100/55",
    check: "border-lime-400/80 hover:border-lime-600 hover:text-lime-600 dark:border-lime-300/45 dark:hover:border-lime-200 dark:hover:text-lime-200",
  },
  cyan: {
    label: COLOR_LABELS.cyan,
    swatch: "bg-cyan-500",
    block: "bg-cyan-50 border-cyan-200/80 text-cyan-950 hover:bg-cyan-100 hover:border-cyan-300/80 dark:bg-[color-mix(in_oklab,var(--color-cyan-500)_16%,var(--background))] dark:border-cyan-400/25 dark:text-cyan-50 dark:hover:bg-[color-mix(in_oklab,var(--color-cyan-500)_24%,var(--background))] dark:hover:border-cyan-400/40",
    blockDone: "bg-[color-mix(in_oklab,var(--color-cyan-50)_45%,var(--background))] border-cyan-200/50 text-cyan-950/45 hover:border-cyan-200 dark:bg-[color-mix(in_oklab,var(--color-cyan-500)_6%,var(--background))] dark:border-cyan-400/15 dark:text-cyan-50/40 dark:hover:border-cyan-400/30",
    chip: "bg-cyan-50 border-cyan-200 text-slate-900 dark:bg-cyan-500/15 dark:border-cyan-400/30 dark:text-slate-50",
    dot: "bg-cyan-500",
    accent: "bg-cyan-500",
    selected: "bg-cyan-600 border-cyan-600 text-white",
    ghost: "bg-cyan-50/90 border-cyan-300 dark:bg-cyan-500/15 dark:border-cyan-400/50",
    icon: "bg-cyan-100 text-cyan-950 dark:bg-cyan-500/25 dark:text-cyan-100",
    meta: "text-cyan-900/60 dark:text-cyan-100/55",
    check: "border-cyan-400/80 hover:border-cyan-600 hover:text-cyan-600 dark:border-cyan-300/45 dark:hover:border-cyan-200 dark:hover:text-cyan-200",
  },
  slate: {
    label: COLOR_LABELS.slate,
    swatch: "bg-slate-500",
    block: "bg-slate-50 border-slate-200/80 text-slate-950 hover:bg-slate-100 hover:border-slate-300/80 dark:bg-[color-mix(in_oklab,var(--color-slate-500)_16%,var(--background))] dark:border-slate-400/25 dark:text-slate-50 dark:hover:bg-[color-mix(in_oklab,var(--color-slate-500)_24%,var(--background))] dark:hover:border-slate-400/40",
    blockDone: "bg-[color-mix(in_oklab,var(--color-slate-50)_45%,var(--background))] border-slate-200/50 text-slate-950/45 hover:border-slate-200 dark:bg-[color-mix(in_oklab,var(--color-slate-500)_6%,var(--background))] dark:border-slate-400/15 dark:text-slate-50/40 dark:hover:border-slate-400/30",
    chip: "bg-slate-50 border-slate-200 text-slate-900 dark:bg-slate-500/15 dark:border-slate-400/30 dark:text-slate-50",
    dot: "bg-slate-500",
    accent: "bg-slate-500",
    selected: "bg-slate-800 border-slate-800 text-white dark:bg-slate-600 dark:border-slate-600",
    ghost: "bg-slate-50/90 border-slate-300 dark:bg-slate-500/15 dark:border-slate-400/50",
    icon: "bg-slate-200 text-slate-900 dark:bg-slate-500/25 dark:text-slate-100",
    meta: "text-slate-900/60 dark:text-slate-100/55",
    check: "border-slate-400/80 hover:border-slate-600 hover:text-slate-600 dark:border-slate-300/45 dark:hover:border-slate-200 dark:hover:text-slate-200",
  },
};

export function paletteOf(color: string): PaletteEntry {
  return PALETTE[canonicalColor(color)];
}
