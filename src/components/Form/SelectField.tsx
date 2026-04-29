import { clsx } from "clsx";
import { useFormContext } from "react-hook-form";
import type { ReactNode } from "react";

type Opt = { value: string; label: string };

type Props = { name: string; label: string; options: Opt[]; id?: string };

export function SelectField({ name, label, options, id: idProp }: Props): ReactNode {
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
      <select
        className="ui-select"
        id={id}
        aria-invalid={message ? "true" : "false"}
        aria-describedby={message ? `${id}-err` : undefined}
        {...register(name)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {message ? (
        <p className="ui-field__error" id={`${id}-err`} role="alert">
          {String(message)}
        </p>
      ) : null}
    </div>
  );
}
