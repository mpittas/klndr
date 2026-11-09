/** The wordmark: "dayro" in ink, its full stop in the brand color. Size it with a text class. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={["inline-flex items-baseline font-bold tracking-[-0.045em]", className ?? ""].join(" ")}>
      dayro<span className="text-brand">.</span>
    </span>
  );
}
