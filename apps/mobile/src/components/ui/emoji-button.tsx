import { useRouter } from "expo-router";
import { Pressable } from "react-native";

import { askForEmoji } from "@/lib/emoji";
import { MIN_TOUCH_TARGET } from "./targets";
import { Text } from "./text";

export type EmojiButtonProps = {
  emoji: string;
  /** Called with the emoji picked in the picker sheet this button opens. */
  onChange: (emoji: string) => void;
  /** What is being given an emoji, for the accessible name: "Emoji, 🏃" is not as good as "Activity emoji, 🏃". */
  label?: string;
  /** `large` is the emoji at the head of a sheet, beside the name it goes with. */
  size?: "regular" | "large";
};

/**
 * The square that shows an emoji and opens the picker to change it. The picker is a sheet of its own, and a
 * route cannot return a value, so the choice comes back through `askForEmoji` (see `lib/emoji.ts`).
 */
export function EmojiButton({ emoji, onChange, label = "Emoji", size = "regular" }: EmojiButtonProps) {
  const router = useRouter();
  const side = size === "large" ? 56 : MIN_TOUCH_TARGET;

  return (
    <Pressable
      accessibilityHint="Opens the emoji picker"
      accessibilityLabel={`${label}, ${emoji || "none"}`}
      accessibilityRole="button"
      className="items-center justify-center rounded-lg bg-muted"
      onPress={() => {
        askForEmoji(onChange);
        router.push("/emoji-sheet");
      }}
      style={({ pressed }) => ({ width: side, height: side, opacity: pressed ? 0.7 : 1 })}
    >
      <Text style={{ fontSize: size === "large" ? 30 : 22, lineHeight: size === "large" ? 38 : 28 }}>{emoji || "＋"}</Text>
    </Pressable>
  );
}
