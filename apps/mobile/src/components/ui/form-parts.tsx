import type { ComponentType } from "react";

import { Trash } from "@/icons";
import { useThemeColors } from "@/theme/tokens";
import { Button } from "./button";
import { Card } from "./card";
import { IconTile } from "./icon-tile";
import { ListRow } from "./list-row";
import { SheetFooter } from "./sheet-footer";
import { TextField } from "./text-field";

type IconComponent = ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;

/** A form row's small grey icon tile; the icon takes the foreground colour, or the destructive one. */
export function RowIcon({ icon: Icon, destructive = false }: { icon: IconComponent; destructive?: boolean }) {
  const colors = useThemeColors();
  return (
    <IconTile size={28}>
      <Icon color={destructive ? colors.destructive : colors.foreground} size={15} strokeWidth={2.2} />
    </IconTile>
  );
}

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

/** The red row at the foot of an editor that removes what it edits. */
export function DeleteCard({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Card>
      <ListRow
        chevron={false}
        destructive
        disabled={disabled}
        divider={false}
        label={label}
        leading={<RowIcon destructive icon={Trash} />}
        leadingWidth={28}
        onPress={onPress}
      />
    </Card>
  );
}

/** The pinned bar of every form sheet: Cancel beside the one primary action, and the problem above them. */
export function FormFooter({
  error,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
  submitting = busy,
}: {
  error: string | null;
  /** Something is in flight: Cancel is off. */
  busy: boolean;
  submitLabel: string;
  onSubmit: () => void;
  onCancel: () => void;
  /** The primary button shows its spinner; usually the same as `busy`, but a delete in flight is not a save. */
  submitting?: boolean;
}) {
  return (
    <SheetFooter error={error}>
      <Button className="flex-1" disabled={busy} label="Cancel" onPress={onCancel} size="large" variant="surface" />
      <Button className="flex-[1.6]" label={submitLabel} loading={submitting} onPress={onSubmit} size="large" />
    </SheetFooter>
  );
}
