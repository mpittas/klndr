import { todayISO } from "@klndr/core";
import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarDays, CalendarRange, Clock } from "lucide-react";

import { isSignedIn, useAuth } from "@/auth";
import { AccountMenu } from "@/components/AccountMenu";
import { ThemeMenu } from "@/components/ThemeMenu";
import { Wordmark } from "@/components/Wordmark";
import { isFirebaseConfigured } from "@/env";

/**
 * The logo, the Month/Week/Day switch, the theme menu and the account menu (profile, appearance, the way back
 * to the homepage, log out). The active tab comes from the router's pathname.
 */
export function AppHeader() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const { state } = useAuth();

  const today = todayISO();
  const user = isSignedIn(state) ? state.user : null;
  const profile = isSignedIn(state) ? state.profile : null;
  const loading = state.status === "loading";

  const isDayView = path.startsWith("/day");
  const isCalendarView = path === "/calendar";
  const isWeekView = path.startsWith("/week");
  const onLoginPage = path === "/login";

  const displayName = profile?.displayName || user?.displayName || user?.email?.split("@")[0] || "User";
  const accountDetail = user?.email ?? (state.status === "guest" ? "Guest · this browser only" : "Signed in");

  const initials = (() => {
    const name = displayName.trim();
    if (!name) return "U";
    const parts = name.split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  })();

  const tab = "segmented-item h-full px-3 max-[359px]:w-10 max-[359px]:flex-none max-[359px]:px-0";
  const tabIcon = "h-3.5 w-3.5 shrink-0 max-[400px]:hidden max-[359px]:block max-[359px]:h-4 max-[359px]:w-4";

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-border/80 bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
      <div className="flex h-14 w-full items-center justify-between gap-2 pl-[max(0.875rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] short:h-12 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3 sm:gap-7">
          <Link
            to={user ? "/calendar" : "/"}
            className="-mx-1 flex items-center rounded-md px-1 py-2 text-[1.3rem] leading-none text-foreground transition-opacity hover:opacity-75"
            aria-label="klndr. home"
          >
            <Wordmark />
          </Link>

          {user ? (
            <nav aria-label="Primary" className="segmented h-10 sm:h-9">
              <Link to="/calendar" aria-current={isCalendarView ? "page" : undefined} className={tab}>
                <CalendarDays className={tabIcon} aria-hidden="true" />
                <span className="max-[359px]:sr-only">Month</span>
              </Link>
              <Link
                to="/week/$date"
                params={{ date: today }}
                aria-current={isWeekView ? "page" : undefined}
                className={tab}
              >
                <CalendarRange className={tabIcon} aria-hidden="true" />
                <span className="max-[359px]:sr-only">Week</span>
              </Link>
              <Link
                to="/day/$date"
                params={{ date: today }}
                aria-current={isDayView ? "page" : undefined}
                className={tab}
              >
                <Clock className={tabIcon} aria-hidden="true" />
                <span className="max-[359px]:sr-only">Day</span>
              </Link>
            </nav>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <ThemeMenu triggerClassName="btn btn-ghost btn-icon h-10 sm:h-9" />

          {loading ? (
            <div className="h-10 w-10 animate-pulse rounded-full bg-muted sm:h-9 sm:w-24 sm:rounded-lg" />
          ) : user ? (
            <AccountMenu displayName={displayName} initials={initials} detail={accountDetail} />
          ) : (
            <>
              {!onLoginPage ? (
                <Link to="/login" className="btn btn-ghost btn-sm h-10 text-foreground sm:h-8">
                  Log in
                </Link>
              ) : null}
              <Link to="/signup" className="btn btn-primary btn-sm h-10 sm:h-8">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>

      {!loading && !isFirebaseConfigured ? (
        <div className="border-t border-border/70 bg-muted/60 px-4 py-1 text-center text-[11px] text-muted-foreground sm:text-xs">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true" />
            <span className="sm:hidden">Local database · no cloud sync</span>
            <span className="hidden sm:inline">
              Local database · add Firebase credentials to <code className="font-medium text-foreground">.env</code> for
              cloud sync
            </span>
          </span>
        </div>
      ) : null}
    </header>
  );
}
