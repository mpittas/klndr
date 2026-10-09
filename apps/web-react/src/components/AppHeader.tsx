import { todayISO } from "@klndr/core";
import { Link, useRouterState } from "@tanstack/react-router";
import { Calendar, Clock, Moon, Sun } from "lucide-react";

import { isSignedIn, useAuth } from "@/auth";
import { isFirebaseConfigured } from "@/env";
import { useTheme } from "@/theme";

/**
 * The logo, the Calendar/Today toggle, the theme button and the profile chip. The active tab comes from
 * the router's pathname.
 *
 * The two theme icons stay rendered and CSS picks one (`dark:hidden` / `dark:block`).
 */
export function AppHeader() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const { state } = useAuth();
  const theme = useTheme();

  const today = todayISO();
  const user = isSignedIn(state) ? state.user : null;
  const profile = isSignedIn(state) ? state.profile : null;
  const loading = state.status === "loading";

  const isDayView = path.startsWith("/day");
  const isCalendarView = path === "/calendar";
  const onLoginPage = path === "/login";

  const displayName = profile?.displayName || user?.displayName || user?.email?.split("@")[0] || "User";

  const initials = (() => {
    const name = displayName.trim();
    if (!name) return "U";
    const parts = name.split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  })();

  const tabClass = (active: boolean) =>
    [
      "relative inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs font-medium transition-all active:scale-[0.98] sm:h-7 max-[359px]:w-10 max-[359px]:px-0",
      active
        ? "bg-primary font-semibold text-primary-foreground shadow-xs"
        : "text-muted-foreground hover:bg-background/50 hover:text-foreground",
    ].join(" ");

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-border bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 w-full items-center justify-between gap-2 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] short:h-12 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-6">
          <Link
            to={user ? "/calendar" : "/"}
            className="group -mx-1 flex items-center px-1 py-2"
            aria-label="klndr. home"
          >
            <span className="text-lg font-bold tracking-tight text-foreground transition group-hover:opacity-80 sm:text-xl">
              klndr.
            </span>
          </Link>

          {user ? (
            <nav
              aria-label="Primary"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-muted p-0.5 text-muted-foreground shadow-2xs sm:h-8"
            >
              <Link to="/calendar" className={tabClass(isCalendarView)}>
                <Calendar className="h-3.5 w-3.5 shrink-0 max-[400px]:hidden max-[359px]:block max-[359px]:h-4 max-[359px]:w-4" />
                <span className="max-[359px]:sr-only">Calendar</span>
              </Link>
              <Link to="/day/$date" params={{ date: today }} className={tabClass(isDayView)}>
                <Clock className="h-3.5 w-3.5 shrink-0 max-[400px]:hidden max-[359px]:block max-[359px]:h-4 max-[359px]:w-4" />
                <span className="max-[359px]:sr-only">Today</span>
              </Link>
            </nav>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label="Toggle light/dark theme"
            title="Toggle theme"
            className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border border-input bg-background text-foreground shadow-2xs transition-colors hover:bg-accent hover:text-accent-foreground sm:h-8 sm:w-8"
            onClick={theme.toggle}
          >
            <Moon className="h-4 w-4 dark:hidden" aria-hidden="true" />
            <Sun className="hidden h-4 w-4 dark:block" aria-hidden="true" />
          </button>

          {loading ? (
            <div className="h-10 w-10 animate-pulse rounded-md bg-muted sm:h-8 sm:w-20" />
          ) : user ? (
            <Link
              to="/profile"
              aria-label={`Profile: ${displayName}`}
              className="inline-flex h-10 w-10 items-center justify-center gap-2 rounded-md border border-input bg-background text-xs font-medium text-foreground shadow-2xs transition-colors hover:bg-accent hover:text-accent-foreground sm:h-8 sm:w-auto sm:px-2.5"
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground sm:h-5 sm:w-5">
                {initials}
              </div>
              <span className="hidden max-w-[130px] truncate sm:inline">{displayName}</span>
            </Link>
          ) : (
            <>
              {!onLoginPage ? (
                <Link
                  to="/login"
                  className="inline-flex h-10 items-center whitespace-nowrap rounded-md bg-primary px-3.5 text-xs font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 sm:hidden"
                >
                  Sign in
                </Link>
              ) : null}
              {!onLoginPage ? (
                <Link
                  to="/login"
                  className="hidden h-8 items-center whitespace-nowrap rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:inline-flex"
                >
                  Log In
                </Link>
              ) : null}
              <Link
                to="/signup"
                className="hidden h-8 items-center whitespace-nowrap rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 sm:inline-flex"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>

      {!loading && !isFirebaseConfigured ? (
        <div className="border-t border-amber-200/70 bg-amber-50/70 px-4 py-1 text-center text-[11px] text-amber-900 sm:text-xs dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span className="sm:hidden">Local database · no cloud sync</span>
            <span className="hidden sm:inline">
              Local database active · Set Firebase credentials in{" "}
              <code className="rounded bg-amber-100/70 px-1 font-mono text-[11px] dark:bg-amber-400/20">.env</code> for
              cloud sync
            </span>
          </span>
        </div>
      ) : null}
    </header>
  );
}
