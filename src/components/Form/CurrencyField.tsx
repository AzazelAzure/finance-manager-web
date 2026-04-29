import { clsx } from "clsx";
import { useFormContext, useWatch } from "react-hook-form";
import type { ReactNode } from "react";

type Props = {
  amountName: string;
  currencyName: string;
  label: string;
  currencies?: string[];
  id?: string;
};

const DEFAULT_CURRENCIES = ["USD", "EUR", "GBP", "CHF", "JPY", "CNY", "INR", "BRL", "MXN", "SEK", "NOK", "DKK", "PLN", "CAD", "AUD", "NZD", "SGD", "TRY", "ZAR", "AED"] as const;

export function CurrencyField({
  amountName,
  currencyName,
  label,
  currencies = [...DEFAULT_CURRENCIES].slice(0, 20),
  id: idBase,
}: Props): ReactNode {
  const {
    register,
    formState: { errors },
  } = useFormContext();
  const amountErr = errors[amountName];
  const curErr = errors[currencyName];
  const message = (amountErr?.message ?? curErr?.message) as string | undefined;
  const idAmt = idBase ? `${idBase}-amt` : `${amountName}-field`;
  const idCur = idBase ? `${idBase}-ccy` : `${currencyName}-field`;

  useWatch({ name: amountName });
  useWatch({ name: currencyName });

  return (
    <fieldset
      className={clsx("ui-field", message && "ui-field--error")}
      style={{ border: 0, padding: 0, margin: 0 }}
    >
      <legend className="ui-label" style={{ width: "100%" }}>
        {label}
      </legend>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <input
          className="ui-input"
          type="number"
          step="0.01"
          id={idAmt}
          aria-label={`${label} amount`}
          aria-invalid={message ? "true" : "false"}
          {...register(amountName)}
        />
        <select
          className="ui-select"
          id={idCur}
          style={{ minWidth: "5rem" }}
          aria-label={`${label} currency`}
          {...register(currencyName)}
        >
          {currencies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      {message ? (
        <p className="ui-field__error" role="alert">
          {String(message)}
        </p>
      ) : null}
    </fieldset>
  );
}
