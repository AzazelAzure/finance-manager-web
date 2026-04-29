import { clsx } from "clsx";
import { useState, type ReactNode } from "react";
import { useFormContext } from "react-hook-form";

type Props = {
  name: string;
  label: string;
  type?: "text" | "password" | "email" | "search" | "url";
  autoComplete?: string;
  id?: string;
  /**
   * Starts `readOnly` and clears on first focus. Helps prevent aggressive
   * autofill of saved passwords before the user interacts (Chrome, Edge).
   */
  unlockOnFocus?: boolean;
};

export function TextField({
  name,
  label,
  type = "text",
  autoComplete,
  id: idProp,
  unlockOnFocus = false,
}: Props): ReactNode {
  const {
    register,
    formState: { errors },
  } = useFormContext();
  const [locked, setLocked] = useState(unlockOnFocus);
  const err = errors[name];
  const message = err?.message;
  const id = idProp ?? name;
  const reg = register(name);
  return (
    <div className={clsx("ui-field", message && "ui-field--error")}>
      <label className="ui-label" htmlFor={id}>
        {label}
      </label>
      <input
        className="ui-input"
        id={id}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={message ? "true" : "false"}
        aria-describedby={message ? `${id}-err` : undefined}
        {...reg}
        readOnly={unlockOnFocus && locked}
        onFocus={() => {
          if (unlockOnFocus && locked) {
            setLocked(false);
          }
        }}
      />
      {message ? (
        <p className="ui-field__error" id={`${id}-err`} role="alert">
          {String(message)}
        </p>
      ) : null}
    </div>
  );
}
