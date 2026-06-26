import { useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "../../lib/money";
import { ChartFrame } from "./ChartFrame";
import { Button } from "../ui/Button";
import { tr, useLocale } from "../../lib/i18n";

const IN = "var(--color-positive)";
const OUT = "var(--color-negative)";
const LEAK = "var(--color-warning)";

type Row = { label: string; incoming: number; outgoing: number; leaks: number };

type Props = {
  data: Row[];
  baseCurrency: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
};

export function FlowChart({ data, baseCurrency, isLoading, isError, onRetry }: Props): ReactNode {
  const locale = useLocale();
  const [showIn, setShowIn] = useState(true);
  const [showOut, setShowOut] = useState(true);
  const [showLeak, setShowLeak] = useState(true);
  const empty = !isLoading && !isError && data.length === 0;
  return (
    <ChartFrame
      title={tr("dashboard.chart.flow.title", locale)}
      ariaLabel={tr("dashboard.chart.flow.aria", locale)}
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      isEmpty={empty}
      emptyDescription={tr("dashboard.chart.flow.empty", locale)}
      actions={
        <div className="dashboard-toggle-row" role="group" aria-label={tr("dashboard.chart.flow.series", locale)}>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setShowIn((s) => !s);
            }}
            aria-pressed={showIn}
            className={!showIn ? "dashboard-toggle--off" : undefined}
          >
            {tr("dashboard.chart.flow.income", locale)}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setShowOut((s) => !s);
            }}
            aria-pressed={showOut}
            className={!showOut ? "dashboard-toggle--off" : undefined}
          >
            {tr("dashboard.chart.flow.outgoing", locale)}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setShowLeak((s) => !s);
            }}
            aria-pressed={showLeak}
            className={!showLeak ? "dashboard-toggle--off" : undefined}
          >
            {tr("dashboard.chart.flow.leaks", locale)}
          </Button>
        </div>
      }
    >
      <div className="recharts-host" style={{ width: "100%", minWidth: 0, height: 280, minHeight: 280 }}>
        <ResponsiveContainer width="100%" height={280} minWidth={0}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="label" stroke="var(--muted)" tick={{ fontSize: 12 }} />
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
            {showIn ? <Bar dataKey="incoming" name={tr("dashboard.chart.flow.income", locale)} fill={IN} maxBarSize={32} /> : null}
            {showOut ? <Bar dataKey="outgoing" name={tr("dashboard.chart.flow.outgoing", locale)} fill={OUT} maxBarSize={32} /> : null}
            {showLeak ? <Bar dataKey="leaks" name={tr("dashboard.chart.flow.leaks", locale)} fill={LEAK} maxBarSize={32} /> : null}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
