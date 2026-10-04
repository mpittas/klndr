import { useEffect } from "react";

/**
 * The document title for the screen on show.
 *
 * A Vite SPA has no head manager, and the screens only ever change the title, so a one-line effect is
 * the whole of what is needed.
 */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
