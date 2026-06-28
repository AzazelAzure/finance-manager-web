import { Card } from "../ui/Card";
import { tr, useLocale } from "../../lib/i18n";
import type { ReactNode } from "react";

const ROAD: Array<{ titleKey: string; bodyKey: string; status: "done" | "now" | "next" | "later" }> = [
  { titleKey: "roadmap.paycycles.title", bodyKey: "roadmap.paycycles.body", status: "done" },
  { titleKey: "roadmap.recurring.title", bodyKey: "roadmap.recurring.body", status: "now" },
  { titleKey: "roadmap.widgets.title", bodyKey: "roadmap.widgets.body", status: "next" },
  { titleKey: "roadmap.predictive.title", bodyKey: "roadmap.predictive.body", status: "later" },
  { titleKey: "roadmap.family.title", bodyKey: "roadmap.family.body", status: "later" },
];

export function Roadmap(): ReactNode {
  const locale = useLocale();
  return (
    <section className="landing-section" aria-labelledby="roadmap-title">
      <h2 id="roadmap-title">{tr("roadmap.title", locale)}</h2>
      <div className="roadmap-timeline">
        {ROAD.map((r) => (
          <div className={`roadmap-item roadmap-item--${r.status}`} key={r.titleKey}>
            <div className="roadmap-item__marker" aria-hidden></div>
            <Card className="roadmap-card">
              <span className="roadmap-card__badge">{r.status.toUpperCase()}</span>
              <h3 className="roadmap-card__title">{tr(r.titleKey, locale)}</h3>
              <p>{tr(r.bodyKey, locale)}</p>
            </Card>
          </div>
        ))}
      </div>
    </section>
  );
}
