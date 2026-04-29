import { useCallback, type ReactNode } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatMoney } from "../../lib/money";
import type { SnapshotTransactionRow } from "../../api/types";
import { ChartFrame } from "./ChartFrame";
import { buildTagPieData } from "./tagAggregates";
import type { CategoryPieRow } from "./categoryPieData";

type Props = {
  transactions: SnapshotTransactionRow[];
  baseCurrency: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onSelectTag: (name: string) => void;
};

export function TagPie({ transactions, baseCurrency, isLoading, isError, onRetry, onSelectTag }: Props): ReactNode {
  const data = buildTagPieData(transactions) as CategoryPieRow[];
  const empty = !isLoading && !isError && data.length === 0;
  const onSlice = useCallback(
    (entry: CategoryPieRow) => {
      if (entry.isOther) {
        return;
      }
      onSelectTag(entry.name === "(untagged)" ? "" : entry.name);
    },
    [onSelectTag],
  );
  return (
    <ChartFrame
      title="Spending by tag"
      ariaLabel="Pie chart: share of expense by tag; click a slice to open transactions"
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      isEmpty={empty}
      emptyDescription="No tagged expenses in this range."
    >
      <div className="recharts-host" style={{ width: "100%", minWidth: 0, height: 280, minHeight: 280 }}>
        <ResponsiveContainer width="100%" height={280} minWidth={0}>
          <PieChart>
            <Tooltip
              formatter={(v: unknown) => formatMoney(v as string | number, baseCurrency)}
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--fg)",
              }}
            />
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={44} outerRadius={100} paddingAngle={1}>
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={entry.fill}
                  cursor={entry.isOther ? "default" : "pointer"}
                  onClick={() => {
                    onSlice(entry);
                  }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
