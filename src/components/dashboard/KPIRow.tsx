import { TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { KPI } from "../ui/KPI";
import { formatMoney, toNumber } from "../../lib/money";
import type { FinancialSnapshotFields } from "../../api/types";

type Props = {
  currency: string;
  summary: FinancialSnapshotFields | null | undefined;
  totalIncome: string | number;
  totalExpenses: string | number;
  totalLeaks: string | number;
  transactionCount: number;
};

export function KPIRow(p: Props): ReactNode {
  const c = p.currency;
  const snap = p.summary;
  const incomeN = toNumber(p.totalIncome);
  const expN = toNumber(p.totalExpenses);
  const netN = incomeN != null && expN != null ? incomeN - expN : null;
  const safe = snap != null ? toNumber(snap.safe_to_spend) : null;
  const rem = snap != null ? toNumber(snap.total_remaining_expenses) : null;
  const assets = snap != null ? toNumber(snap.total_assets) : null;
  const leakN = toNumber(p.totalLeaks);

  const netValue =
    netN == null ? (
      "N/A"
    ) : (
      <span className={netN < 0 ? "kpi-neg" : netN > 0 ? "kpi-pos" : undefined}>
        {netN < 0 ? <TrendingDown className="kpi-delta-icon" size={18} strokeWidth={2} aria-hidden /> : null}
        {netN > 0 ? <TrendingUp className="kpi-delta-icon" size={18} strokeWidth={2} aria-hidden /> : null}
        {formatMoney(netN, c)}
      </span>
    );

  return (
    <div className="kpi-row">
      <KPI label="Income (period)" value={formatMoney(p.totalIncome, c, { naLabel: "0.00" })} />
      <KPI label="Outgoing (period)" value={formatMoney(p.totalExpenses, c, { naLabel: "0.00" })} />
      <KPI label="Total assets" value={formatMoney(assets, c, { naLabel: "0.00" })} />
      <KPI label="Remaining expenses" value={formatMoney(rem, c, { naLabel: "0.00" })} />
      <KPI label="Safe to spend" value={safe == null ? "N/A" : formatMoney(safe, c)} />
      <KPI label="Total leaks" value={formatMoney(leakN, c, { naLabel: "0.00" })} />
      <KPI label="Net" value={netValue} />
      <KPI label="Transaction count" value={String(p.transactionCount)} />
    </div>
  );
}
