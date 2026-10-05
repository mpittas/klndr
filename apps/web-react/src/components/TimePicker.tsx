import { fromTimeInput, SNAP_MINUTES, timeInputValue } from "@klndr/core";

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = Array.from({ length: 60 / SNAP_MINUTES }, (_, i) => i * SNAP_MINUTES);

/**
 * A time of day as three short dropdowns, hour, minute and AM/PM, where the minutes step by a quarter hour:
 * the grid blocks move and resize on in the timeline. (A native time field would let any minute be typed.)
 *
 * `value` and `onChange` use the `HH:MM` text of a time input (see `timeInputValue`). A block saved earlier
 * at a time between steps keeps showing that minute until another is picked.
 */
export function TimePicker({
  value,
  onChange,
  labelledBy,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  /** The id of the text that names this field. */
  labelledBy: string;
  /** Classes for each dropdown. */
  className: string;
}) {
  const total = fromTimeInput(value);
  const hour24 = Math.floor(total / 60) % 24;
  const minute = total % 60;
  const pm = hour24 >= 12;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  const minutes = MINUTES.includes(minute) ? MINUTES : [...MINUTES, minute].sort((a, b) => a - b);
  const change = (hour: number, min: number, toPm: boolean) => onChange(timeInputValue(((hour % 12) + (toPm ? 12 : 0)) * 60 + min));

  return (
    <div role="group" aria-labelledby={labelledBy} className="flex items-center gap-1">
      <select
        aria-label="Hour"
        value={hour12}
        className={`${className} flex-[0.8]`}
        onChange={(event) => change(Number(event.target.value), minute, pm)}
      >
        {HOURS.map((hour) => (
          <option key={hour} value={hour}>
            {hour}
          </option>
        ))}
      </select>
      <span aria-hidden="true" className="text-sm font-medium text-muted-foreground">
        :
      </span>
      <select
        aria-label="Minute"
        value={minute}
        className={`${className} flex-[1.05]`}
        onChange={(event) => change(hour12, Number(event.target.value), pm)}
      >
        {minutes.map((min) => (
          <option key={min} value={min}>
            {String(min).padStart(2, "0")}
          </option>
        ))}
      </select>
      <select
        aria-label="AM or PM"
        value={pm ? "PM" : "AM"}
        className={`${className} flex-[1.25]`}
        onChange={(event) => change(hour12, minute, event.target.value === "PM")}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}
