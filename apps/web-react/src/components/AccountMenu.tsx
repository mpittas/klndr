import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ChevronDown, FileText, Info, LogOut, Palette, Settings, ShieldCheck } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { useAuth } from "@/auth";
import { ThemeSwatch } from "@/components/ThemeSwatch";
import { THEME_OPTIONS, useTheme } from "@/theme";

const itemClass = "menu-item h-9 gap-3 touch:h-11";
const iconClass = "h-4 w-4 shrink-0 text-muted-foreground";

/**
 * The avatar chip in the app header and the menu it opens: who is signed in, their profile, the look of the app,
 * the way back to the homepage (the landing page) and the policies, and signing out. Modelled on the account
 * menus of Claude and Snowflake: the person on top, then settings, then "learn more", then log out.
 */
export function AccountMenu({
  displayName,
  initials,
  detail,
}: {
  displayName: string;
  initials: string;
  /** The line under the name: an email, or what kind of session this is. */
  detail: string;
}) {
  const { signOut } = useAuth();
  const theme = useTheme();
  const navigate = useNavigate();
  const path = useRouterState({ select: (state) => state.location.pathname });
  const themeLabel =
    theme.preference === "system" ? "Match device" : (THEME_OPTIONS.find((option) => option.name === theme.preference)?.label ?? "");

  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  /** Where the focus goes when the menu opens: the first item from the keyboard, the menu itself on a click. */
  const focusOnOpen = useRef<"first" | "last" | "menu">("menu");

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus({ preventScroll: true });
  };

  // A route change (any item that navigates) closes the menu. Adjusted while rendering, not in an effect.
  const [openedOn, setOpenedOn] = useState(path);
  if (path !== openedOn) {
    setOpenedOn(path);
    if (open) setOpen(false);
  }

  // A press anywhere else closes it.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
    if (focusOnOpen.current === "first") items[0]?.focus();
    else if (focusOnOpen.current === "last") items[items.length - 1]?.focus();
    else menuRef.current?.focus({ preventScroll: true });
  }, [open]);

  const onTriggerKeydown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    focusOnOpen.current = event.key === "ArrowDown" ? "first" : "last";
    setOpen(true);
  };

  const onMenuKeydown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "Tab") {
      close(false);
      return;
    }
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem], [role=menuitemradio]") ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  };

  const logOut = async () => {
    close(false);
    await signOut();
    void navigate({ to: "/login" });
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Account: ${displayName}`}
        data-active={path === "/profile" || open}
        className="btn btn-ghost h-10 w-10 rounded-full px-0 text-[13px] text-foreground data-[active=true]:bg-foreground/[0.055] sm:h-9 sm:w-auto sm:gap-2 sm:rounded-lg sm:pl-1.5 sm:pr-2"
        onClick={() => {
          focusOnOpen.current = "menu";
          setOpen((value) => !value);
        }}
        onKeyDown={onTriggerKeydown}
      >
        <span className="avatar h-8 w-8 text-[11px] sm:h-6 sm:w-6 sm:text-[10px]">{initials}</span>
        <span className="hidden max-w-[130px] truncate sm:inline">{displayName}</span>
        <ChevronDown
          className={["hidden h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 sm:block", open ? "rotate-180" : ""].join(" ")}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          tabIndex={-1}
          aria-label="Account"
          className="menu absolute right-0 top-full z-50 mt-2 w-[17rem] origin-top-right outline-none animate-in fade-in-0 zoom-in-95 duration-150"
          onKeyDown={onMenuKeydown}
        >
          {/* Who this is */}
          <div className="flex items-center gap-3 px-2.5 pb-2.5 pt-2">
            <span className="avatar h-9 w-9 text-xs">{initials}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-[-0.01em] text-foreground">{displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{detail}</p>
            </div>
          </div>
          <Separator />

          <Link to="/profile" role="menuitem" className={itemClass}>
            <Settings className={iconClass} aria-hidden="true" />
            Profile &amp; settings
          </Link>

          {/* The theme in use; the picker itself is the button in the header and the profile's Appearance card */}
          <Link
            to="/profile"
            hash="appearance"
            role="menuitem"
            className={itemClass}
            onClick={() => {
              setOpen(false);
              // Already on the profile with this hash, the router has nothing to scroll to.
              if (path === "/profile") document.getElementById("appearance")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            <Palette className={iconClass} aria-hidden="true" />
            <span className="flex-1">Theme</span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ThemeSwatch name={theme.theme} size="dot" />
              {themeLabel}
            </span>
          </Link>
          <Separator />

          <Link to="/" role="menuitem" className={itemClass}>
            <Info className={iconClass} aria-hidden="true" />
            <span className="flex-1">About klndr.</span>
            <span className="text-xs text-muted-foreground">Homepage</span>
          </Link>
          <Link to="/privacy" role="menuitem" className={itemClass}>
            <ShieldCheck className={iconClass} aria-hidden="true" />
            Privacy policy
          </Link>
          <Link to="/terms" role="menuitem" className={itemClass}>
            <FileText className={iconClass} aria-hidden="true" />
            Terms of use
          </Link>
          <Separator />

          <button type="button" role="menuitem" className={itemClass} onClick={() => void logOut()}>
            <LogOut className={iconClass} aria-hidden="true" />
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}

const Separator = () => <div role="separator" className="-mx-1 my-1 h-px bg-border/80" />;
