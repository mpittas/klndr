import { RouterProvider } from "@tanstack/react-router";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";

import { AuthProvider, useAuth } from "@/auth";
import { AppDataProvider } from "@/data/provider";
import { router } from "@/router";
import { ThemeProvider } from "@/theme";
import { ToastProvider } from "@/toast";

import "./styles.css";

/**
 * The app, once Firebase has said who is signed in.
 *
 * Nothing but the splash is drawn until then: the data provider treats "no user yet" as *signed out* and
 * would wipe the person's cache, and the route guard would send a signed-in visitor to /login. After this
 * first answer the state never returns to `loading` (see `AuthState`), so the router is never unmounted
 * mid-navigation.
 */
function AppShell() {
  const auth = useAuth();

  // Re-run the guards when it changes; this is what sends a person to /login the moment they sign out.
  // Not while `loading`: the router has no auth context until it is mounted below, and its first load
  // (on mount) already runs the guards with the answer.
  const status = auth.state.status;
  useEffect(() => {
    if (status !== "loading") void router.invalidate();
  }, [status]);

  if (auth.state.status === "loading") return <Splash />;

  return (
    <AppDataProvider>
      <RouterProvider router={router} context={{ auth }} />
    </AppDataProvider>
  );
}

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas text-sm text-muted-foreground">
      Loading…
    </div>
  );
}

const container = document.getElementById("root");
if (!container) throw new Error("index.html has no #root element.");

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <AppShell />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
