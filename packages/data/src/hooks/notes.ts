import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { queryKeys } from "../keys";
import { NotesSaver } from "../notes-saver";
import { announceChange } from "../tab-sync";
import { useData } from "../provider";
import { useDayNotes } from "./queries";

/**
 * The notes of one day as an editor needs them: the text being typed, saved a moment after typing pauses
 * and never overwritten by the server's copy while there is unsaved typing. Switching day saves what was
 * typed on the previous one under that day.
 */
export function useNotesEditor(day: string, options: { delayMs?: number } = {}) {
  const { api } = useData();
  const queryClient = useQueryClient();
  const query = useDayNotes(day);

  const saved = query.data;
  const loaded = saved !== undefined && saved.day === day;
  const serverText = loaded ? saved.text : "";
  const state: "loading" | "ready" | "error" = loaded ? "ready" : query.isError ? "error" : "loading";

  const latest = useRef({ api, queryClient, serverText });
  latest.current = { api, queryClient, serverText };

  const saverRef = useRef<NotesSaver | null>(null);
  saverRef.current ??= new NotesSaver({
    save: (forDay, text) => latest.current.api.saveDayNotes(forDay, text),
    onSaved: (saved) => {
      latest.current.queryClient.setQueryData(queryKeys.notes(saved.day), saved);
      announceChange(latest.current.queryClient, ["notes"]);
    },
    delayMs: options.delayMs,
  });
  const saver = saverRef.current;
  const status = useSyncExternalStore(saver.subscribe, () => saver.status, () => "idle" as const);

  const [text, setText] = useState(serverText);

  // Keep the editor in step with the server copy, but never clobber unsaved typing.
  const shownDay = useRef(day);
  useEffect(() => {
    if (shownDay.current !== day) {
      shownDay.current = day;
      saver.reset();
      // Whatever was typed on the previous day is saved under that day first.
      void saver.flush().finally(() => setText(latest.current.serverText));
      return;
    }
    if (!saver.busy) setText(serverText);
  }, [day, serverText, saver]);

  // Leaving the screen sends what is still waiting.
  useEffect(() => () => void saver.dispose(), [saver]);

  const edit = useCallback(
    (next: string) => {
      setText(next);
      saver.queue(day, next);
    },
    [saver, day],
  );

  return {
    text,
    /** The text was edited. */
    edit,
    /** `error` means the last save failed; the text is kept and `retrySave` or the next edit sends it again. */
    status,
    /** `loading` and `error` are about reading the saved notes; only `ready` should be edited. */
    state,
    retryLoad: useCallback(() => void query.refetch(), [query]),
    retrySave: useCallback(() => saver.retry(), [saver]),
    /** Send now instead of waiting for typing to pause. */
    saveNow: useCallback(() => saver.flush(), [saver]),
  };
}
