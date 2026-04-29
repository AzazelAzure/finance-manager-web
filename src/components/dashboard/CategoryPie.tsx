import { type ReactNode, useCallback, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatMoney } from "../../lib/money";
import { tr, useLocale } from "../../lib/i18n";
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
  const locale = useLocale();
  const data = buildCategoryPieData(expenseByCategory);
  const empty = !isLoading && !isError && data.length === 0;
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const total = useMemo(() => data.reduce((acc, row) => acc + row.value, 0), [data]);

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
      title={tr("dashboard.chart.expenseByCategory", locale)}
      ariaLabel={tr("dashboard.chart.expenseByCategory.aria", locale)}
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      isEmpty={empty}
    >
      <div className="recharts-host pie-host">
        <ResponsiveContainer width="100%" height={280} minWidth={0}>
          <PieChart>
            <Tooltip
              formatter={(v: unknown, _name: unknown, ctx: { payload?: CategoryPieRow }) => {
                const payload = ctx?.payload;
                const percent = payload?.percent != null ? ` (${(payload.percent * 100).toFixed(1)}%)` : "";
                return `${formatMoney(v as string | number, baseCurrency)}${percent}`;
              }}
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--fg)",
              }}
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={42}
              outerRadius={100}
              paddingAngle={2}
              onMouseEnter={(_, idx) => setActiveIndex(idx)}
              onMouseLeave={() => setActiveIndex(-1)}
              labelLine={false}
              label={(props) => {
                const percent = Number(props.percent ?? 0);
                if (percent < 0.07) {
                  return null;
                }
                const row = props.payload as CategoryPieRow | undefined;
                const midAngle = (Number(props.midAngle) * Math.PI) / 180;
                const outerRadius = Number(props.outerRadius);
                const lineStartX = Number(props.cx) + Math.cos(-midAngle) * outerRadius;
                const lineStartY = Number(props.cy) + Math.sin(-midAngle) * outerRadius;
                return (
                  <g>
                    <line x1={lineStartX} y1={lineStartY} x2={Number(props.x)} y2={Number(props.y)} stroke="var(--muted)" strokeWidth={1.25} />
                    <text x={Number(props.x)} y={Number(props.y)} fill="var(--fg)" textAnchor={props.textAnchor} dominantBaseline="central">
                    <tspan x={Number(props.x)} dy="-0.2em" className="pie-callout__title">
                      {String(props.name)}
                    </tspan>
                    <tspan x={Number(props.x)} dy="1.25em" className="pie-callout__value">
                      {formatMoney(row?.value ?? 0, baseCurrency)}
                    </tspan>
                    </text>
                  </g>
                );
              }}
            >
              {data.map((entry, idx) => (
                <Cell
                  key={entry.name}
                  fill={entry.fill}
                  cursor={entry.isOther ? "default" : "pointer"}
                  onClick={() => {
                    clickSlice(entry);
                  }}
                  stroke={activeIndex === idx ? "color-mix(in srgb, var(--accent) 58%, white)" : "var(--surface)"}
                  strokeWidth={activeIndex === idx ? 3 : 1}
                  style={activeIndex === idx ? { filter: "drop-shadow(0 8px 12px rgba(15,23,42,0.35))" } : undefined}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {data.length > 0 ? (
          <div className="pie-legend">
            {data.map((row) => (
              <div key={row.name} className="pie-legend__row">
                <span className="pie-legend__dot" style={{ background: row.fill }} />
                <span className="pie-legend__name">{row.name}</span>
                <span className="pie-legend__amount">{formatMoney(row.value, baseCurrency)}</span>
                <span className="pie-legend__pct">{total > 0 ? `${((row.value / total) * 100).toFixed(1)}%` : "0.0%"}</span>
              </div>
            ))}
            {data.some((row) => row.isOther && row.mergedNames && row.mergedNames.length > 0) ? (
              <p className="pie-legend__other-note">
                {tr("dashboard.chart.otherIncludes", locale)}{" "}
                {
                  data.find((row) => row.isOther)?.mergedNames?.slice(0, 4).join(", ")
                }
                {((data.find((row) => row.isOther)?.mergedNames?.length ?? 0) > 4) ? "…" : ""}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </ChartFrame>
  );
}
