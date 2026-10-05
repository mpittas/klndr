import type { ReactNode } from "react";

export type SidebarTab = "activities" | "checklist" | "notes";

function TabButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={[
        "inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-all",
        selected ? "bg-background font-semibold text-foreground shadow-xs" : "hover:text-foreground",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/** The desktop sidebar's switch between the activities, the day's checklist and its notes. */
export function SidebarTabs({
  active,
  onChange,
  activityCount,
  checklist,
  hasNotes,
}: {
  active: SidebarTab;
  onChange: (tab: SidebarTab) => void;
  activityCount: number;
  checklist: { done: number; total: number };
  hasNotes: boolean;
}) {
  const checklistComplete = checklist.total > 0 && checklist.done === checklist.total;

  return (
    <div className="flex items-center justify-between gap-2 border-b border-border bg-card px-3 pb-2.5 pt-3">
      <div
        role="group"
        aria-label="Sidebar view"
        className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground"
      >
        <TabButton selected={active === "activities"} onClick={() => onChange("activities")}>
          <span>Activities</span>
          <span className="rounded-full bg-muted-foreground/15 px-1.5 py-0.2 font-mono text-[10px]">{activityCount}</span>
        </TabButton>

        <TabButton selected={active === "checklist"} onClick={() => onChange("checklist")}>
          <span>Checklist</span>
          <span
            className={[
              "rounded-full px-1.5 py-0.2 font-mono text-[10px] font-bold",
              checklistComplete
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                : "bg-muted-foreground/15 text-foreground",
            ].join(" ")}
          >
            {checklist.done}/{checklist.total}
          </span>
        </TabButton>

        <TabButton selected={active === "notes"} onClick={() => onChange("notes")}>
          <span>Notes</span>
          {hasNotes ? <span className="h-1.5 w-1.5 rounded-full bg-primary" role="img" aria-label="Has notes" /> : null}
        </TabButton>
      </div>
    </div>
  );
}
