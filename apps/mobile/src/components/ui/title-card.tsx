import { View, type TextInputProps } from "react-native";

import { Card } from "./card";
import { EmojiButton } from "./emoji-button";
import { TextField } from "./text-field";

export type TitleCardProps = {
  emoji: string;
  /** What is being named, for the emoji button's accessible name: "Activity emoji". */
  emojiLabel: string;
  onEmojiChange: (emoji: string) => void;
  value: string;
  onChangeText: (text: string) => void;
  /** The grey hint that says what the field is for, as the phone's Calendar says "Title". */
  placeholder: string;
  maxLength: number;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  /** A name that cannot be changed here (a category the activities already use) is drawn as plain text. */
  editable?: boolean;
  onSubmitEditing?: () => void;
};

/**
 * The head of an editor: the emoji and the name it goes with, in one white card, the name a plain field with a
 * grey hint while it is empty — the phone's own way of saying "type here".
 */
export function TitleCard({
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
}: TitleCardProps) {
  return (
    <Card className="flex-row items-center gap-md px-md py-sm">
      <EmojiButton emoji={emoji} label={emojiLabel} onChange={onEmojiChange} size="large" />
      <View className="min-w-0 flex-1">
        <TextField
          appearance="bare"
          autoCapitalize={autoCapitalize}
          editable={editable}
          label="Name"
          maxLength={maxLength}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmitEditing}
          placeholder={placeholder}
          prominent
          returnKeyType="done"
          value={value}
        />
      </View>
    </Card>
  );
}
