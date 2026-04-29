import { Card } from "../components/ui/Card";
import type { ReactNode } from "react";

type Props = { title: string; blurb: string };

export function PhasePlaceholderPage({ title, blurb }: Props): ReactNode {
  return (
    <div className="stack">
      <h2 className="muted" style={{ margin: 0, fontSize: "var(--font-lg)" }}>
        {title}
      </h2>
      <Card>
        <p className="muted" style={{ margin: 0 }}>
          {blurb}
        </p>
      </Card>
    </div>
  );
}
