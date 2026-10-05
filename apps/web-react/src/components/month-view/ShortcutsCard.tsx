const SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: ["←", "→"], label: "Month" },
  { keys: ["T"], label: "Today" },
  { keys: ["N"], label: "New" },
  { keys: ["G"], label: "Go to" },
];

/** The keys the calendar answers to (see `MonthView`), as one strip; hidden on touch screens. */
export function ShortcutsCard() {
  return (
    <section
      aria-label="Keyboard shortcuts"
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-border bg-card px-3 py-2 shadow-xs touch:hidden"
    >
      {SHORTCUTS.map(({ keys, label }) => (
        <span key={label} className="flex items-center gap-1 text-[11px] text-muted-foreground">
          {keys.map((key) => (
            <kbd
              key={key}
              className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted/60 px-1 font-mono text-[11px] font-semibold text-foreground"
            >
              {key}
            </kbd>
          ))}
          {label}
        </span>
      ))}
    </section>
  );
}
