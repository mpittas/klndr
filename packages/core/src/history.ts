import type { ApiClient, TaskPatch } from "./api";
import type { ScheduledTask } from "./types";

/** A block as it was before and after a change; null where it didn't exist (created or deleted). */
export type HistoryChange = { before: ScheduledTask | null; after: ScheduledTask | null };
export type HistoryEntry = { label: string; changes: HistoryChange[] };
/** Whether there is anything left to undo or redo. */
export type HistoryState = { canUndo: boolean; canRedo: boolean };
export type HistoryListener = (state: HistoryState) => void;

/** Everything the engine needs from the app around it: the API, the list on screen, and a voice. */
export type TimelineHistoryOptions = {
  api: Pick<ApiClient, "createTask" | "updateTask" | "deleteTask" | "getTasksForDay">;
  /** The blocks currently on screen. */
  getTasks: () => ScheduledTask[];
  /** Replace the blocks on screen; the engine keeps them sorted by start time. */
  setTasks: (tasks: ScheduledTask[]) => void;
  /** The day on screen, so a block brought back by undo only shows up when it belongs there. */
  day: () => string;
  /** Where "Undid: …" and failure messages go. */
  notify?: (message: string) => void;
  /** How many steps to remember. */
  limit?: number;
};

const DEFAULT_LIMIT = 100;
// What undo and redo may set back. Ids and template links stay as the server made them.
const FIELDS = [
  "title", "emoji", "color", "category", "day", "startMinutes", "durationMinutes", "notes", "completed", "lane",
] as const;

/**
 * Undo and redo for changes made on the timeline. Each step remembers the blocks it touched as they
 * were before and after, and undoing saves the "before" back (redoing, the "after"). Only the fields
 * a step changed are written, so edits made in between to other fields survive.
 *
 * Framework-free: the app subscribes with `subscribe` to know whether there is anything to undo.
 */
export class TimelineHistory {
  private readonly options: TimelineHistoryOptions;
  private readonly limit: number;
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  // Undoing a delete makes the block again under a new id; later steps still name the old one.
  private readonly aliases = new Map<string, string>();
  // Steps save one after another, so pressing undo quickly several times can't interleave them.
  private queue: Promise<void> = Promise.resolve();
  private readonly listeners = new Set<HistoryListener>();

  constructor(options: TimelineHistoryOptions) {
    this.options = options;
    this.limit = options.limit ?? DEFAULT_LIMIT;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  state(): HistoryState {
    return { canUndo: this.canUndo, canRedo: this.canRedo };
  }

  /** Called once now and on every change; returns a function that stops listening. */
  subscribe(listener: HistoryListener): () => void {
    this.listeners.add(listener);
    listener(this.state());
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Remember a change; each pair is [before, after] and a null side means it was created or deleted. */
  record(label: string, pairs: [ScheduledTask | null | undefined, ScheduledTask | null | undefined][]): void {
    const changes = pairs
      .filter(([before, after]) => (before && after ? FIELDS.some((field) => before[field] !== after[field]) : before || after))
      .map(([before, after]) => ({ before: before ? { ...before } : null, after: after ? { ...after } : null }));
    if (!changes.length) return;
    this.undoStack = [...this.undoStack, { label, changes }].slice(-this.limit);
    this.redoStack = [];
    this.publish();
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.aliases.clear();
    this.publish();
  }

  /** Resolves once the queued steps have finished, so tests can await it. */
  undo(): Promise<void> {
    return this.step("undo");
  }

  redo(): Promise<void> {
    return this.step("redo");
  }

  private publish(): void {
    const state = this.state();
    for (const listener of this.listeners) listener(state);
  }

  private resolve(id: string): string {
    let current = id;
    while (this.aliases.has(current)) current = this.aliases.get(current)!;
    return current;
  }

  // Puts the saved block on the timeline, or takes it off if it's gone or now on another day.
  private show(id: string, task: ScheduledTask | null): void {
    const rest = this.options.getTasks().filter((item) => item.id !== id);
    const next = task && task.day === this.options.day() ? [...rest, task] : rest;
    this.options.setTasks(next.sort((a, b) => a.startMinutes - b.startMinutes));
  }

  private async apply(from: ScheduledTask | null, to: ScheduledTask | null): Promise<void> {
    const { api } = this.options;
    if (!to) {
      const id = this.resolve(from!.id);
      await api.deleteTask(id);
      this.show(id, null);
      return;
    }
    if (!from) {
      const { id: _id, lane, ...draft } = to;
      const created = await api.createTask({ ...draft, ...(typeof lane === "number" ? { lane } : {}) });
      const gone = this.resolve(to.id);
      if (gone !== created.id) this.aliases.set(gone, created.id);
      this.show(created.id, created);
      return;
    }
    const patch: Record<string, unknown> = {};
    for (const field of FIELDS) {
      if (from[field] !== to[field]) patch[field] = to[field] ?? null; // a lane that wasn't set is cleared
    }
    if (!Object.keys(patch).length) return;
    const id = this.resolve(to.id);
    this.show(id, await api.updateTask(id, patch as TaskPatch));
  }

  private step(direction: "undo" | "redo"): Promise<void> {
    const undoing = direction === "undo";
    const entry = (undoing ? this.undoStack : this.redoStack).at(-1);
    if (!entry) {
      this.options.notify?.(undoing ? "Nothing to undo" : "Nothing to redo");
      return Promise.resolve();
    }
    const remaining = (undoing ? this.undoStack : this.redoStack).slice(0, -1);
    const opposite = [...(undoing ? this.redoStack : this.undoStack), entry];
    if (undoing) {
      this.undoStack = remaining;
      this.redoStack = opposite;
    } else {
      this.redoStack = remaining;
      this.undoStack = opposite;
    }
    this.publish();
    this.queue = this.queue.then(async () => {
      try {
        await Promise.all(
          entry.changes.map(({ before, after }) => (undoing ? this.apply(after, before) : this.apply(before, after))),
        );
        this.options.notify?.(`${undoing ? "Undid" : "Redid"}: ${entry.label}`);
      } catch {
        // Part of it may have saved; show what the server has and start the history afresh from there.
        this.options.notify?.(`Could not ${direction} that`);
        this.clear();
        try {
          this.options.setTasks(await this.options.api.getTasksForDay(this.options.day()));
        } catch {
          // Keep what is on screen; the next change or a reload brings it back in line.
        }
      }
    });
    return this.queue;
  }
}
