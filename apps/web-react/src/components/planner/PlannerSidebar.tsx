import type { ActivityTemplate } from "@dayro/core";

import { ActivityPalette } from "@/components/day-planner/ActivityPalette";
import { MiniCalendar } from "@/components/planner/MiniCalendar";
import type { PlannerView } from "@/components/planner/PlannerToolbar";

const HINT: Record<PlannerView, string> = {
  day: "Drag onto the timeline",
  week: "Drag onto the week",
  month: "Drag onto a day",
};

/**
 * The planner's sidebar, the same on the month, the week and the day, because it holds what the three share:
 *
 * - **where you are**: the mini calendar (`MiniCalendar`), to see the period on screen and jump to another;
 * - **what you plan with**: your activities (`ActivityPalette`), the reusable blocks of the library, grouped by
 *   category. Drag one onto the calendar (the day's timeline, a slot of the week, a day of the month) to place
 *   it, or click it to plan it from the editor (on the day, it goes in at once, at the current time).
 *
 * What belongs to a single day (its checklist and notes) is the day's own panel, not this; which categories are
 * shown is the toolbar's.
 */
export function PlannerSidebar({
  view,
  anchor,
  end,
  today,
  weekStartsOnMonday,
  onPickDate,
  templates,
  onPickActivity,
  onDragActivity,
  onDropActivityEnd,
  onMoveActivity,
  onManage,
}: {
  view: PlannerView;
  anchor: string;
  end?: string;
  today: string;
  weekStartsOnMonday: boolean;
  onPickDate: (date: string) => void;
  templates: ActivityTemplate[];
  onPickActivity: (template: ActivityTemplate) => void;
  onDragActivity: (template: ActivityTemplate) => void;
  onDropActivityEnd: () => void;
  onMoveActivity: (template: ActivityTemplate, category: string) => void;
  onManage: () => void;
}) {
  return (
    <>
      <MiniCalendar
        view={view}
        anchor={anchor}
        end={end}
        today={today}
        weekStartsOnMonday={weekStartsOnMonday}
        onPick={onPickDate}
      />

      <div className="flex min-h-0 flex-1 flex-col border-t border-border">
        <div className="flex items-baseline justify-between gap-2 px-4.5 pb-2.5 pt-4">
          <h2 className="card-title">
            Activities <span className="card-meta ml-1 tabular-nums">{templates.length}</span>
          </h2>
          <span className="truncate text-[11px] text-muted-foreground touch:hidden">{HINT[view]}</span>
        </div>
        <ActivityPalette
          templates={templates}
          onPick={onPickActivity}
          onDragStart={onDragActivity}
          onDragEnd={onDropActivityEnd}
          onMove={onMoveActivity}
          onManage={onManage}
        />
      </div>
    </>
  );
}
