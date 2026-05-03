import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getTransactionsVisualization } from "../../api/transactions";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ChartFrame } from "../../components/dashboard/ChartFrame";
import { ErrorState } from "../../components/ui/ErrorState";
import { LoadingState } from "../../components/ui/LoadingState";
import { formatMoney } from "../../lib/money";
import { tr, useLocale } from "../../lib/i18n";
import { readOptsFromQuery } from "../../offline/pwaReadBypass";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

const PIE_COLORS = ["#6487ff", "#38c299", "#ff8c69", "#ffd166", "#a78bfa", "#7dd3fc"];

function toNumber(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : 0;
  return Number.isFinite(n) ? n : 0;
}

function normalizeFlowRows(input: unknown): Array<{ date: string; income: number; expense: number }> {
  if (!Array.isArray(input)) return [];
  return input
    .map((row) => {
      const rec = row as Record<string, unknown>;
      const date = String(rec.date ?? "");
      if (!date) return null;
      return {
        date,
        income: toNumber(rec.income),
        expense: toNumber(rec.expense),
      };
    })
    .filter((row): row is { date: string; income: number; expense: number } => row != null);
}

function normalizeTypeRows(input: unknown): Array<{ tx_type: string; amount: number }> {
  if (!Array.isArray(input)) return [];
  return input
    .map((row) => {
      const rec = row as Record<string, unknown>;
      const txType = String(rec.tx_type ?? rec.type ?? "");
      if (!txType) return null;
      return {
        tx_type: txType,
        amount: toNumber(rec.amount),
      };
    })
    .filter((row): row is { tx_type: string; amount: number } => row != null);
}

function normalizeCategoryRows(input: unknown): Array<{ category: string; amount: number }> {
  if (!Array.isArray(input)) return [];
  return input
    .map((row) => {
      const rec = row as Record<string, unknown>;
      const category = String(rec.category ?? rec.name ?? "");
      if (!category) return null;
      return {
        category,
        amount: toNumber(rec.amount ?? rec.total),
      };
    })
    .filter((row): row is { category: string; amount: number } => row != null);
}

export function DeepDivePage(): ReactNode {
  const locale = useLocale();
  const [startDate, setStartDate] = useState(monthStartIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [activeTypeSlice, setActiveTypeSlice] = useState<number>(-1);
  const query = useQuery({
    queryKey: ["transactions-viz", startDate, endDate] as const,
    queryFn: (ctx) => getTransactionsVisualization({ start_date: startDate, end_date: endDate }, readOptsFromQuery(ctx)),
  });

  const flowData = useMemo(() => normalizeFlowRows(query.data?.flow_daily), [query.data?.flow_daily]);
  const typeData = useMemo(() => normalizeTypeRows(query.data?.tx_type_totals), [query.data?.tx_type_totals]);
  const categoryData = useMemo(
    () => normalizeCategoryRows(query.data?.top_expense_categories),
    [query.data?.top_expense_categories],
  );
  const txLinkSearch = useMemo(() => `?start_date=${startDate}&end_date=${endDate}`, [startDate, endDate]);

  return (
    <div className="stack">
      <div className="app-toolbar app-surface">
        <h2 className="muted" style={{ margin: 0, fontSize: "var(--font-xl)" }}>
          {tr("txDive.title", locale)}
        </h2>
        <div style={{ display: "flex", gap: 8 }}>
          <Link to="/app/transactions" className="ui-btn ui-btn--secondary">
            {tr("txCalendar.ledger", locale)}
          </Link>
          <Link to="/app/transactions/calendar" className="ui-btn ui-btn--secondary">
            {tr("txCalendar.deepDive", locale)}
          </Link>
        </div>
      </div>

      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
          <label className="ui-field">
            <span className="ui-label">{tr("common.start", locale)}</span>
            <input className="ui-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="ui-field">
            <span className="ui-label">{tr("common.end", locale)}</span>
            <input className="ui-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <div style={{ display: "flex", alignItems: "end" }}>
            <Button variant="secondary" onClick={() => void query.refetch()}>
              {tr("txDive.reload", locale)}
            </Button>
          </div>
        </div>
      </Card>

      {query.isLoading ? <LoadingState label={tr("txDive.loading", locale)} /> : null}
      {query.isError ? <ErrorState title={tr("txDive.failed", locale)} onRetry={() => void query.refetch()} /> : null}

      <ChartFrame
        title={tr("txDive.dailyFlow", locale)}
        ariaLabel={tr("txDive.dailyFlowAria", locale)}
        isLoading={query.isLoading}
        isError={Boolean(query.isError)}
        onRetry={() => void query.refetch()}
        isEmpty={flowData.length === 0}
      >
        <div className="recharts-host" style={{ width: "100%", minWidth: 0, height: 280, minHeight: 280 }}>
          <ResponsiveContainer width="100%" height={280} minWidth={0}>
            <BarChart data={flowData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(v: unknown) => formatMoney(v as string | number, "USD")} />
              <Bar dataKey="income" fill="var(--chart-incoming, var(--success))" />
              <Bar dataKey="expense" fill="var(--chart-outgoing, var(--accent))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>

      <div style={{ display: "grid", gap: "var(--space-4)", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <ChartFrame
          title={tr("txDive.typeMix", locale)}
          ariaLabel={tr("txDive.typeMixAria", locale)}
          isLoading={query.isLoading}
          isError={Boolean(query.isError)}
          onRetry={() => void query.refetch()}
          isEmpty={typeData.length === 0}
        >
          <div className="recharts-host" style={{ width: "100%", minWidth: 0, height: 280, minHeight: 280 }}>
            <ResponsiveContainer width="100%" height={280} minWidth={0}>
              <PieChart>
                <Pie
                  data={typeData}
                  dataKey="amount"
                  nameKey="tx_type"
                  outerRadius={100}
                  paddingAngle={2}
                  onMouseEnter={(_, idx) => setActiveTypeSlice(idx)}
                  onMouseLeave={() => setActiveTypeSlice(-1)}
                  labelLine={false}
                  label={(props) => {
                    const percent = Number(props.percent ?? 0);
                    if (percent < 0.07) {
                      return null;
                    }
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
                            {formatMoney(props.value as string | number, "USD")}
                          </tspan>
                        </text>
                      </g>
                    );
                  }}
                >
                  {typeData.map((d, idx) => (
                    <Cell
                      key={`${d.tx_type}-${idx}`}
                      fill={PIE_COLORS[idx % PIE_COLORS.length]}
                      stroke={activeTypeSlice === idx ? "color-mix(in srgb, var(--accent) 58%, white)" : "var(--surface)"}
                      strokeWidth={activeTypeSlice === idx ? 3 : 1}
                      style={activeTypeSlice === idx ? { filter: "drop-shadow(0 8px 12px rgba(15,23,42,0.35))" } : undefined}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(v: unknown) => formatMoney(v as string | number, "USD")} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartFrame>

        <ChartFrame
          title={tr("txDive.topCategories", locale)}
          ariaLabel={tr("txDive.topCategoriesAria", locale)}
          isLoading={query.isLoading}
          isError={Boolean(query.isError)}
          onRetry={() => void query.refetch()}
          isEmpty={categoryData.length === 0}
        >
          <div className="recharts-host" style={{ width: "100%", minWidth: 0, height: 280, minHeight: 280 }}>
            <ResponsiveContainer width="100%" height={280} minWidth={0}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip formatter={(v: unknown) => formatMoney(v as string | number, "USD")} />
                <Bar dataKey="amount" fill="var(--chart-outgoing, var(--accent))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartFrame>
      </div>

      <Card>
        <Link className="ui-btn ui-btn--secondary" to={`/app/transactions${txLinkSearch}`}>
          {tr("txDive.viewRange", locale)}
        </Link>
      </Card>
    </div>
  );
}
