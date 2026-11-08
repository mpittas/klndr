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
    <div className="card overflow-hidden p-5 sm:p-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <div className="avatar h-16 w-16 text-xl">
            {initials}
          </div>
          <div>
            <h1 className="text-[1.375rem] font-semibold tracking-[-0.025em] text-foreground">{displayName || "Your Profile"}</h1>
            <p className="text-[13px] text-muted-foreground">{email}</p>
            {guest ? (
              <div className="mt-1.5 flex items-center gap-2">
                <span className="inline-flex h-6 items-center rounded-full bg-foreground/[0.06] px-2.5 text-xs font-medium text-muted-foreground">
                  Guest · this browser only
                </span>
              </div>
            ) : (
              <div className="mt-1.5 flex items-center gap-2">
                <span className="inline-flex h-6 items-center rounded-full bg-success/12 px-2.5 text-xs font-medium text-success">
                  Firebase Connected
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">UID {uid.slice(0, 12)}…</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
