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
      className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 py-1 touch:hidden"
    >
      {SHORTCUTS.map(({ keys, label }) => (
        <span key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="flex gap-0.5">
            {keys.map((key) => (
              <kbd key={key} className="kbd">
                {key}
              </kbd>
            ))}
          </span>
          {label}
        </span>
      ))}
    </section>
  );
}
