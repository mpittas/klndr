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
 * Where the messages `@dayro/data` produces ("Added Workout", "Could not move that block") go.
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
      <div role="status" className="pointer-events-none fixed inset-x-0 bottom-[max(1.5rem,calc(env(safe-area-inset-bottom)+5rem))] z-[80] flex justify-center px-4 sm:bottom-8">
        {message ? (
          <div className="pointer-events-auto max-w-md rounded-full bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground shadow-xl animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
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
