import { Card } from "../ui/Card";
import { tr, useLocale } from "../../lib/i18n";
import type { ReactNode } from "react";

const ROAD: Array<{ titleKey: string; bodyKey: string }> = [
  { titleKey: "roadmap.insights.title", bodyKey: "roadmap.insights.body" },
  { titleKey: "roadmap.imports.title", bodyKey: "roadmap.imports.body" },
  { titleKey: "roadmap.shared.title", bodyKey: "roadmap.shared.body" },
  { titleKey: "roadmap.api.title", bodyKey: "roadmap.api.body" },
];

export function Roadmap(): ReactNode {
  const locale = useLocale();
  return (
    <section className="landing-section" aria-labelledby="roadmap-title">
      <h2 id="roadmap-title">{tr("roadmap.title", locale)}</h2>
      <div className="roadmap-grid">
        {ROAD.map((r) => (
          <Card className="roadmap-card" key={r.titleKey}>
            <h3 className="roadmap-card__title">{tr(r.titleKey, locale)}</h3>
            <p>{tr(r.bodyKey, locale)}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
