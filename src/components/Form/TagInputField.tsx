import { clsx } from "clsx";
import { useFormContext } from "react-hook-form";
import type { ReactNode } from "react";

type Props = { name: string; label: string; placeholder?: string; id?: string };

/**
 * Comma- or space-separated free tags for forms (advanced UX in later tasks).
 */
export function TagInputField({ name, label, placeholder, id: idProp }: Props): ReactNode {
  const {
    register,
    formState: { errors },
  } = useFormContext();
  const err = errors[name];
  const message = err?.message;
  const id = idProp ?? name;
  return (
    <div className={clsx("ui-field", message && "ui-field--error")}>
      <label className="ui-label" htmlFor={id}>
        {label}
      </label>
      <input
        className="ui-input"
        id={id}
        type="text"
        placeholder={placeholder}
        autoComplete="off"
        aria-invalid={message ? "true" : "false"}
        aria-describedby={message ? `${id}-err` : undefined}
        {...register(name)}
      />
      {message ? (
        <p className="ui-field__error" id={`${id}-err`} role="alert">
          {String(message)}
        </p>
      ) : null}
    </div>
  );
}
