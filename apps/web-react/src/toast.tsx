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

/**
 * Where the messages `@klndr/data` produces ("Added Workout", "Could not move that block") go.
 *
 * One message is shown for 2.2 seconds and replaced if another arrives.
 */

const FLASH_MS = 2200;

type ToastContextValue = {
  /** Show a message, replacing whatever is on screen. */
  show(message: string): void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: PropsWithChildren) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const show = useCallback((next: string) => {
    setMessage(next);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setMessage(null);
    }, FLASH_MS);
  }, []);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const value = useMemo<ToastContextValue>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* The live region is always mounted: assistive tech only announces changes to one that already exists. */}
      <div role="status" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        {message ? (
          <div className="pointer-events-auto max-w-md rounded-lg bg-foreground px-4 py-2 text-sm text-background shadow-lg">
            {message}
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside <ToastProvider>");
  return value;
}
