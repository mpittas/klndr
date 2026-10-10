import { TextInput, View, type TextInputProps } from "react-native";

import { Search } from "@/icons";
import { useThemeColors } from "@/theme/tokens";

export type SearchFieldProps = Omit<TextInputProps, "style"> & {
  /** What is searched, for the accessible name: "Search activities". */
  label: string;
  /** `card` on the canvas, `muted` on a white surface. */
  surface?: "card" | "muted";
  className?: string;
};

/** A search box, the phone's own shape: a filled, borderless field with a magnifier and its clear button. */
export function SearchField({ label, surface = "card", className, ...rest }: SearchFieldProps) {
  const colors = useThemeColors();

  return (
    <View
      className={["flex-row items-center gap-sm rounded-md px-sm", surface === "card" ? "bg-card" : "bg-muted", className]
        .filter(Boolean)
        .join(" ")}
      style={{ minHeight: 40 }}
    >
      <Search color={colors["muted-foreground"]} size={17} />
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        className="flex-1 text-foreground"
        clearButtonMode="while-editing"
        placeholderTextColor={colors["muted-foreground"]}
        returnKeyType="search"
        // 16 points: DESIGN.md keeps fields at 16 on touch, or iOS zooms in on focus.
        style={{ fontSize: 16, minHeight: 40, paddingVertical: 0 }}
        {...rest}
      />
    </View>
  );
}
