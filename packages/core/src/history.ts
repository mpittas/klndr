import type { ApiClient, TaskPatch } from "./api";
import type { ScheduledTask } from "./types";

/** A block as it was before and after a change; null where it didn't exist (created or deleted). */
export type HistoryChange = { before: ScheduledTask | null; after: ScheduledTask | null };
export type HistoryEntry = { label: string; changes: HistoryChange[] };
/** Whether there is anything left to undo or redo. */
export type HistoryState = { canUndo: boolean; canRedo: boolean };
export type HistoryListener = (state: HistoryState) => void;
export type HistoryDirection = "undo" | "redo";
/** A step taken off one stack and put on the other: shown with `preview`, then saved with `save`. */
export type HistoryStep = { direction: HistoryDirection; entry: HistoryEntry };

/**
 * The blocks on screen, wherever they are shown: a day's timeline, a week, a month. Undo may bring back a
 * block on a day other than the one on screen, so it writes to every list that covers the block's day.
 */
export type TaskStore = {
  /** The block as shown now, or undefined when nothing on screen has it. */
  find: (id: string) => ScheduledTask | undefined;
  /** Show this block wherever its day is shown (and nowhere else), in place of the one with its id. */
  put: (task: ScheduledTask) => void;
  /** Take the block off everything that shows it. */
  remove: (id: string) => void;
};

/** Everything the engine needs from the app around it: the API, the blocks on screen, and a voice. */
export type TimelineHistoryOptions = {
  api: Pick<ApiClient, "createTask" | "updateTask" | "deleteTask">;
  store: TaskStore;
  /** After a step failed to save (part of it may have): fetch the blocks afresh. */
  resync?: () => unknown;
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

/** The fields that differ between two versions of a block, with the values of `to`. */
function changedFields(from: ScheduledTask, to: ScheduledTask): Partial<ScheduledTask> {
  const changed: Record<string, unknown> = {};
  for (const field of FIELDS) if (from[field] !== to[field]) changed[field] = to[field];
  return changed as Partial<ScheduledTask>;
}

/**
 * Undo and redo of changes to blocks. Each step remembers the blocks it touched as they were before and
 * after; undoing saves the "before" back (redoing, the "after"). Only the fields a step changed are written,
 * so edits made in between to other fields survive.
 *
 * A step shows on screen at once (`preview`) and is saved afterwards (`save`); steps save one after another,
 * so pressing undo quickly several times can't interleave them. What the server answers is not written over
 * the screen: the screen already shows the step, and may by then show newer changes too.
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

  /**
   * The id a block has now. A block deleted and brought back by undo was made again by the server under a
   * new id; anything that still names the old one (a step, a change made to it while it was being saved)
   * reaches it through this.
   */
  resolve(id: string): string {
    let current = id;
    while (this.aliases.has(current)) current = this.aliases.get(current)!;
    return current;
  }

  /** Undo the last step: shown at once, saved after the steps before it. Resolves once it is saved. */
  undo(): Promise<void> {
    return this.run("undo");
  }

  redo(): Promise<void> {
    return this.run("redo");
  }

  // ---- The parts of a step, for an app that saves through its own queue (see `@dayro/data`) ----

  /** Move the next step to the other stack and hand it over, or say there is nothing to take. */
  take(direction: HistoryDirection): HistoryStep | null {
    const undoing = direction === "undo";
    const entry = (undoing ? this.undoStack : this.redoStack).at(-1);
    if (!entry) {
      this.options.notify?.(undoing ? "Nothing to undo" : "Nothing to redo");
      return null;
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
    return { direction, entry };
  }

  /** Show the step on screen, before the server has it. */
  preview(step: HistoryStep): void {
    for (const [from, to] of this.sides(step)) this.previewChange(from, to);
  }

  /** Save the step; rejects if the server refused any part of it. */
  async save(step: HistoryStep): Promise<void> {
    await Promise.all(this.sides(step).map(([from, to]) => this.saveChange(from, to)));
  }

  /** Say the step is done. */
  saved(step: HistoryStep): void {
    this.options.notify?.(`${step.direction === "undo" ? "Undid" : "Redid"}: ${step.entry.label}`);
  }

  /** Part of the step may have saved: say so, fetch what the server has and start the history afresh. */
  failed(step: HistoryStep): void {
    this.options.notify?.(`Could not ${step.direction} that`);
    this.clear();
    // If even that fails, what is on screen stays; the next change or a reload brings it back in line.
    const { resync } = this.options;
    if (resync) void Promise.resolve().then(resync).catch(() => {});
  }

  // ---- Inside ----

  private publish(): void {
    const state = this.state();
    for (const listener of this.listeners) listener(state);
  }

  private run(direction: HistoryDirection): Promise<void> {
    const step = this.take(direction);
    if (!step) return this.queue;
    this.preview(step);
    this.queue = this.queue.then(() =>
      this.save(step).then(
        () => this.saved(step),
        () => this.failed(step),
      ),
    );
    return this.queue;
  }

  /** Each change of a step as [what is there now, what to make it]. */
  private sides({ direction, entry }: HistoryStep): [ScheduledTask | null, ScheduledTask | null][] {
    return entry.changes.map(({ before, after }) => (direction === "undo" ? [after, before] : [before, after]));
  }

  private previewChange(from: ScheduledTask | null, to: ScheduledTask | null): void {
    const { store } = this.options;
    if (!to) {
      store.remove(this.resolve(from!.id));
      return;
    }
    const id = this.resolve(to.id);
    // Made again: shown under its old id until the server has given it a new one (see `saveChange`).
    if (!from) {
      store.put({ ...to, id });
      return;
    }
    // Only what the step changed, over the block as it is now; if nothing on screen has it (say it was moved
    // to a day that isn't loaded), the block as the step remembers it.
    store.put({ ...(store.find(id) ?? to), ...changedFields(from, to), id });
  }

  private async saveChange(from: ScheduledTask | null, to: ScheduledTask | null): Promise<void> {
    const { api, store } = this.options;
    if (!to) {
      await api.deleteTask(this.resolve(from!.id));
      return;
    }
    if (!from) {
      const stale = this.resolve(to.id);
      const { id: _id, lane, ...draft } = to;
      const created = await api.createTask({ ...draft, ...(typeof lane === "number" ? { lane } : {}) });
      if (created.id === stale) return;
      this.aliases.set(stale, created.id);
      // Swap the stand-in for the saved block, keeping whatever was done to it meanwhile. A stand-in that is
      // gone was taken away again (or was never on screen), so nothing is put back.
      const shown = store.find(stale);
      store.remove(stale);
      if (shown) store.put({ ...shown, id: created.id, templateId: created.templateId });
      return;
    }
    const patch: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(changedFields(from, to))) patch[field] = value ?? null; // a lane that wasn't set is cleared
    if (!Object.keys(patch).length) return;
    await api.updateTask(this.resolve(to.id), patch as TaskPatch);
  }
}
