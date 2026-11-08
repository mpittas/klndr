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
      className="btn btn-secondary btn-lg w-full text-sm"
    >
      {icon}
      {children}
    </button>
  );
}
