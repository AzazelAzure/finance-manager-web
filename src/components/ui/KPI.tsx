import type { ReactNode } from "react";

import { Card } from "./Card";

type Props = { label: string; value: ReactNode; hint?: ReactNode };

export function KPI({ label, value, hint }: Props): ReactNode {
  return (
    <Card className="ui-kpi">
      <p className="ui-kpi__label">{label}</p>
      <h3 className="ui-kpi h3" style={{ margin: 0, fontSize: "var(--font-lg)" }}>{value}</h3>
      {hint ? <p className="ui-kpi__hint muted-text" style={{ margin: "0.25rem 0 0", fontSize: "var(--font-sm)" }}>{hint}</p> : null}
    </Card>
  );
}
