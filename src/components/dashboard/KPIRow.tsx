import { TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { KPI } from "../ui/KPI";
import { formatMoney, toNumber } from "../../lib/money";
import type { FinancialSnapshotFields } from "../../api/types";
import { tr, useLocale } from "../../lib/i18n";

type Props = {
  currency: string;
  summary: FinancialSnapshotFields | null | undefined;
  totalIncome: string | number;
  totalExpenses: string | number;
  totalLeaks: string | number;
  transactionCount: number;
};

export function KPIRow(p: Props): ReactNode {
  const locale = useLocale();
  const c = p.currency;
  const snap = p.summary;
  const incomeN = toNumber(p.totalIncome);
  const rawExpenseN = toNumber(p.totalExpenses);
  const expN = rawExpenseN == null ? null : Math.abs(rawExpenseN);
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
      <KPI label={tr("dashboard.kpi.income", locale)} value={formatMoney(p.totalIncome, c, { naLabel: "0.00" })} />
      <KPI label={tr("dashboard.kpi.outgoing", locale)} value={formatMoney(expN, c, { naLabel: "0.00" })} />
      <KPI label={tr("dashboard.kpi.assets", locale)} value={formatMoney(assets, c, { naLabel: "0.00" })} />
      <KPI label={tr("dashboard.kpi.remaining", locale)} value={formatMoney(rem, c, { naLabel: "0.00" })} />
      <KPI label={tr("dashboard.kpi.safe", locale)} value={safe == null ? tr("dashboard.na", locale) : formatMoney(safe, c)} />
      <KPI label={tr("dashboard.kpi.leaks", locale)} value={formatMoney(leakN, c, { naLabel: "0.00" })} />
      <KPI label={tr("dashboard.kpi.net", locale)} value={netValue} />
      <KPI label={tr("dashboard.kpi.count", locale)} value={String(p.transactionCount)} />
    </div>
  );
}
