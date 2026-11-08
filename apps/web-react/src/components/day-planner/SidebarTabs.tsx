import type { ReactNode } from "react";

export type SidebarTab = "activities" | "checklist" | "notes";

const TABS: SidebarTab[] = ["activities", "checklist", "notes"];

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
        "flex h-10 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md text-[13px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        selected ? "font-semibold text-foreground" : "font-medium text-muted-foreground hover:text-foreground",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/** A tab's count: plain small figures beside the label, not a badge, so the bar stays quiet. */
function Count({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "success" }) {
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

/**
 * The desktop sidebar's switch between the activities, the day's checklist and its notes: three plain labels
 * on a hairline, the one in use in ink with a short rule under it that slides across as the view changes.
 * Counts sit beside the labels as small figures rather than badges.
 */
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
    <div className="mb-2 border-b border-border pt-1.5">
      <div role="group" aria-label="Sidebar view" className="relative mx-3 flex">
        <TabButton selected={active === "activities"} onClick={() => onChange("activities")}>
          <span className="truncate">Activities</span>
          <Count>{activityCount}</Count>
        </TabButton>

        <TabButton selected={active === "checklist"} onClick={() => onChange("checklist")}>
          <span className="truncate">Checklist</span>
          <Count tone={checklistComplete ? "success" : "muted"}>
            {checklist.done}/{checklist.total}
          </Count>
        </TabButton>

        <TabButton selected={active === "notes"} onClick={() => onChange("notes")}>
          <span className="truncate">Notes</span>
          {hasNotes ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" role="img" aria-label="Has notes" /> : null}
        </TabButton>

        {/* The rule under the tab in use, on top of the hairline; it slides to the next tab. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-px left-0 flex w-1/3 justify-center transition-transform duration-200 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(${TABS.indexOf(active) * 100}%)` }}
        >
          <span className="h-0.5 w-[calc(100%-1.5rem)] rounded-full bg-foreground" />
        </span>
      </div>
    </div>
  );
}
