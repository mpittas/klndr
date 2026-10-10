import { Pressable } from "react-native";

import { useThemeColors } from "@/theme/tokens";
import { Card } from "./card";
import { Text } from "./text";
import { TextField } from "./text-field";

/** A card holding one multi-line field: the notes of a block or an activity. */
export function NotesCard({
  value,
  onChangeText,
  maxLength,
  placeholder,
}: {
  value: string;
  onChangeText: (text: string) => void;
  maxLength: number;
  placeholder: string;
}) {
  return (
    <Card className="px-md">
      <TextField
        appearance="bare"
        autoCapitalize="sentences"
        label="Notes"
        maxLength={maxLength}
        multiline
        onChangeText={onChangeText}
        placeholder={placeholder}
        value={value}
      />
    </Card>
  );
}

/** The red line at the foot of an editor that removes what it edits: its own card, the label centred. */
export function DeleteCard({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const colors = useThemeColors();
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled === true }}
        className="items-center justify-center"
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => ({ minHeight: 56, opacity: disabled ? 0.5 : 1, backgroundColor: pressed ? colors.muted : undefined })}
      >
        <Text tone="destructive" variant="row">
          {label}
        </Text>
      </Pressable>
    </Card>
  );
}
