import { Card } from "../ui/Card";
import { tr, useLocale } from "../../lib/i18n";
import type { ReactNode } from "react";

const ROAD: Array<{ titleKey: string; bodyKey: string; status: "done" | "now" | "next" | "later" }> = [
  { titleKey: "roadmap.insights.title", bodyKey: "roadmap.insights.body", status: "done" },
  { titleKey: "roadmap.imports.title", bodyKey: "roadmap.imports.body", status: "now" },
  { titleKey: "roadmap.shared.title", bodyKey: "roadmap.shared.body", status: "next" },
  { titleKey: "roadmap.api.title", bodyKey: "roadmap.api.body", status: "later" },
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
