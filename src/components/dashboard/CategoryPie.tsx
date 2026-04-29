import { type ReactNode, useCallback } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatMoney } from "../../lib/money";
import { ChartFrame } from "./ChartFrame";
import type { CategoryPieRow } from "./categoryPieData";
import { buildCategoryPieData } from "./categoryPieData";

type Props = {
  expenseByCategory: Array<{ name: string; value: number }>;
  baseCurrency: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onSelectCategory: (name: string) => void;
};

export function CategoryPie({ expenseByCategory, baseCurrency, isLoading, isError, onRetry, onSelectCategory }: Props): ReactNode {
  const data = buildCategoryPieData(expenseByCategory);
  const empty = !isLoading && !isError && data.length === 0;
  const clickSlice = useCallback(
    (entry: CategoryPieRow) => {
      if (entry.isOther) {
        return;
      }
      onSelectCategory(entry.name);
    },
    [onSelectCategory],
  );
  return (
    <ChartFrame
      title="Expenses by category"
      ariaLabel="Pie chart: share of spending by category; click a slice to open transactions"
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      isEmpty={empty}
    >
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
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
                    clickSlice(entry);
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
