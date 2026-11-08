import { Check } from "lucide-react";

/** The count and the bar above the day's checklist. */
export function ChecklistHeader({
  completedCount,
  totalCount,
  percentage,
  allDone,
}: {
  completedCount: number;
  totalCount: number;
  percentage: number;
  allDone: boolean;
}) {
  return (
    <div className="shrink-0 px-4 pb-2 pt-4">
      <p className="flex items-center gap-1.5 text-sm font-medium tabular-nums text-foreground">
        {allDone ? (
          <>
            <Check className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
            All done
          </>
        ) : (
          <>
            {completedCount}
            <span className="font-normal text-muted-foreground">of {totalCount} done</span>
          </>
        )}
      </p>
      <div
        className="progress mt-2.5 w-full"
        role="progressbar"
        aria-label="Checklist progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
      >
        <span className="progress-bar" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
