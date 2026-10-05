/**
 * Stops the page behind a modal from scrolling. Reference counted, so stacked modals
 * (e.g. the library over the block editor) only release the page once the last one closes.
 */
let locks = 0;
let saved: { overflow: string; paddingRight: string } | null = null;

export function lockScroll() {
  if (typeof document === "undefined") return;
  if (locks++ > 0) return;
  const { body, documentElement } = document;
  const scrollbar = window.innerWidth - documentElement.clientWidth;
  saved = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
  body.style.overflow = "hidden";
  // Keep the layout from jumping sideways when a desktop scrollbar disappears.
  if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
}

export function unlockScroll() {
  if (typeof document === "undefined") return;
  if (locks === 0 || --locks > 0) return;
  if (saved) {
    document.body.style.overflow = saved.overflow;
    document.body.style.paddingRight = saved.paddingRight;
  }
  saved = null;
}
