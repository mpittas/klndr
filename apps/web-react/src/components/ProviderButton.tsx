import type { ReactNode } from "react";

/** One of the "Continue with …" buttons. */
export function ProviderButton({
  icon,
  children,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-11 w-full items-center justify-center gap-2.5 rounded-md border border-input bg-background px-3.5 py-2 text-sm font-medium text-foreground shadow-xs transition hover:bg-accent hover:text-accent-foreground disabled:opacity-50 sm:h-9"
    >
      {icon}
      {children}
    </button>
  );
}
