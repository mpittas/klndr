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
import { AccessibilityInfo, Pressable, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
const NOTE_DURATION = 3200;

/**
 * The toast drops in at the top of the screen, as the phone's own banners do. At the bottom it would sit on
 * the tab bar, and a sheet (which covers the bottom of the screen) would hide it; the top stays in view above
 * a sheet.
 */
export function ToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<Toast | null>(null);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  const show = useCallback((options: ToastOptions) => {
    if (timer.current) clearTimeout(timer.current);
    const id = Date.now();
    setToast({ ...options, id });
    // A toast can appear without the user doing anything (a failure), so say it out loud.
    AccessibilityInfo.announceForAccessibility(options.message);
    // A message alone is read at a glance; one with an undo stays long enough to reach for it.
    timer.current = setTimeout(() => setToast(null), options.duration ?? (options.onAction ? DEFAULT_DURATION : NOTE_DURATION));
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const value = useMemo<ToastContextValue>(() => ({ hide, show }), [hide, show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, top: insets.top + 6, alignItems: "center" }}>
          <Animated.View
            accessibilityLiveRegion="polite"
            className="flex-row items-center gap-sm rounded-full bg-primary"
            entering={reducedMotion ? undefined : FadeInUp.duration(220)}
            exiting={reducedMotion ? undefined : FadeOutUp.duration(160)}
            key={toast.id}
            style={{
              maxWidth: "92%",
              minHeight: 44,
              paddingLeft: 18,
              paddingRight: toast.onAction ? 6 : 18,
              shadowColor: "#000",
              shadowOpacity: 0.18,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 6 },
              elevation: 8,
            }}
          >
            <Pressable accessibilityHint="Dismisses the message" className="shrink py-sm" onPress={hide}>
              <Text tone="primary-foreground" variant="callout" weight={500}>
                {toast.message}
              </Text>
            </Pressable>
            {toast.onAction ? (
              <Pressable
                accessibilityLabel={toast.actionLabel ?? "Undo"}
                accessibilityRole="button"
                className="items-center justify-center rounded-full px-md"
                onPress={() => {
                  toast.onAction?.();
                  hide();
                }}
                style={({ pressed }) => ({ minHeight: 34, backgroundColor: "rgba(127,127,127,0.28)", opacity: pressed ? 0.7 : 1 })}
              >
                <Text tone="primary-foreground" variant="caption" weight={700}>
                  {toast.actionLabel ?? "Undo"}
                </Text>
              </Pressable>
            ) : null}
          </Animated.View>
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
