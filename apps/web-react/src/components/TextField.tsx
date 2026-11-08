import type { InputHTMLAttributes, ReactNode } from "react";

/** The field styling the sign-in, sign-up and profile forms share. */
export const FIELD_CLASS = "field h-11";

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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="field-label">
          {label}
        </label>
        {labelAccessory}
      </div>
      <input id={id} value={value} onChange={(event) => onChange(event.target.value)} className={FIELD_CLASS} {...input} />
    </div>
  );
}
