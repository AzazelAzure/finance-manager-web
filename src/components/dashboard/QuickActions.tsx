import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { Card } from "../ui/Card";

const items = [
  { label: "+ Income", type: "INCOME" as const },
  { label: "+ Expense", type: "EXPENSE" as const },
  { label: "+ Transfer", type: "XFER" as const },
  { label: "+ Bill", type: "BILL" as const },
];

export function QuickActions(): ReactNode {
  return (
    <Card>
      <h3 className="muted" style={{ margin: "0 0 0.75rem" }}>
        Quick add
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
            {i.label}
          </Link>
        ))}
      </div>
    </Card>
  );
}
