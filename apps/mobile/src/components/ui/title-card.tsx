import { useRef } from "react";
import { Pressable, View, type TextInput, type TextInputProps } from "react-native";

import { Pencil } from "@/icons";
import { useThemeColors } from "@/theme/tokens";
import { Card } from "./card";
import { EmojiButton } from "./emoji-button";
import { TextField } from "./text-field";
import { Text } from "./text";

export type TitleCardProps = {
  emoji: string;
  /** What is being named, for the emoji button's accessible name: "Activity emoji". */
  emojiLabel: string;
  onEmojiChange: (emoji: string) => void;
  value: string;
  onChangeText: (text: string) => void;
  /** What the field is called, in small type above what is typed: "Title", "Name". */
  label?: string;
  /** The grey hint inside the field while it is empty: an invitation to type, not a repeat of the label. */
  placeholder: string;
  maxLength: number;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  /** A name that cannot be changed here (a category the activities already use) is drawn as plain text. */
  editable?: boolean;
  onSubmitEditing?: () => void;
};

/**
 * The head of an editor: the emoji and the name it goes with, in one white card. The name says it can be typed
 * in three ways at once: a small label above it, a pencil at its end, and the whole row focusing the field when
 * it is tapped, so no part of the card is a dead spot.
 */
export function TitleCard({
  emoji,
  emojiLabel,
  onEmojiChange,
  value,
  onChangeText,
  label = "Title",
  placeholder,
  maxLength,
  autoCapitalize = "sentences",
  editable = true,
  onSubmitEditing,
}: TitleCardProps) {
  const colors = useThemeColors();
  const input = useRef<TextInput>(null);

  return (
    <Card className="flex-row items-center gap-md px-md py-sm">
      <EmojiButton emoji={emoji} label={emojiLabel} onChange={onEmojiChange} size="large" />
      <Pressable
        accessible={false}
        className="min-w-0 flex-1 flex-row items-center gap-sm"
        disabled={!editable}
        onPress={() => input.current?.focus()}
      >
        <View className="min-w-0 flex-1">
          <Text tone="muted" variant="caption" weight={600}>
            {label}
          </Text>
          <TextField
            appearance="bare"
            autoCapitalize={autoCapitalize}
            editable={editable}
            inputRef={input}
            label={label}
            maxLength={maxLength}
            onChangeText={onChangeText}
            onSubmitEditing={onSubmitEditing}
            placeholder={placeholder}
            prominent
            returnKeyType="done"
            value={value}
          />
        </View>
        {editable ? <Pencil color={colors["muted-foreground"]} size={18} strokeWidth={2} /> : null}
      </Pressable>
    </Card>
  );
}
