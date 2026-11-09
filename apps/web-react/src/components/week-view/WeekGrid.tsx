import {
  DAY_MINUTES,
  GRID_HEIGHT,
  HOUR_OPTIONS,
  SLOT_HEIGHT,
  WEEKDAY_LABELS,
  blockHeight,
  blockTop,
  boxOf,
  edgeScrollSpeed,
  hasResizeGrip,
  formatDuration,
  formatTime,
  formatTimeRange,
  gutterLabel,
  isShortBlock,
  layoutDay,
  minutesToPx,
  nudgedStart,
  parseISODate,
  pxToMinutes,
  slotAt,
  titleLines,
  type ActivityTemplate,
  type ScheduledTask,
} from "@klndr/core";
import { useCategoryColor } from "@klndr/data";
import { Link } from "@tanstack/react-router";
import { Check, Plus } from "lucide-react";
import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

import { TimeBlock } from "@/components/day-planner/TimeBlock";
import { useBlockResize } from "@/components/day-planner/useBlockResize";
import { paletteOf } from "@/lib/colors";

/** Blocks move in quarter hours, as on the day's timeline. */
const STEP = 15;
/** How far the pointer must travel before a press on a block becomes a drag rather than a click. */
const DRAG_THRESHOLD = 4;
/** The length a click on an empty slot suggests, as on the day's timeline. */
const NEW_LENGTH = 60;

type Drag = {
  task: ScheduledTask;
  pointerId: number;
  x: number;
  y: number;
  /** Where in the block it was grabbed, in minutes from its top, so it doesn't jump under the pointer. */
  grab: number;
  moved: boolean;
  day: string;
  start: number;
};

/**
 * The week as seven narrow timelines side by side, on the same scale as the day's: an hour gutter on the left,
 * a sticky row of days on top (each a link to that day), and the blocks of each day placed exactly as the day
 * view places them, overlaps side by side.
 *
 * A click on an empty slot asks for a new block there; a click on a block opens it; its ring ticks it off. With
 * a mouse or a pen a block can be dragged to another time or another day (the grid scrolls when it is held near
 * the top or the bottom) and made longer or shorter from its bottom edge, as on the day (touch keeps its tap and
 * scroll). A focused block moves with the arrow keys: ↑ ↓ a quarter hour, ← → a day. An activity dragged out of
 * the sidebar can be dropped on any slot, with a ghost of it showing where it will land.
 *
 * In the current week, now is a brand line across today and a faint one across the other days, so the time of
 * day reads anywhere on the grid; the weekend columns are a shade darker.
 */
export function WeekGrid({
  days,
  tasks,
  today,
  nowMinute,
  scrollRef,
  onCreate,
  onEdit,
  onToggle,
  onMove,
  onResize,
  dropping = null,
  onDropActivity,
}: {
  days: string[];
  tasks: ScheduledTask[];
  today: string;
  /** The current minute when today is in this week, else `null`. */
  nowMinute: number | null;
  scrollRef: RefObject<HTMLDivElement | null>;
  onCreate: (day: string, start: number) => void;
  onEdit: (task: ScheduledTask) => void;
  onToggle: (task: ScheduledTask) => void;
  onMove: (task: ScheduledTask, day: string, start: number) => void;
  onResize: (task: ScheduledTask, durationMinutes: number) => void;
  /** The activity being dragged out of the sidebar, if any. */
  dropping?: ActivityTemplate | null;
  onDropActivity?: (day: string, start: number) => void;
}) {
  const colorOf = useCategoryColor();
  const columnsRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hover, setHover] = useState<{ day: string; start: number } | null>(null);
  /** Where the activity being dragged would land. */
  const [dropAt, setDropAt] = useState<{ day: string; start: number } | null>(null);
  /** Set for a moment after a drop: the browser follows it with a click on the column, which must not add a block. */
  const justDropped = useRef(false);
  /** A block moved to another day with the keyboard, to be focused again in its new column. */
  const refocus = useRef<{ id: string; day: string } | null>(null);
  /** The last pointer position of a block drag, for the edge scrolling to work from between moves. */
  const lastPointer = useRef<{ x: number; y: number } | null>(null);

  // Resizing from the bottom edge: the block follows the pointer, and the new length is saved on release.
  const resize = useBlockResize(onResize);
  const live = useMemo(
    () =>
      resize.override
        ? tasks.map((task) =>
            task.id === resize.override?.id ? { ...task, durationMinutes: resize.override.duration } : task,
          )
        : tasks,
    [tasks, resize.override],
  );

  // Each day's blocks in start order. A block being dragged stays in its place (faded) while a copy follows the
  // pointer, so the element the drag started on is never taken out from under it.
  const byDay = useMemo(() => {
    const map = new Map<string, ScheduledTask[]>(days.map((day) => [day, []]));
    for (const task of live) map.get(task.day)?.push(task);
    for (const list of map.values()) list.sort((a, b) => a.startMinutes - b.startMinutes);
    return map;
  }, [days, live]);

  const layouts = useMemo(() => {
    const result = new Map<string, Map<string, { left: number; width: number }>>();
    for (const [day, list] of byDay) {
      const boxes = new Map<string, { left: number; width: number }>();
      for (const [id, placement] of layoutDay(list)) boxes.set(id, boxOf(placement));
      result.set(day, boxes);
    }
    return result;
  }, [byDay]);

  const totals = useMemo(() => {
    const result = new Map<string, { minutes: number; done: number; count: number }>();
    for (const day of days) result.set(day, { minutes: 0, done: 0, count: 0 });
    for (const task of live) {
      const total = result.get(task.day);
      if (!total) continue;
      total.minutes += task.durationMinutes;
      total.count += 1;
      if (task.completed) total.done += 1;
    }
    return result;
  }, [days, live]);

  /** The day column and quarter hour under a point on the screen. */
  const pointAt = (clientX: number, clientY: number) => {
    const rect = columnsRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const index = Math.max(0, Math.min(days.length - 1, Math.floor(((clientX - rect.left) / rect.width) * days.length)));
    return { day: days[index], minutes: pxToMinutes(clientY - rect.top) };
  };

  // ---- Dragging a block to another time or day ----
  const onBlockPointerDown = (task: ScheduledTask, event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.pointerType === "touch") return;
    const point = pointAt(event.clientX, event.clientY);
    if (!point) return;
    setHover(null);
    setDrag({
      task,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      grab: Math.max(0, point.minutes - task.startMinutes),
      moved: false,
      day: task.day,
      start: task.startMinutes,
    });
  };

  /** Puts the dragged block where the pointer at (x, y) says, a quarter hour at a time. */
  const dragTo = (current: Drag, x: number, y: number) => {
    const point = pointAt(x, y);
    if (!point) return;
    const raw = Math.round((point.minutes - current.grab) / STEP) * STEP;
    const start = Math.max(0, Math.min(DAY_MINUTES - current.task.durationMinutes, raw));
    if (!current.moved || point.day !== current.day || start !== current.start) {
      setDrag({ ...current, moved: true, day: point.day, start });
    }
  };

  // The drag follows the pointer anywhere on the page (it may leave the grid), until it is let go.
  const onDragMove = useEffectEvent((event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < DRAG_THRESHOLD) return;
    lastPointer.current = { x: event.clientX, y: event.clientY };
    dragTo(drag, event.clientX, event.clientY);
  });

  // Held near the top or the bottom of the grid, a dragged block scrolls it (faster nearer the edge), so a block
  // can go to any hour without letting go; the block keeps following the pointer as the hours pass under it.
  const onEdgeTick = useEffectEvent(() => {
    const el = scrollRef.current;
    const pointer = lastPointer.current;
    if (!el || !pointer || !drag?.moved) return;
    const rect = el.getBoundingClientRect();
    const header = el.querySelector<HTMLElement>("[data-timeline-header]")?.offsetHeight ?? 0;
    const speed = edgeScrollSpeed(pointer.y, rect.top + header, rect.bottom);
    if (speed === 0) return;
    const before = el.scrollTop;
    el.scrollTop += speed;
    if (el.scrollTop !== before) dragTo(drag, pointer.x, pointer.y);
  });

  const onDragEnd = useEffectEvent((event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const { task, moved, day, start } = drag;
    setDrag(null);
    lastPointer.current = null;
    if (event.type === "pointercancel") return;
    if (moved) {
      justDropped.current = true;
      window.setTimeout(() => (justDropped.current = false), 0);
    }
    if (!moved) onEdit(task);
    else if (day !== task.day || start !== task.startMinutes) onMove(task, day, start);
  });

  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const move = (event: PointerEvent) => onDragMove(event);
    const end = (event: PointerEvent) => onDragEnd(event);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    let frame = requestAnimationFrame(function tick() {
      onEdgeTick();
      frame = requestAnimationFrame(tick);
    });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      cancelAnimationFrame(frame);
    };
  }, [dragging]);

  // A block moved to another day with the keyboard lands in another column (a new element): focus follows it,
  // once it is there (renders in between still have it in the old column).
  useEffect(() => {
    const target = refocus.current;
    if (!target) return;
    const block = columnsRef.current?.querySelector<HTMLElement>(
      `[data-day="${target.day}"] [data-task-id="${target.id}"]`,
    );
    if (!block) return;
    refocus.current = null;
    block.focus();
  });

  /** ↑ ↓ move a focused block a quarter hour, ← → a day (within the week). */
  const onBlockKey = (task: ScheduledTask, key: string) => {
    if (key === "ArrowUp" || key === "ArrowDown") {
      const start = nudgedStart(task.startMinutes, task.durationMinutes, key === "ArrowUp" ? -1 : 1);
      if (start !== task.startMinutes) onMove(task, task.day, start);
      return true;
    }
    if (key === "ArrowLeft" || key === "ArrowRight") {
      const index = days.indexOf(task.day) + (key === "ArrowLeft" ? -1 : 1);
      if (index >= 0 && index < days.length) {
        refocus.current = { id: task.id, day: days[index] };
        onMove(task, days[index], task.startMinutes);
      }
      return true;
    }
    return false;
  };

  // ---- Clicking an empty slot ----
  const onColumnPointerMove = (day: string, event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag || resize.resizing || event.pointerType === "touch" || event.target !== event.currentTarget) {
      if (hover) setHover(null);
      return;
    }
    const start = Math.min(slotAt(event.clientY - event.currentTarget.getBoundingClientRect().top), DAY_MINUTES - STEP);
    if (hover?.day !== day || hover.start !== start) setHover({ day, start });
  };

  // ---- Dropping an activity from the sidebar ----
  const dropPoint = (event: DragEvent<HTMLDivElement>) => {
    const point = pointAt(event.clientX, event.clientY);
    if (!point || !dropping) return null;
    const start = Math.max(0, Math.min(DAY_MINUTES - dropping.defaultDuration, Math.floor(point.minutes / STEP) * STEP));
    return { day: point.day, start };
  };
  const onActivityDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!dropping) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    const at = dropPoint(event);
    if (hover) setHover(null);
    if (at && (at.day !== dropAt?.day || at.start !== dropAt.start)) setDropAt(at);
  };
  const onActivityDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!dropping) return;
    event.preventDefault();
    const at = dropPoint(event);
    setDropAt(null);
    if (at) onDropActivity?.(at.day, at.start);
  };
  const ghost = dropping && dropAt ? { ...dropAt, template: dropping } : null;

  const renderBlock = (task: ScheduledTask, box: { left: number; width: number }, lifted = false) => {
    const start = lifted && drag ? drag.start : task.startMinutes;
    const palette = paletteOf(colorOf(task));
    const short = isShortBlock(task.durationMinutes);
    return (
      <div
        key={task.id}
        role="button"
        tabIndex={0}
        data-task-id={lifted ? undefined : task.id}
        aria-label={`${task.title}, ${formatTimeRange(task.startMinutes, task.startMinutes + task.durationMinutes)}${task.completed ? ", done" : ""}. Enter to edit, arrow keys to move.`}
        className={[
          "absolute select-none transition-[box-shadow,scale,opacity] duration-150 [-webkit-touch-callout:none]",
          lifted
            ? "pointer-events-none z-40 scale-[1.02] rounded-md opacity-95 shadow-xl"
            : drag?.moved && drag.task.id === task.id
              ? "z-10 opacity-35"
              : resize.resizing === task.id
                ? "z-30 cursor-ns-resize"
                : "group/block z-10 cursor-pointer hover:z-20 focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background sm:cursor-grab",
        ].join(" ")}
        style={{
          top: `${blockTop(start)}px`,
          height: `${blockHeight(task.durationMinutes)}px`,
          left: `calc(${box.left * 100}% + 3px)`,
          width: `calc(${box.width * 100}% - 6px)`,
        }}
        onPointerDown={(event) => onBlockPointerDown(task, event)}
        onClick={(event) => {
          event.stopPropagation();
          // Touch has no drag here, so a tap opens the block.
          if ((event.nativeEvent as PointerEvent).pointerType === "touch") onEdit(task);
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey) return;
          if (event.key === "Enter") {
            event.preventDefault();
            onEdit(task);
          } else if (onBlockKey(task, event.key)) {
            event.preventDefault();
          }
        }}
      >
        <TimeBlock
          emoji={task.emoji}
          title={task.title}
          time={formatTimeRange(start, start + task.durationMinutes)}
          color={colorOf(task)}
          done={task.completed}
          short={short}
          lines={titleLines(task.durationMinutes)}
          className="h-full w-full !gap-1.5 !pl-2 !pr-1.5"
          leading={
            <button
              type="button"
              aria-label={task.completed ? "Mark as not done" : "Mark as done"}
              className={[
                "relative z-[1] flex h-3 w-3 shrink-0 cursor-pointer items-center justify-center rounded-full border-[1.5px] transition-colors after:absolute after:-inset-2",
                short ? "" : "mt-0.5",
                task.completed ? `${palette.accent} border-transparent` : `${palette.check} text-transparent`,
              ].join(" ")}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onToggle(task);
              }}
            >
              <Check className="h-2 w-2" aria-hidden="true" strokeWidth={3.5} />
            </button>
          }
        />
        {lifted ? null : (
          <div
            aria-hidden="true"
            data-resize-handle
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              setHover(null);
              resize.startResize(task, event);
            }}
            className={[
              "absolute inset-x-0 bottom-0 flex touch-none cursor-ns-resize items-end justify-center pb-[3px]",
              short ? "h-2" : "h-2.5",
            ].join(" ")}
          >
            {hasResizeGrip(task.durationMinutes) ? (
              <span className="h-0.5 w-5 rounded-full bg-current opacity-0 transition-opacity duration-150 group-hover/block:opacity-25" />
            ) : null}
          </div>
        )}
      </div>
    );
  };

  const todayIndex = days.indexOf(today);

  return (
    <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto overscroll-contain bg-background">
      {/* Wide enough for seven readable columns; narrower screens scroll sideways. */}
      <div className="min-w-[52rem] pb-8">
        {/* The days, kept in view while the hours scroll */}
        <div data-timeline-header className="sticky top-0 z-30 flex border-b border-border bg-background/95 backdrop-blur-sm">
          <div className="sticky left-0 z-10 w-14 shrink-0 bg-background/95 sm:w-16" />
          {days.map((day) => {
            const date = parseISODate(day);
            const total = totals.get(day);
            const isToday = day === today;
            const isPast = day < today;
            return (
              <Link
                key={day}
                to="/day/$date"
                params={{ date: day }}
                aria-label={`Open ${day}`}
                className="group flex min-w-0 flex-1 flex-col items-center gap-1 border-l border-border/60 py-2.5 transition-colors hover:bg-foreground/[0.03] focus-visible:bg-foreground/[0.04] focus-visible:outline-none"
              >
                <span
                  className={[
                    "text-[11px] font-semibold uppercase tracking-[0.06em]",
                    isToday ? "text-brand" : isPast ? "text-muted-foreground/70" : "text-muted-foreground",
                  ].join(" ")}
                >
                  {WEEKDAY_LABELS[date.getDay()]}
                </span>
                <span
                  className={[
                    "flex h-8 min-w-8 items-center justify-center rounded-full px-1 text-[17px] font-semibold tabular-nums leading-none tracking-[-0.02em]",
                    isToday
                      ? "bg-brand text-brand-foreground"
                      : isPast
                        ? "text-muted-foreground group-hover:text-foreground"
                        : "text-foreground",
                  ].join(" ")}
                >
                  {date.getDate()}
                </span>
                <span className="h-4 text-[11px] tabular-nums text-muted-foreground">
                  {total && total.count ? (
                    <>
                      {formatDuration(total.minutes)}
                      <span className="px-1 text-muted-foreground/50">·</span>
                      <span className={total.done === total.count ? "text-success" : undefined}>
                        {total.done}/{total.count}
                      </span>
                    </>
                  ) : null}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="flex">
          {/* Hour gutter, kept in view while the week scrolls sideways */}
          <div className="sticky left-0 z-20 w-14 shrink-0 select-none border-r border-border/80 bg-background pr-1.5 sm:w-16 sm:pr-2.5">
            {HOUR_OPTIONS.map((minute) => (
              <div key={minute} style={{ height: `${SLOT_HEIGHT}px` }} className="relative">
                {gutterLabel(minute) ? (
                  <span
                    className={[
                      "absolute -top-2 right-1.5 text-[11px] font-medium tabular-nums text-muted-foreground/90 sm:right-2",
                      nowMinute !== null && Math.abs(minute - nowMinute) < 14 ? "opacity-0" : "",
                    ].join(" ")}
                  >
                    {gutterLabel(minute)}
                  </span>
                ) : null}
              </div>
            ))}
            {nowMinute !== null ? (
              <div
                className="pointer-events-none absolute right-0.5 z-30 -translate-y-1/2 whitespace-nowrap rounded-full bg-brand px-1.5 py-[3px] text-[10px] font-semibold leading-none tabular-nums text-brand-foreground shadow-[0_1px_3px_rgb(var(--brand-shade)/0.35)] sm:right-1"
                style={{ top: `${minutesToPx(nowMinute)}px` }}
              >
                {formatTime(nowMinute)}
              </div>
            ) : null}
          </div>

          <div
            ref={columnsRef}
            data-timeline-grid
            className="relative flex flex-1"
            style={{ height: `${GRID_HEIGHT}px` }}
            onDragOver={onActivityDragOver}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropAt(null);
            }}
            onDrop={onActivityDrop}
          >
            {/* Hour and half-hour lines, behind every column */}
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              {HOUR_OPTIONS.map((minute) => (
                <div
                  key={minute}
                  style={{ height: `${SLOT_HEIGHT}px` }}
                  className={["border-b", (minute + 30) % 60 === 0 ? "border-border/80" : "border-dashed border-border/40"].join(" ")}
                />
              ))}
            </div>

            {/* Now, faintly across the whole week (today's column draws it in full) */}
            {nowMinute !== null ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 z-[15] h-px bg-brand/45"
                style={{ top: `${minutesToPx(nowMinute)}px` }}
              />
            ) : null}

            {days.map((day, index) => {
              const list = byDay.get(day) ?? [];
              const boxes = layouts.get(day);
              const isToday = index === todayIndex;
              const weekday = parseISODate(day).getDay();
              const isWeekend = weekday === 0 || weekday === 6;
              return (
                <div
                  key={day}
                  data-day={day}
                  className={[
                    "relative min-w-0 flex-1 border-l border-border/60",
                    isToday ? "bg-brand/[0.025]" : isWeekend ? "bg-foreground/[0.015]" : "",
                    drag?.moved ? "cursor-grabbing" : "cursor-pointer",
                  ].join(" ")}
                  onPointerMove={(event) => onColumnPointerMove(day, event)}
                  onPointerLeave={() => setHover(null)}
                  onClick={(event) => {
                    if (event.target !== event.currentTarget || justDropped.current) return;
                    onCreate(day, Math.min(slotAt(event.clientY - event.currentTarget.getBoundingClientRect().top), DAY_MINUTES - STEP));
                  }}
                >
                  {/* Where a click would create a block */}
                  {hover?.day === day ? (
                    <div
                      className="pointer-events-none absolute inset-x-[3px] z-[5] flex items-start gap-1 overflow-hidden rounded-md border border-dashed border-foreground/25 bg-foreground/[0.025] pl-1.5 pt-1 text-[11px] font-medium leading-4 tabular-nums text-muted-foreground"
                      style={{
                        top: `${blockTop(hover.start)}px`,
                        height: `${blockHeight(Math.min(NEW_LENGTH, DAY_MINUTES - hover.start))}px`,
                      }}
                    >
                      <Plus className="h-4 w-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{formatTime(hover.start)}</span>
                    </div>
                  ) : null}

                  {list.map((task) => renderBlock(task, boxes?.get(task.id) ?? { left: 0, width: 1 }))}

                  {/* Where the activity being dragged out of the sidebar will land */}
                  {ghost?.day === day ? (
                    <div
                      className={[
                        "pointer-events-none absolute inset-x-[3px] z-30 flex items-start gap-1 overflow-hidden rounded-md border border-dashed pl-1.5 pt-1 text-[11px] font-semibold leading-4",
                        paletteOf(colorOf(ghost.template)).ghost,
                      ].join(" ")}
                      style={{ top: `${blockTop(ghost.start)}px`, height: `${blockHeight(ghost.template.defaultDuration)}px` }}
                    >
                      <span aria-hidden="true">{ghost.template.emoji}</span>
                      <span className="min-w-0 truncate">
                        {ghost.template.name}
                        <span className="ml-1 font-medium tabular-nums opacity-70">{formatTime(ghost.start)}</span>
                      </span>
                    </div>
                  ) : null}

                  {/* The dragged block, over the column it would land in */}
                  {drag?.moved && drag.day === day ? renderBlock(drag.task, { left: 0, width: 1 }, true) : null}

                  {/* Now, across today's column */}
                  {isToday && nowMinute !== null ? (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
                      style={{ top: `${minutesToPx(nowMinute)}px` }}
                    >
                      <span className="absolute -left-1 h-2 w-2 rounded-full bg-brand ring-2 ring-background" />
                      <span className="h-[1.5px] w-full bg-brand" />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
