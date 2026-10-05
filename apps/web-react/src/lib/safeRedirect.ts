/**
 * Only allow same-site relative paths, so `?redirect=` can't send users elsewhere.
 */
export function safeRedirect(value: unknown, fallback = "/calendar"): string {
  if (typeof value !== "string") return fallback;
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : fallback;
}
