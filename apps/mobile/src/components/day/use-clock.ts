import { nowMinutes, todayISO } from "@klndr/core";
import { useEffect, useState } from "react";
import { AppState } from "react-native";

export type Clock = { nowMinute: number; today: string };

const read = (): Clock => ({ nowMinute: nowMinutes(), today: todayISO() });

/**
 * The time of day, to the minute, and today's date — refreshed every 30 seconds (as the web planner does)
 * and the moment the app comes back to the foreground, so the now-line is right after a long absence and
 * "today" turns over at midnight.
 */
export function useClock(): Clock {
  const [clock, setClock] = useState(read);

  useEffect(() => {
    const tick = () => setClock((previous) => {
      const next = read();
      return next.nowMinute === previous.nowMinute && next.today === previous.today ? previous : next;
    });
    const timer = setInterval(tick, 30_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") tick();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  return clock;
}
