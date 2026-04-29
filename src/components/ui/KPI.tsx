import type { ReactNode } from "react";

import { Card } from "./Card";

type Props = { label: string; value: ReactNode };

export function KPI({ label, value }: Props): ReactNode {
  return (
    <Card className="ui-kpi">
      <p className="ui-kpi__label">{label}</p>
      <h3 className="ui-kpi h3" style={{ margin: 0, fontSize: "var(--font-lg)" }}>{value}</h3>
    </Card>
  );
}
