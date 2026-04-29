import { useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "../../lib/money";
import { ChartFrame } from "./ChartFrame";
import { Button } from "../ui/Button";

const IN = "var(--chart-incoming, var(--success))";
const OUT = "var(--chart-outgoing, var(--accent))";
const LEAK = "var(--chart-leak)";

type Row = { label: string; incoming: number; outgoing: number; leaks: number };

type Props = {
  data: Row[];
  baseCurrency: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
};

export function FlowChart({ data, baseCurrency, isLoading, isError, onRetry }: Props): ReactNode {
  const [showIn, setShowIn] = useState(true);
  const [showOut, setShowOut] = useState(true);
  const [showLeak, setShowLeak] = useState(true);
  const empty = !isLoading && !isError && data.length === 0;
  return (
    <ChartFrame
      title="Incoming vs outgoing flow"
      ariaLabel="Bar chart: daily flow of income, outgoing, and transfer leak amounts"
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      isEmpty={empty}
      emptyDescription="No transactions in this range."
      actions={
        <div className="dashboard-toggle-row" role="group" aria-label="Flow series">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setShowIn((s) => !s);
            }}
            aria-pressed={showIn}
            className={!showIn ? "dashboard-toggle--off" : undefined}
          >
            Income
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
            Outgoing
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
            Leaks
          </Button>
        </div>
      }
    >
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
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
            {showIn ? <Bar dataKey="incoming" name="Incoming" fill={IN} maxBarSize={32} /> : null}
            {showOut ? <Bar dataKey="outgoing" name="Outgoing" fill={OUT} maxBarSize={32} /> : null}
            {showLeak ? <Bar dataKey="leaks" name="Leaks" fill={LEAK} maxBarSize={32} /> : null}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
