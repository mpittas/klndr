import type { DayNotes } from "@klndr/core";

export type NotesStatus = "idle" | "saving" | "saved" | "error";

export type NotesSaverOptions = {
  save: (day: string, text: string) => Promise<DayNotes>;
  /** The server's copy after each save. */
  onSaved: (notes: DayNotes) => void;
  /** How long typing has to pause before the text is sent. */
  delayMs?: number;
};

export const NOTES_SAVE_DELAY_MS = 700;

/**
 * Saves a day's notes while they are being typed: waits for a pause, sends one request at a time and always
 * sends the latest text. A failed save keeps the text, so the next edit or `retry()` sends it again.
 * Framework-free; a screen subscribes to `status`.
 */
export class NotesSaver {
  private readonly options: NotesSaverOptions;
  private pending: { day: string; text: string } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight = false;
  private current: NotesStatus = "idle";
  private readonly listeners = new Set<() => void>();

  constructor(options: NotesSaverOptions) {
    this.options = options;
  }

  get status(): NotesStatus {
    return this.current;
  }

  /** True while there is text not yet on the server: waiting to be sent, or on its way. */
  get busy(): boolean {
    return this.pending !== null || this.inFlight;
  }

  /** Called on every status change. Arrow function, so it can be passed straight to `useSyncExternalStore`. */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** The text for `day` was edited; send it once typing pauses. */
  queue(day: string, text: string): void {
    this.setStatus("idle");
    this.pending = { day, text };
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.options.delayMs ?? NOTES_SAVE_DELAY_MS);
  }

  /** Send what is waiting now. Resolves once it and anything typed meanwhile has been saved (or has failed). */
  flush(): Promise<void> {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    return this.send();
  }

  /** Try again after a failure. */
  retry(): Promise<void> {
    return this.flush();
  }

  /** Forget the status (a different day is on screen); text still waiting is kept and will be sent. */
  reset(): void {
    this.setStatus("idle");
  }

  /** Stop the timer and send what is waiting; for when the screen goes away. */
  dispose(): Promise<void> {
    return this.flush();
  }

  private setStatus(status: NotesStatus): void {
    if (this.current === status) return;
    this.current = status;
    for (const listener of this.listeners) listener();
  }

  private async send(): Promise<void> {
    if (this.inFlight || !this.pending) return;
    const job = this.pending;
    this.pending = null;
    this.inFlight = true;
    this.setStatus("saving");
    try {
      const saved = await this.options.save(job.day, job.text);
      this.options.onSaved(saved);
      if (!this.pending) this.setStatus("saved");
    } catch {
      // Put the text back so the retry (or the next edit) sends it again.
      this.pending ??= job;
      this.setStatus("error");
    } finally {
      this.inFlight = false;
    }
    if (this.pending && this.current !== "error") await this.send();
  }
}
