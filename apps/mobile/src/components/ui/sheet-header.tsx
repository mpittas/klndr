import { ActivityIndicator, View } from "react-native";

import { Check, X } from "@/icons";
import { useThemeColors } from "@/theme/tokens";
import { CircleButton } from "./circle-button";
import { Text } from "./text";

export type SheetHeaderProps = {
  title: string;
  /** A quieter line under the title: the day, the time, what the sheet is about. */
  subtitle?: string;
  /** Closes the sheet; the system's swipe-down does the same. */
  onClose?: () => void;
  /** The sheet's one action (Save, Add): a filled disc at the header's end, the way the phone's Calendar has it. */
  onConfirm?: () => void;
  /** What the confirm disc says to assistive tech: "Save changes", "Add block". */
  confirmLabel?: string;
  /** Not yet possible (nothing to save): the disc is drawn grey and does nothing. */
  confirmDisabled?: boolean;
  /** Saving: a spinner in the disc. */
  confirmLoading?: boolean;
};

const DISC = 44;

/**
 * The top of every sheet, laid out as the phone's own Calendar sheet is: a white disc with a cross to close at one
 * end, the title centred between, and the sheet's one action as a disc at the other end (filled once it can be
 * used). A sheet with nothing to confirm leaves that end empty, so the title stays centred.
 */
export function SheetHeader({
  title,
  subtitle,
  onClose,
  onConfirm,
  confirmLabel = "Save",
  confirmDisabled = false,
  confirmLoading = false,
}: SheetHeaderProps) {
  const colors = useThemeColors();
  const ready = !confirmDisabled;

  return (
    // Room above for the system's grabber.
    <View className="flex-row items-center px-md pb-sm" style={{ paddingTop: 16, gap: 12 }}>
      <View style={{ width: DISC }}>
        {onClose ? (
          <CircleButton label="Close" onPress={onClose} size={DISC} variant="card">
            <X color={colors.foreground} size={22} strokeWidth={2.2} />
          </CircleButton>
        ) : null}
      </View>

      <View className="min-w-0 flex-1 items-center">
        <Text accessibilityRole="header" numberOfLines={1} variant="headline">
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} numeric tone="muted" variant="caption">
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={{ width: DISC }}>
        {onConfirm ? (
          <CircleButton
            disabled={confirmDisabled}
            label={confirmLabel}
            onPress={onConfirm}
            size={DISC}
            variant={ready ? "primary" : "muted"}
          >
            {confirmLoading ? (
              <ActivityIndicator color={colors["primary-foreground"]} />
            ) : (
              <Check color={ready ? colors["primary-foreground"] : colors["muted-foreground"]} size={24} strokeWidth={2.6} />
            )}
          </CircleButton>
        ) : null}
      </View>
    </View>
  );
}
