import { Card } from "../ui/Card";
import type { ReactNode } from "react";

const ROAD: Array<{ title: string; body: string }> = [
  { title: "Deeper insights", body: "More drilldowns and saved report views from your data." },
  { title: "Smarter imports", body: "Bring in more sources with guided mapping and validation." },
  { title: "Shared spaces", body: "Household and advisor views with clear permissions." },
  { title: "API + mobile", body: "First-class API keys and a companion app when you are on the go." },
];

export function Roadmap(): ReactNode {
  return (
    <section className="landing-section" aria-labelledby="roadmap-title">
      <h2 id="roadmap-title">On the roadmap</h2>
      <div className="roadmap-grid">
        {ROAD.map((r) => (
          <Card className="roadmap-card" key={r.title}>
            <h3 className="roadmap-card__title">{r.title}</h3>
            <p>{r.body}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
