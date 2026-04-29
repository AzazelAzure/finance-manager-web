import { useSearchParams } from "react-router-dom";
import { Card } from "../components/ui/Card";
import type { ReactNode } from "react";

type Props = { title: string; blurb: string; showDashboardDrillHint?: boolean };

export function PhasePlaceholderPage({ title, blurb, showDashboardDrillHint }: Props): ReactNode {
  const [sp] = useSearchParams();
  const fromDash = showDashboardDrillHint && sp.get("fromDashboard") === "1";
  const category = sp.get("category");
  const tag = sp.get("tag_name");
  const untagged = sp.get("untagged");
  return (
    <div className="stack">
      <h2 className="muted" style={{ margin: 0, fontSize: "var(--font-lg)" }}>
        {title}
      </h2>
      {fromDash ? (
        <Card>
          <p className="muted" style={{ margin: "0 0 0.5rem" }}>
            <strong>From dashboard</strong> — the transactions workstream will use these filter hints from the URL.
          </p>
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {category ? <li>Category: {category}</li> : null}
            {tag ? <li>Tag: {tag}</li> : null}
            {untagged ? <li>Untagged only</li> : null}
          </ul>
        </Card>
      ) : null}
      <Card>
        <p className="muted" style={{ margin: 0 }}>
          {blurb}
        </p>
      </Card>
    </div>
  );
}
