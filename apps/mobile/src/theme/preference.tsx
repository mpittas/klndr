import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { useColorScheme } from "react-native";
import { Uniwind } from "uniwind";

import { storage } from "@/lib/storage";

/**
 * The theme preference: what the user chose, and what that resolves to.
 *
 * Uniwind owns the styling — it switches the CSS variables and the `dark:` variants — and this module
 * owns the *preference*, which Uniwind has no storage for. `system` is the default and means "follow
 * the phone", exactly as the app does before anyone opens Settings.
 */
export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "theme-preference";
const DEFAULT_PREFERENCE: ThemePreference = "system";

function readStoredPreference(): ThemePreference {
  const stored = storage.getString(STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : DEFAULT_PREFERENCE;
}

/**
 * Apply the saved preference. Called once, at the top of the root layout module, before anything is
 * rendered: setting the theme in an effect would paint the first frame in the wrong colours.
 */
export function applyStoredTheme(): void {
  Uniwind.setTheme(readStoredPreference());
}

type ThemePreferenceValue = {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
};

const ThemePreferenceContext = createContext<ThemePreferenceValue | null>(null);

export function ThemePreferenceProvider({ children }: PropsWithChildren) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  // Uniwind reports the preference it was given, so asking the platform is the honest way to resolve
  // "system" — and it keeps the answer in step when the phone switches at sunset.
  const systemScheme = useColorScheme();

  useEffect(() => {
    Uniwind.setTheme(preference);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    storage.set(STORAGE_KEY, next);
    setPreferenceState(next);
  }, []);

  const value = useMemo<ThemePreferenceValue>(
    () => ({
      preference,
      resolved: preference === "system" ? (systemScheme === "dark" ? "dark" : "light") : preference,
      setPreference,
    }),
    [preference, setPreference, systemScheme],
  );

  return <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>;
}

export function useThemePreference(): ThemePreferenceValue {
  const value = useContext(ThemePreferenceContext);
  if (!value) throw new Error("useThemePreference must be used inside <ThemePreferenceProvider>");
  return value;
}
