import { THEMES, type ThemeValues } from "@klndr/tokens";
import { useColorScheme } from "react-native";

/** The theme as JavaScript values, for the few native props that take a colour and no class name. */
export function useThemeColors(): ThemeValues {
  return THEMES[useThemeScheme()].values;
}

/** The resolved scheme, for native props that want to know it (a picker's variant, a status bar). */
export function useThemeScheme(): "light" | "dark" {
  return useColorScheme() === "dark" ? "dark" : "light";
}
