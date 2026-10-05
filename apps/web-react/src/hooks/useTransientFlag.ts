import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A flag that switches on and turns itself off again after `ms` ("Saved", "Email sent"). Flashing it
 * again restarts the countdown, and nothing fires after the component is gone.
 */
export function useTransientFlag(ms: number) {
  const [on, setOn] = useState(false);
  const timer = useRef<number | null>(null);

  const clearTimer = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => clearTimer, []);

  const flash = useCallback(() => {
    setOn(true);
    clearTimer();
    timer.current = window.setTimeout(() => setOn(false), ms);
  }, [ms]);

  const clear = useCallback(() => {
    clearTimer();
    setOn(false);
  }, []);

  return { on, flash, clear };
}
