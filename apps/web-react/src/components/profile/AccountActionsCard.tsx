import { LogOut } from "lucide-react";

export function AccountActionsCard({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="card flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center sm:p-7">
      <div>
        <h3 className="text-base font-semibold tracking-[-0.015em] text-foreground">Sign out</h3>
        <p className="mt-0.5 text-[13px] text-muted-foreground">Sign out of your account on this device.</p>
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="btn btn-secondary btn-md h-11 sm:h-9"
      >
        <LogOut className="text-muted-foreground" aria-hidden="true" />
        <span>Log out</span>
      </button>
    </div>
  );
}
