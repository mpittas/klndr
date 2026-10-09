export function ProfileCard({
  initials,
  displayName,
  email,
  uid,
  guest = false,
}: {
  initials: string;
  displayName: string;
  email: string;
  uid: string;
  /** A guest has no account: their planner is only in this browser, so there is no Firebase to show. */
  guest?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground shadow-xs">
            {initials}
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">{displayName || "Your Profile"}</h1>
            <p className="text-xs text-muted-foreground sm:text-sm">{email}</p>
            {guest ? (
              <div className="mt-1.5 flex items-center gap-2">
                <span className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  Guest · this browser only
                </span>
              </div>
            ) : (
              <div className="mt-1.5 flex items-center gap-2">
                <span className="inline-flex items-center rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  Firebase Connected
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">UID: {uid.slice(0, 12)}...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
