import { TYPE_SCALE, type TypeScaleName } from "@klndr/tokens";
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from "react-native";

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

/**
 * The phone's own steps, between and above the shared scale: a screen's large title, a row's headline and the
 * 15-point text lists and forms read best at. The shared scale was drawn for a desktop; at arm's length a
 * 14-point list row is a squint, which is why iOS's own lists sit at 15 to 17.
 */
type PhoneVariant = "largeTitle" | "headline" | "callout";

const PHONE_STYLE: Record<PhoneVariant, TextStyle & { weight: 400 | 500 | 600 | 700 }> = {
  largeTitle: { fontSize: 32, lineHeight: 38, letterSpacing: -0.8, weight: 700 },
  headline: { fontSize: 17, lineHeight: 22, letterSpacing: -0.25, weight: 600 },
  callout: { fontSize: 15, lineHeight: 20, letterSpacing: -0.1, weight: 400 },
};

/**
 * The theme colour a piece of text uses. `foreground` is the default: React Native has no colour to inherit at the
 * top of a text, so without one it is black, whatever the theme. `inherit` leaves it to an enclosing text.
 */
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
  /** A step of DESIGN.md's type scale, or one of the phone's own steps. */
  variant?: TypeScaleName | PhoneVariant;
  tone?: TextTone;
  /** Tabular numerals, for every clock time and duration (DESIGN.md). */
  numeric?: boolean;
  /** A heavier face than the step's own, for emphasis inside a row. */
  weight?: 400 | 500 | 600 | 700;
  className?: string;
};

const isPhoneVariant = (variant: string): variant is PhoneVariant => variant in PHONE_STYLE;

/**
 * All text in the app goes through here, so the scale and the font are stated once. Size, line height
 * and tracking come from the stylesheet (or the phone steps above); the family comes from the weight,
 * because React Native needs one exact family name per weight.
 */
export function Text({
  variant = "body",
  tone = "foreground",
  numeric = false,
  weight,
  className,
  style,
  ...rest
}: TextProps) {
  const phone = isPhoneVariant(variant) ? PHONE_STYLE[variant] : null;
  const face = weight ?? (phone ? phone.weight : TYPE_SCALE[variant as TypeScaleName].weight);

  return (
    <RNText
      className={[phone ? "" : VARIANT_CLASS[variant as TypeScaleName], TONE_CLASS[tone], className].filter(Boolean).join(" ")}
      style={[
        phone ? { fontSize: phone.fontSize, lineHeight: phone.lineHeight, letterSpacing: phone.letterSpacing } : null,
        { fontFamily: FONT_FOR_WEIGHT[face] },
        numeric ? { fontVariant: ["tabular-nums"] } : null,
        style,
      ]}
      {...rest}
    />
  );
}
