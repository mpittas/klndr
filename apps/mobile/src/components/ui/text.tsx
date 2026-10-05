import { TYPE_SCALE, type TypeScaleName } from "@klndr/tokens";
import { Text as RNText, type TextProps as RNTextProps } from "react-native";

import { FONT_FOR_WEIGHT } from "@/fonts";

/**
 * The class each scale entry maps to, from the stylesheet generated out of `@klndr/tokens`. Written
 * out rather than built from the name: Tailwind finds class names by reading the source, so a
 * template string would produce a utility that was never generated.
 */
const VARIANT_CLASS: Record<TypeScaleName, string> = {
  display: "text-display",
  title: "text-title",
  body: "text-body",
  caption: "text-caption",
  micro: "text-micro",
  nano: "text-nano",
};

/** The theme colour a piece of text uses; `inherit` leaves it to the parent. */
export type TextTone =
  | "foreground"
  | "muted"
  | "primary-foreground"
  | "destructive"
  | "destructive-foreground"
  | "inherit";

const TONE_CLASS: Record<TextTone, string> = {
  foreground: "text-foreground",
  muted: "text-muted-foreground",
  "primary-foreground": "text-primary-foreground",
  destructive: "text-destructive",
  "destructive-foreground": "text-destructive-foreground",
  inherit: "",
};

export type TextProps = RNTextProps & {
  /** A step of DESIGN.md's type scale. */
  variant?: TypeScaleName;
  tone?: TextTone;
  /** Tabular numerals, for every clock time and duration (DESIGN.md). */
  numeric?: boolean;
  className?: string;
};

/**
 * All text in the app goes through here, so the scale and the font are stated once. Size, line height
 * and tracking come from the stylesheet; the family comes from the weight, because React Native needs
 * one exact family name per weight.
 */
export function Text({
  variant = "body",
  tone = "inherit",
  numeric = false,
  className,
  style,
  ...rest
}: TextProps) {
  return (
    <RNText
      className={[VARIANT_CLASS[variant], TONE_CLASS[tone], className].filter(Boolean).join(" ")}
      style={[
        { fontFamily: FONT_FOR_WEIGHT[TYPE_SCALE[variant].weight] },
        numeric ? { fontVariant: ["tabular-nums"] } : null,
        style,
      ]}
      {...rest}
    />
  );
}
