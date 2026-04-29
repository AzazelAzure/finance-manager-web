import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { formatMoney } from "../../lib/money";
import type { SnapshotTransactionRow } from "../../api/types";
import { useBreakpoint } from "../../lib/breakpoints";

type Props = { rows: SnapshotTransactionRow[]; baseCurrency: string };

function typeBadge(t: string): string {
  if (t === "EXPENSE") {
    return "Exp";
  }
  if (t === "INCOME") {
    return "Inc";
  }
  if (t === "XFER_IN" || t === "XFER_OUT") {
    return "Xfer";
  }
  return t;
}

export function RecentTransactions({ rows, baseCurrency }: Props): ReactNode {
  const { atOrAboveMd: desktop } = useBreakpoint();
  if (rows.length === 0) {
    return (
      <Card>
        <h3 className="muted" style={{ margin: "0 0 0.75rem" }}>
          Recent transactions
        </h3>
        <EmptyState
          title="No transactions in this period"
          action={
            <Link to="/app/transactions/new" className="ui-btn">
              Add transaction
            </Link>
          }
        />
      </Card>
    );
  }

  if (desktop) {
    return (
      <Card>
        <h3 className="muted" style={{ margin: "0 0 0.75rem" }}>
          Recent transactions
        </h3>
        <div className="table-wrap recent-tx-table">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Description</th>
                <th className="num">Amount</th>
                <th>Source</th>
                <th>Category</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.tx_id}>
                  <td>{r.date ?? r.created_on}</td>
                  <td>
                    <span className="tx-badge">{typeBadge(r.tx_type)}</span>
                  </td>
                  <td>{r.description ?? "—"}</td>
                  <td className="num">{formatMoney(r.amount, r.currency || baseCurrency)}</td>
                  <td>{r.source}</td>
                  <td>{r.category ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="muted" style={{ margin: "0 0 0.75rem" }}>
        Recent transactions
      </h3>
      <ul className="recent-tx-cards">
        {rows.map((r) => (
          <li key={r.tx_id} className="recent-tx-card">
            <div className="recent-tx-card__head">
              <span className="tx-badge">{typeBadge(r.tx_type)}</span>
              <span className="recent-tx-card__amt">{formatMoney(r.amount, r.currency || baseCurrency)}</span>
            </div>
            <p className="recent-tx-card__desc">{r.description ?? "—"}</p>
            <p className="recent-tx-card__meta">
              {r.date ?? r.created_on} · {r.source} · {r.category ?? "—"}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
