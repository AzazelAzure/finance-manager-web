import { clsx } from "clsx";
import { useFormContext } from "react-hook-form";
import type { ReactNode } from "react";

type Props = { name: string; label: string; id?: string };

export function CheckboxField({ name, label, id: idProp }: Props): ReactNode {
  const {
    register,
    formState: { errors },
  } = useFormContext();
  const err = errors[name];
  const message = err?.message;
  const id = idProp ?? name;
  return (
    <div className={clsx("ui-field", "ui-field--row", message && "ui-field--error")} style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
      <input className="ui-check" type="checkbox" id={id} aria-invalid={message ? "true" : "false"} {...register(name)} />
      <label className="ui-label" htmlFor={id} style={{ margin: 0 }}>
        {label}
      </label>
      {message ? (
        <p className="ui-field__error" id={`${id}-err`} role="alert">
          {String(message)}
        </p>
      ) : null}
    </div>
  );
}
