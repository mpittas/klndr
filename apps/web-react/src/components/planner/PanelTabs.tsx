import type { ReactNode } from "react";

export type PanelTab<T extends string> = {
  id: T;
  label: string;
  /** A small count or mark beside the label. */
  extra?: ReactNode;
};

/**
 * The tab strip at the head of the planner's sidebar, the same on every view: plain labels on a hairline, the
 * one in use in ink with a short rule under it that slides across as the view changes. It is as tall as the
 * toolbar beside it, so the two hairlines run on as one line.
 */
export function PanelTabs<T extends string>({
  tabs,
  active,
  onChange,
  label,
}: {
  tabs: PanelTab<T>[];
  active: T;
  onChange: (tab: T) => void;
  label: string;
}) {
  const index = Math.max(0, tabs.findIndex((tab) => tab.id === active));

  return (
    <div className="flex h-16 shrink-0 border-b border-border short:h-12">
      <div role="group" aria-label={label} className="relative mx-3 flex flex-1">
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(tab.id)}
              className={[
                "flex h-full min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md text-[13px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                selected ? "font-semibold text-foreground" : "font-medium text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              <span className="truncate">{tab.label}</span>
              {tab.extra}
            </button>
          );
        })}

        {/* The rule under the tab in use, on top of the hairline; it slides to the next tab. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-px left-0 flex justify-center transition-transform duration-200 ease-out motion-reduce:transition-none"
          style={{ width: `${100 / tabs.length}%`, transform: `translateX(${index * 100}%)` }}
        >
          <span className="h-0.5 w-[calc(100%-1.5rem)] rounded-full bg-foreground" />
        </span>
      </div>
    </div>
  );
}

/** A tab's count: plain small figures beside the label, not a badge, so the strip stays quiet. */
export function TabCount({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "success" }) {
  return (
    <span
      className={[
        "text-[11px] font-medium tabular-nums",
        tone === "success" ? "text-success" : "text-muted-foreground/70",
      ].join(" ")}
    >
      {children}
    </span>
  );
}

/** A tab's mark: a brand dot (notes written, a filter on). */
export function TabDot({ label }: { label: string }) {
  return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" role="img" aria-label={label} />;
}
