import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

/**
 * The theme: one of ten looks, or "system" (follow the OS light/dark setting, which is what people who never
 * chose get). Kept in `localStorage` and applied to `<html>` as `data-theme="<name>"`; the dark-scheme themes
 * also get `class="dark"`, which every `dark:` utility and the dark category colors read. The variables of each
 * theme are the `[data-theme="…"]` blocks in `styles.css`.
 *
 * The first attributes are set by the inline script in `index.html`, before first paint, so there is no flash of
 * the wrong theme; this provider keeps them in sync afterwards (and follows the OS while on "system").
 */

export type ThemeName =
  | "light"
  | "dark"
  | "lavender"
  | "midnight"
  | "forest"
  | "rose"
  | "sage"
  | "sky"
  | "plum"
  | "graphite";
export type ThemePreference = "system" | ThemeName;

export type ThemeOption = {
  name: ThemeName;
  label: string;
  /** Whether it is a light or a dark look: dark ones carry the `dark` class. */
  scheme: "light" | "dark";
  description: string;
};

/**
 * Keep in step with the scheme map in `index.html` and the blocks in `styles.css`. The order is the order the
 * pickers show them in, within each scheme.
 */
export const THEME_OPTIONS: readonly ThemeOption[] = [
  { name: "light", label: "Light", scheme: "light", description: "Warm paper" },
  { name: "lavender", label: "Lavender", scheme: "light", description: "Soft lilac" },
  { name: "rose", label: "Rose", scheme: "light", description: "Blush and raspberry" },
  { name: "sage", label: "Sage", scheme: "light", description: "Soft green and teal" },
  { name: "sky", label: "Sky", scheme: "light", description: "Cool blue-white" },
  { name: "dark", label: "Dark", scheme: "dark", description: "Warm night" },
  { name: "midnight", label: "Midnight", scheme: "dark", description: "Deep navy" },
  { name: "forest", label: "Forest", scheme: "dark", description: "Pine and honey" },
  { name: "plum", label: "Plum", scheme: "dark", description: "Aubergine and orchid" },
  { name: "graphite", label: "Graphite", scheme: "dark", description: "Neutral charcoal" },
];

/** The themes split by scheme, light first: the pickers show a group for each. */
export const THEME_GROUPS: readonly { scheme: "light" | "dark"; label: string; options: readonly ThemeOption[] }[] = [
  { scheme: "light", label: "Light", options: THEME_OPTIONS.filter((option) => option.scheme === "light") },
  { scheme: "dark", label: "Dark", options: THEME_OPTIONS.filter((option) => option.scheme === "dark") },
];

export const THEME_STORAGE_KEY = "klndr-theme";

const schemeOf = (name: ThemeName) => THEME_OPTIONS.find((option) => option.name === name)?.scheme ?? "light";

const isThemeName = (value: unknown): value is ThemeName =>
  THEME_OPTIONS.some((option) => option.name === value);

const DARK_QUERY = "(prefers-color-scheme: dark)";

const readPreference = (): ThemePreference => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeName(stored)) return stored;
  } catch {
    // Privacy modes can refuse storage; the OS preference still works.
  }
  return "system";
};

/** Sets the attributes on <html> and colors the browser chrome (the address bar on phones) to match. */
const applyTheme = (name: ThemeName) => {
  const root = document.documentElement;
  root.dataset.theme = name;
  root.classList.toggle("dark", schemeOf(name) === "dark");

  const background = getComputedStyle(root).getPropertyValue("--background").trim();
  if (!background) return;
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = background;
  }
};

/**
 * Switches the theme in one step. Each element eases its colours over its own duration, so left alone some
 * would finish well after others. Transitions are switched off for the moment the new colours are applied,
 * so every element changes together.
 */
const switchTheme = (name: ThemeName) => {
  const style = document.createElement("style");
  style.textContent = "*,*::before,*::after{transition:none!important}";
  document.head.append(style);
  applyTheme(name);
  // Reading a layout property makes the browser commit the new colours before the style is removed.
  void document.documentElement.offsetHeight;
  requestAnimationFrame(() => style.remove());
};

type ThemeContextValue = {
  /** What the person chose: a theme, or "system". */
  preference: ThemePreference;
  /** The theme in use: the preference, or the OS's light/dark while the preference is "system". */
  theme: ThemeName;
  setPreference(preference: ThemePreference): void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia(DARK_QUERY).matches);
  const theme: ThemeName = preference === "system" ? (systemDark ? "dark" : "light") : preference;

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      if (next === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // As above: the theme still applies for this visit.
    }
  }, []);

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const onChange = () => setSystemDark(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  // Another tab chose a theme: follow it.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) setPreferenceState(readPreference());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // The first render only adopts what the inline script already put on <html>; later changes switch in one step.
  const applied = useRef(false);
  useLayoutEffect(() => {
    if (applied.current) switchTheme(theme);
    else applyTheme(theme);
    applied.current = true;
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, theme, setPreference }),
    [preference, theme, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside <ThemeProvider>");
  return value;
}
