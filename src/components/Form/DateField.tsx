import { clsx } from "clsx";
import { useFormContext } from "react-hook-form";
import type { ReactNode } from "react";

type Props = { name: string; label: string; id?: string };

export function DateField({ name, label, id: idProp }: Props): ReactNode {
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
        type="date"
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
