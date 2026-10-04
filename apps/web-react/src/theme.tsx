import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

/**
 * The light/dark preference, kept in `localStorage` and applied to `<html class="dark">`, which the
 * tokens' CSS variables and every `dark:` utility read.
 *
 * The first class is set by the inline script in `index.html`, before first paint, so there is no flash
 * of the wrong theme; this provider keeps it in sync afterwards (and follows the OS while on "system").
 */

export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "klndr-theme";

const prefersDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

const applyTheme = (preference: ThemePreference) => {
  const dark = preference === "dark" || (preference === "system" && prefersDark());
  document.documentElement.classList.toggle("dark", dark);
};

const readPreference = (): ThemePreference => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Privacy modes can refuse storage; the OS preference still works.
  }
  return "system";
};

type ThemeContextValue = {
  preference: ThemePreference;
  setPreference(preference: ThemePreference): void;
  toggle(): void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      if (next === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // As above: the theme still applies for this visit.
    }
    applyTheme(next);
  }, []);

  const toggle = useCallback(() => {
    setPreference(document.documentElement.classList.contains("dark") ? "light" : "dark");
  }, [setPreference]);

  useEffect(() => {
    applyTheme(preference);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (preference === "system") applyTheme("system");
    };
    media.addEventListener("change", onSystemChange);
    return () => media.removeEventListener("change", onSystemChange);
  }, [preference]);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, setPreference, toggle }),
    [preference, setPreference, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside <ThemeProvider>");
  return value;
}
