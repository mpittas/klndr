import { useRef, useState } from "react";
import { Pressable, View, type TextInput, type TextInputProps } from "react-native";

import { Pencil } from "@/icons";
import { useThemeColors } from "@/theme/tokens";
import { Card } from "./card";
import { EmojiButton } from "./emoji-button";
import { Text } from "./text";
import { TextField } from "./text-field";

export type NameCardProps = {
  emoji: string;
  /** What is being named, for the emoji button's accessible name: "Activity emoji". */
  emojiLabel: string;
  onEmojiChange: (emoji: string) => void;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  maxLength: number;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  /** A name that cannot be changed here (a category the activities already use) is drawn as plain text. */
  editable?: boolean;
  onSubmitEditing?: () => void;
};

/**
 * The head of an editor: the emoji and the name it goes with. The name sits in a grey well under a small
 * "Name" label with a pencil at its end, so it reads as a field before anyone touches it, and the well takes
 * the accent ring while it has focus. The whole well is the target, not only the text.
 */
export function NameCard({
  emoji,
  emojiLabel,
  onEmojiChange,
  value,
  onChangeText,
  placeholder,
  maxLength,
  autoCapitalize = "sentences",
  editable = true,
  onSubmitEditing,
}: NameCardProps) {
  const colors = useThemeColors();
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  return (
    <Card className="flex-row items-center gap-md p-md">
      <EmojiButton emoji={emoji} label={emojiLabel} onChange={onEmojiChange} size="large" />
      <View className="min-w-0 flex-1 gap-xs">
        <Text tone="muted" variant="caption" weight={600}>
          Name
        </Text>
        <Pressable
          accessible={false}
          className="flex-row items-center gap-sm rounded-md bg-muted px-md"
          disabled={!editable}
          onPress={() => input.current?.focus()}
          style={{ borderWidth: 1.5, borderColor: focused ? colors.ring : "transparent" }}
        >
          <TextField
            appearance="bare"
            autoCapitalize={autoCapitalize}
            className="min-w-0 flex-1"
            editable={editable}
            inputRef={input}
            label="Name"
            maxLength={maxLength}
            onBlur={() => setFocused(false)}
            onChangeText={onChangeText}
            onFocus={() => setFocused(true)}
            onSubmitEditing={onSubmitEditing}
            placeholder={placeholder}
            prominent
            returnKeyType="done"
            value={value}
          />
          {editable ? (
            <View importantForAccessibility="no-hide-descendants" pointerEvents="none">
              <Pencil color={focused ? colors.ring : colors["muted-foreground"]} size={16} strokeWidth={2.2} />
            </View>
          ) : null}
        </Pressable>
      </View>
    </Card>
  );
}
