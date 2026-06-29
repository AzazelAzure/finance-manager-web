import { useMemo, type ReactNode } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BalanceHistoryPoint, BalanceHistoryRange } from "../../api/types";
import { formatMoney, toNumber } from "../../lib/money";
import { tr, useLocale } from "../../lib/i18n";
import { pieColorAt } from "./chartPalette";
import { ChartFrame } from "./ChartFrame";
import { Button } from "../ui/Button";

const RANGES: BalanceHistoryRange[] = ["7d", "30d", "90d", "all"];

type Props = {
  series: BalanceHistoryPoint[];
  baseCurrency: string;
  range: BalanceHistoryRange;
  onRangeChange: (range: BalanceHistoryRange) => void;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
};

type ChartRow = Record<string, string | number>;

const INTERNAL_BALANCE_SOURCES = new Set(["unknown", "unknown source", "unknown-source"]);

function isUserVisibleBalanceSource(source: string): boolean {
  const normalized = source.trim().toLowerCase();
  return normalized.length > 0 && !INTERNAL_BALANCE_SOURCES.has(normalized);
}

function pivotSeries(series: BalanceHistoryPoint[]): { rows: ChartRow[]; sources: string[] } {
  const byDate = new Map<string, ChartRow>();
  const sources = new Set<string>();
  for (const point of series) {
    if (!isUserVisibleBalanceSource(point.source)) {
      continue;
    }
    sources.add(point.source);
    const row = byDate.get(point.date) ?? { date: point.date };
    const amount = toNumber(point.amount);
    row[point.source] = amount ?? 0;
    byDate.set(point.date, row);
  }
  const rows = [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return { rows, sources: [...sources].sort() };
}

export function BalanceHistoryChart({
  series,
  baseCurrency,
  range,
  onRangeChange,
  isLoading,
  isError,
  onRetry,
}: Props): ReactNode {
  const locale = useLocale();
  const { rows, sources } = useMemo(() => pivotSeries(series), [series]);
  const empty = !isLoading && !isError && rows.length === 0;

  return (
    <ChartFrame
      title={tr("dashboard.chart.balanceHistory.title", locale)}
      ariaLabel={tr("dashboard.chart.balanceHistory.aria", locale)}
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      isEmpty={empty}
      emptyDescription={tr("dashboard.chart.balanceHistory.empty", locale)}
      actions={
        <div className="dashboard-toggle-row" role="group" aria-label={tr("dashboard.chart.balanceHistory.range", locale)}>
          {RANGES.map((item) => (
            <Button
              key={item}
              type="button"
              variant="secondary"
              onClick={() => onRangeChange(item)}
              aria-pressed={range === item}
              className={range !== item ? "dashboard-toggle--off" : undefined}
            >
              {tr(`dashboard.chart.balanceHistory.range.${item}`, locale)}
            </Button>
          ))}
        </div>
      }
    >
      <div className="recharts-host" style={{ width: "100%", minWidth: 0, height: 280, minHeight: 280 }}>
        <ResponsiveContainer width="100%" height={280} minWidth={0}>
          <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="date" stroke="var(--muted)" tick={{ fontSize: 12 }} />
            <YAxis stroke="var(--muted)" tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value) => formatMoney(Number(value ?? 0), baseCurrency)}
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            />
            <Legend />
            {sources.map((source, index) => (
              <Line
                key={source}
                type="monotone"
                dataKey={source}
                name={source}
                stroke={pieColorAt(index)}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
