import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { AccessibilityInfo, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "./button";
import { Text } from "./text";

/**
 * A toast, with an undo.
 *
 * The app's destructive actions do not ask first and then act: they act, and offer the way back for a
 * few seconds (deleting a block, skipping a checklist item). `actionLabel` defaults to "Undo" because
 * that is what it almost always is.
 */
export type ToastOptions = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** How long the toast stays, in milliseconds. */
  duration?: number;
};

type Toast = ToastOptions & { id: number };

type ToastContextValue = {
  show: (options: ToastOptions) => void;
  hide: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 6000;

export function ToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<Toast | null>(null);
  const insets = useSafeAreaInsets();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  const show = useCallback(
    (options: ToastOptions) => {
      if (timer.current) clearTimeout(timer.current);
      const id = Date.now();
      setToast({ ...options, id });
      // A toast can appear without the user doing anything (a failure), so say it out loud.
      AccessibilityInfo.announceForAccessibility(options.message);
      timer.current = setTimeout(() => setToast(null), options.duration ?? DEFAULT_DURATION);
    },
    [],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ hide, show }), [hide, show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        // It appears and disappears without moving: nothing to reduce, and nothing to wait for.
        <View
          accessibilityLiveRegion="polite"
          className="mx-md rounded-lg border border-border bg-popover px-md py-sm"
          pointerEvents="box-none"
          style={{ bottom: insets.bottom + 12, left: 0, position: "absolute", right: 0 }}
        >
          <View className="flex-row items-center justify-between gap-md">
            <Text className="flex-1" tone="foreground">
              {toast.message}
            </Text>
            {toast.onAction ? (
              <Button
                label={toast.actionLabel ?? "Undo"}
                onPress={() => {
                  toast.onAction?.();
                  hide();
                }}
                variant="ghost"
              />
            ) : null}
          </View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside <ToastProvider>");
  return value;
}
