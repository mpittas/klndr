import type { DayChecklistItem } from "@dayro/core";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const DRAG_THRESHOLD = 4;

const ARROW =
  "btn btn-secondary btn-icon h-7 rounded-full text-muted-foreground hover:text-foreground";

/**
 * The strip of the day's routines above the timeline. It scrolls sideways with the wheel or by dragging with a mouse, keeps the faded edges in step
 * with what is actually off screen, and swallows the click a drag ends on so dragging never ticks a routine.
 */
export function DayRoutinesShelf({
  items,
  completedIds,
  onToggle,
  onOpenManager,
}: {
  items: DayChecklistItem[];
  completedIds: string[];
  onToggle: (id: string, completed: boolean) => void;
  onOpenManager: () => void;
}) {
  const doneCount = items.filter((item) => completedIds.includes(item.id)).length;

  const stripRef = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const [dragging, setDragging] = useState(false);

  const updateEdges = () => {
    const el = stripRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 1);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  // Measure on mount, when the items change and when the strip is resized: each just means "measure again".
  useEffect(() => {
    updateEdges();
    const el = stripRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateEdges);
    observer.observe(el);
    return () => observer.disconnect();
  }, [items.length]);

  const scrollByPage = (direction: -1 | 1) => {
    const el = stripRef.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.7, behavior: "smooth" });
  };

  // A vertical mouse wheel scrolls the strip sideways, unless it is already at that end (then the page gets
  // the wheel). React's `onWheel` is passive, so this is attached by hand to be able to preventDefault.
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      const atStart = el.scrollLeft <= 0 && event.deltaY < 0;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 && event.deltaY > 0;
      if (el.scrollWidth <= el.clientWidth || atStart || atEnd) return;
      event.preventDefault();
      el.scrollLeft += event.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Click-and-drag with a mouse. Touch and pen already scroll natively.
  const press = useRef<{ x: number; scrollLeft: number; pointerId: number } | null>(null);
  const moved = useRef(false);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0 || !stripRef.current) return;
    press.current = { x: event.clientX, scrollLeft: stripRef.current.scrollLeft, pointerId: event.pointerId };
    moved.current = false;
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = stripRef.current;
    const start = press.current;
    if (!start || !el) return;
    const dx = event.clientX - start.x;
    if (!moved.current && Math.abs(dx) < DRAG_THRESHOLD) return;
    if (!moved.current) {
      moved.current = true;
      setDragging(true);
      el.setPointerCapture(start.pointerId);
    }
    el.scrollLeft = start.scrollLeft - dx;
  };

  const endDrag = () => {
    press.current = null;
    setDragging(false);
  };

  // A drag ends with a click on whichever chip is under the cursor; swallow it so dragging never ticks a
  // routine.
  const onClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!moved.current) return;
    event.stopPropagation();
    event.preventDefault();
    moved.current = false;
  };

  const edgeMask = useMemo(() => {
    const left = canLeft ? "transparent 0, black 28px" : "black 0";
    const right = canRight ? "black calc(100% - 28px), transparent 100%" : "black 100%";
    return `linear-gradient(to right, ${left}, ${right})`;
  }, [canLeft, canRight]);

  return (
    <div className="mx-auto max-w-4xl border-b border-border/60 px-3 pb-2.5 pt-3 sm:px-6">
      <div className="flex items-center gap-2">
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-foreground">
          Routines
          <span
            className={[
              "font-medium tabular-nums",
              doneCount === items.length ? "text-success" : "text-muted-foreground",
            ].join(" ")}
          >
            {doneCount}/{items.length}
          </span>
        </span>

        {canLeft ? (
          <button
            type="button"
            className={[ARROW, "max-lg:hidden"].join(" ")}
            aria-label="Scroll routines left"
            onClick={() => scrollByPage(-1)}
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
        <div
          ref={stripRef}
          className={[
            "no-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-1",
            dragging ? "cursor-grabbing select-none" : "cursor-grab",
          ].join(" ")}
          style={{ maskImage: edgeMask, WebkitMaskImage: edgeMask }}
          onScroll={updateEdges}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClickCapture={onClickCapture}
        >
          {items.map((item) => {
            const done = completedIds.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={done}
                className={[
                  "group inline-flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-full border pl-1.5 pr-3 text-[13px] font-medium transition-colors touch:h-10 touch:pl-2 touch:pr-3.5",
                  done
                    ? "border-transparent bg-foreground/[0.045] text-muted-foreground line-through decoration-foreground/30"
                    : "border-border bg-card text-foreground shadow-xs hover:border-input hover:bg-accent/50",
                ].join(" ")}
                onClick={() => onToggle(item.id, !done)}
              >
                <span
                  className={[
                    "tick pointer-events-none h-[18px] w-[18px] text-[10px] font-bold touch:h-5 touch:w-5",
                    done ? "border-success bg-success text-success-foreground" : "group-hover:border-success",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  ✓
                </span>
                <span aria-hidden="true">{item.emoji}</span>
                <span className="max-w-[12rem] truncate">{item.title}</span>
              </button>
            );
          })}
        </div>
        {canRight ? (
          <button
            type="button"
            className={[ARROW, "max-lg:hidden"].join(" ")}
            aria-label="Scroll routines right"
            onClick={() => scrollByPage(1)}
          >
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}

        <button
          type="button"
          className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-full border border-dashed border-foreground/20 px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground touch:h-10 touch:px-3.5 touch:text-[13px]"
          title="Manage habits"
          onClick={onOpenManager}
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
          <span>Manage</span>
        </button>
      </div>
    </div>
  );
}
