import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "../ui/Card";
import { formatMoney, toNumber } from "../../lib/money";

type Row = { source: string; acc_type: string; amount: string; currency: string };

type Props = { rows: Row[] };

export function SourceBalances({ rows }: Props): ReactNode {
  return (
    <Card>
      <h3 className="muted" style={{ margin: "0 0 0.75rem" }}>
        Spend account balances
      </h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th>Type</th>
              <th className="num">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((src) => {
              const n = toNumber(src.amount);
              const neg = n != null && n < 0;
              return (
                <tr key={src.source}>
                  <td>{src.source}</td>
                  <td>
                    <span className="tx-badge tx-badge--muted">{src.acc_type || "N/A"}</span>
                  </td>
                  <td className={`num ${neg ? "balance-neg" : ""}`}>
                    {neg ? (
                      <>
                        <AlertTriangle className="balance-neg-icon" size={16} aria-hidden />
                        <span className="sr-only">Negative balance: </span>
                      </>
                    ) : null}
                    {formatMoney(src.amount, src.currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
