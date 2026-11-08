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
    <button type="button" aria-pressed={selected} onClick={onClick} className="segmented-item px-2">
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
    <div className="px-3 pb-2 pt-3">
      <div role="group" aria-label="Sidebar view" className="segmented h-9 w-full">
        <TabButton selected={active === "activities"} onClick={() => onChange("activities")}>
          <span>Activities</span>
          <span className="count">{activityCount}</span>
        </TabButton>

        <TabButton selected={active === "checklist"} onClick={() => onChange("checklist")}>
          <span>Checklist</span>
          <span className={["count", checklistComplete ? "bg-success/15 text-success" : ""].join(" ")}>
            {checklist.done}/{checklist.total}
          </span>
        </TabButton>

        <TabButton selected={active === "notes"} onClick={() => onChange("notes")}>
          <span>Notes</span>
          {hasNotes ? <span className="h-1.5 w-1.5 rounded-full bg-brand" role="img" aria-label="Has notes" /> : null}
        </TabButton>
      </div>
    </div>
  );
}
