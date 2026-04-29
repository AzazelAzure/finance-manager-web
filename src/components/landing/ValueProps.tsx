import { Card } from "../ui/Card";
import { tr, useLocale } from "../../lib/i18n";
import type { ReactNode } from "react";

const PROPS: Array<{ titleKey: string; textKey: string }> = [
  { titleKey: "value.clarity.title", textKey: "value.clarity.body" },
  { titleKey: "value.bills.title", textKey: "value.bills.body" },
  { titleKey: "value.data.title", textKey: "value.data.body" },
  { titleKey: "value.daily.title", textKey: "value.daily.body" },
];

export function ValueProps(): ReactNode {
  const locale = useLocale();
  return (
    <section className="landing-section" aria-labelledby="value-props-title">
      <h2 id="value-props-title">{tr("value.title", locale)}</h2>
      <div className="value-props">
        {PROPS.map((p) => (
          <Card className="value-prop" key={p.titleKey}>
            <h3>{tr(p.titleKey, locale)}</h3>
            <p>{tr(p.textKey, locale)}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
