import { useEffect, useState, type ReactNode } from "react";
import { getLocale, setLocale, type AppLocale } from "../../lib/i18n";

const OPTIONS: Array<{ value: AppLocale; label: string }> = [
  { value: "en-US", label: "English" },
  { value: "tl-PH", label: "Tagalog" },
];

export function LocalePicker(): ReactNode {
  const [v, setV] = useState<AppLocale>(() => getLocale());

  useEffect(() => {
    const onChange = (): void => setV(getLocale());
    window.addEventListener("fm-locale-changed", onChange);
    return () => window.removeEventListener("fm-locale-changed", onChange);
  }, []);

  return (
    <label className="locale-wrap">
      <span className="sr-only">Language</span>
      <select
        className="ui-select"
        value={v}
        onChange={(e) => {
          const n = e.target.value as AppLocale;
          setLocale(n);
          setV(n);
        }}
        style={{ minWidth: "6rem" }}
        aria-label="Interface language (stub: English only copy this sweep)"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
