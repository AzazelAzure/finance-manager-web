import { useEffect, useState, type ReactNode } from "react";
import { getLocale, setLocale, tr, type AppLocale } from "../../lib/i18n";

const OPTIONS: Array<{ value: AppLocale; code: string; flag: string }> = [
  { value: "en-US", code: "EN", flag: "🇺🇸" },
  { value: "tl-PH", code: "TL", flag: "🇵🇭" },
];

export function LocalePicker(): ReactNode {
  const [v, setV] = useState<AppLocale>(() => getLocale());

  useEffect(() => {
    const onChange = (): void => setV(getLocale());
    window.addEventListener("fm-locale-changed", onChange);
    return () => window.removeEventListener("fm-locale-changed", onChange);
  }, []);

  return (
    <div className="locale-wrap" role="group" aria-label={tr("locale.aria", v)}>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          className={v === o.value ? "locale-chip locale-chip--active" : "locale-chip"}
          onClick={() => {
            setLocale(o.value);
            setV(o.value);
          }}
          aria-pressed={v === o.value}
        >
          <span className="locale-chip__flag" aria-hidden>{o.flag}</span>
          <span className="locale-chip__code">{o.code}</span>
        </button>
      ))}
    </div>
  );
}
