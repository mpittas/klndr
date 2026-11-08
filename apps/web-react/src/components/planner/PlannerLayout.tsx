import type { ReactNode } from "react";

/**
 * The one frame of the planner, shared by the month, the week and the day so moving between them never moves
 * the furniture:
 *
 *   ┌────────────┬──────────────────────────────────┬────────────┐
 *   │  sidebar   │ toolbar (PlannerToolbar)         │  panel     │
 *   │ (lg up):   ├──────────────────────────────────┤ (xl up,    │
 *   │ calendar,  │ body: the grid, scrolling alone  │  the day's │
 *   │ activities ├──────────────────────────────────┤  own)      │
 *   │            │ footer (the day's tools, small)  │            │
 *   └────────────┴──────────────────────────────────┴────────────┘
 *
 * It fills the space under the app header and the page itself never scrolls: only the body and the side columns
 * do. The sidebar (`PlannerSidebar`) is the same on every view, shown from `lg` and folded away with the toolbar's
 * sidebar button (`useSidebarOpen`); `inert` takes it out of the tab order while it is folded. The panel on the
 * right is for what belongs to the view alone (the day's checklist and notes).
 */
export function PlannerLayout({
  sidebar,
  sidebarLabel,
  sidebarOpen = true,
  panel,
  panelLabel,
  toolbar,
  footer,
  dialogs,
  children,
}: {
  sidebar?: ReactNode;
  sidebarLabel?: string;
  sidebarOpen?: boolean;
  /** The view's own column on the right, from `xl`. */
  panel?: ReactNode;
  panelLabel?: string;
  toolbar: ReactNode;
  footer?: ReactNode;
  /** Dialogs and sheets that belong to the view (they render in a portal, outside the frame). */
  dialogs?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-background">
      {sidebar ? (
        <aside
          id="planner-sidebar"
          aria-label={sidebarLabel}
          inert={!sidebarOpen}
          className={[
            "hidden shrink-0 overflow-hidden bg-card transition-[width] duration-200 ease-out motion-reduce:transition-none lg:flex",
            sidebarOpen ? "w-80 border-r border-border" : "w-0",
          ].join(" ")}
        >
          {/* A fixed width inside, so the content slides with the edge instead of reflowing as it folds. */}
          <div className="flex min-h-0 w-80 shrink-0 flex-col">{sidebar}</div>
        </aside>
      ) : null}

      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        {toolbar}
        {children}
        {footer}
      </section>

      {panel ? (
        <aside aria-label={panelLabel} className="hidden w-80 shrink-0 flex-col border-l border-border bg-card xl:flex">
          {panel}
        </aside>
      ) : null}

      {dialogs}
    </div>
  );
}
