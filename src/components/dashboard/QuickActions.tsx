import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { Card } from "../ui/Card";
import { tr, useLocale } from "../../lib/i18n";

const items = [
  { type: "INCOME" as const },
  { type: "EXPENSE" as const },
  { type: "XFER" as const },
  { type: "BILL" as const },
];

export function QuickActions(): ReactNode {
  const locale = useLocale();
  const labels: Record<string, string> = {
    INCOME: tr("dashboard.quick.income", locale),
    EXPENSE: tr("dashboard.quick.expense", locale),
    XFER: tr("dashboard.quick.transfer", locale),
    BILL: tr("dashboard.quick.bill", locale),
  };
  return (
    <Card>
      <h3 className="muted" style={{ margin: "0 0 0.75rem" }}>
        {tr("dashboard.quick.title", locale)}
      </h3>
      <div className="quick-actions">
        {items.map((i) => (
          <Link
            key={i.type}
            to={
              i.type === "BILL"
                ? "/app/upcoming-expenses"
                : `/app/transactions/new?type=${i.type === "XFER" ? "XFER_OUT" : i.type}`
            }
            className="ui-btn ui-btn--secondary quick-actions__btn"
          >
            {labels[i.type]}
          </Link>
        ))}
      </div>
    </Card>
  );
}
