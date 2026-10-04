import { LogOut } from "lucide-react";

export function AccountActionsCard({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-xs sm:flex-row sm:items-center sm:p-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Sign Out</h3>
        <p className="text-xs text-muted-foreground">Sign out of your account on this device.</p>
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-4 text-xs font-medium text-destructive transition hover:bg-destructive hover:text-destructive-foreground sm:h-9 sm:text-sm"
      >
        <LogOut className="h-4 w-4" />
        <span>Log Out</span>
      </button>
    </div>
  );
}
