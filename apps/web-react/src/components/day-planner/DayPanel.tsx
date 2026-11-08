import type { ComponentProps } from "react";

import { DailyChecklist } from "@/components/DailyChecklist";
import { DayNotes } from "@/components/DayNotes";
import { PanelTabs, TabCount, TabDot } from "@/components/planner/PanelTabs";

export type DayPanelTab = "checklist" | "notes";

/**
 * What belongs to the day on screen and to no other view: its checklist (the routines to tick off) and its
 * notes. It is the day's column on the right from `xl` (Motion and Todoist keep the day's own list there too);
 * below that the same two open as sheets from the day's bottom bar.
 */
export function DayPanel({
  day,
  active,
  onChange,
  checklist,
  notes,
}: {
  day: string;
  active: DayPanelTab;
  onChange: (tab: DayPanelTab) => void;
  checklist: ComponentProps<typeof DailyChecklist>["checklist"];
  notes: ComponentProps<typeof DayNotes>["notes"];
}) {
  const { done, total } = checklist.stats;
  const hasNotes = notes.text.trim().length > 0;

  return (
    <>
      <PanelTabs
        label="Day panel"
        active={active}
        onChange={onChange}
        tabs={[
          {
            id: "checklist",
            label: "Checklist",
            extra: (
              <TabCount tone={total > 0 && done === total ? "success" : "muted"}>
                {done}/{total}
              </TabCount>
            ),
          },
          { id: "notes", label: "Notes", extra: hasNotes ? <TabDot label="Has notes" /> : null },
        ]}
      />
      <div className="flex min-h-0 flex-1 flex-col pt-2">
        {active === "notes" ? <DayNotes key={day} notes={notes} /> : <DailyChecklist key={day} checklist={checklist} />}
      </div>
    </>
  );
}
