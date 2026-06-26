import { useState, type ReactNode } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "../../lib/money";
import { ChartFrame } from "./ChartFrame";
import { Button } from "../ui/Button";
import { tr, useLocale } from "../../lib/i18n";

type DayPoint = { date: string; spend: number; income: number };

type Props = {
  dailySpend: Array<{ date: string; amount: number }>;
  dailyIncome: Array<{ date: string; amount: number }>;
  baseCurrency: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
};

function mergeSeries(
  spend: Array<{ date: string; amount: number }>,
  income: Array<{ date: string; amount: number }>,
): DayPoint[] {
  const map = new Map<string, DayPoint>();
  for (const s of spend) {
    map.set(s.date, { date: s.date, spend: s.amount, income: 0 });
  }
  for (const i of income) {
    const cur = map.get(i.date);
    if (cur) {
      cur.income = i.amount;
    } else {
      map.set(i.date, { date: i.date, spend: 0, income: i.amount });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function SpendChart({ dailySpend, dailyIncome, baseCurrency, isLoading, isError, onRetry }: Props): ReactNode {
  const locale = useLocale();
  const [showIncome, setShowIncome] = useState(false);
  const data = mergeSeries(dailySpend, dailyIncome);
  const empty = !isLoading && !isError && data.length === 0;
  return (
    <ChartFrame
      title={tr("dashboard.chart.dailySpend.title", locale)}
      ariaLabel={tr("dashboard.chart.dailySpend.aria", locale)}
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      isEmpty={empty}
      emptyDescription={tr("dashboard.chart.dailySpend.empty", locale)}
      actions={
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setShowIncome((s) => !s);
          }}
          aria-pressed={showIncome}
          className={!showIncome ? "dashboard-toggle--off" : undefined}
        >
          {tr("dashboard.chart.dailySpend.toggleIncome", locale)}
        </Button>
      }
    >
      <div className="recharts-host" style={{ width: "100%", minWidth: 0, height: 280, minHeight: 280 }}>
        <ResponsiveContainer width="100%" height={280} minWidth={0}>
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="date" stroke="var(--muted)" tick={{ fontSize: 11 }} />
            <YAxis stroke="var(--muted)" tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(v: unknown) => formatMoney(v as string | number, baseCurrency)}
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--fg)",
              }}
            />
            <Legend />
            <Bar dataKey="spend" name={tr("dashboard.chart.dailySpend.spend", locale)} fill="var(--color-negative)" maxBarSize={28} />
            {showIncome ? (
              <Line
                type="monotone"
                dataKey="income"
                name={tr("dashboard.chart.dailySpend.income", locale)}
                stroke="var(--color-positive)"
                strokeWidth={2}
                dot={false}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
