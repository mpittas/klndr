import type { InputHTMLAttributes, ReactNode } from "react";

/** The field styling the sign-in, sign-up and profile forms share. */
export const FIELD_CLASS =
  "h-11 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-2xs transition-colors placeholder:text-muted-foreground focus-visible:border-foreground focus-visible:outline-none sm:h-9";

type TextFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  /** Rendered at the other end of the label row, e.g. the "Forgot password?" button. */
  labelAccessory?: ReactNode;
} & Pick<
  InputHTMLAttributes<HTMLInputElement>,
  | "type"
  | "autoComplete"
  | "inputMode"
  | "autoCapitalize"
  | "autoCorrect"
  | "spellCheck"
  | "placeholder"
  | "required"
  | "maxLength"
>;

/**
 * A labelled input in the shape the auth and profile forms use.
 */
export function TextField({ id, label, value, onChange, labelAccessory, ...input }: TextFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="block text-xs font-medium text-foreground sm:text-sm">
          {label}
        </label>
        {labelAccessory}
      </div>
      <input id={id} value={value} onChange={(event) => onChange(event.target.value)} className={FIELD_CLASS} {...input} />
    </div>
  );
}
