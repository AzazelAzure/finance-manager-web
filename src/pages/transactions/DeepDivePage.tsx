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
  const [startDate, setStartDate] = useState(monthStartIso());
  const [endDate, setEndDate] = useState(todayIso());
  const query = useQuery({
    queryKey: ["transactions-viz", startDate, endDate] as const,
    queryFn: () => getTransactionsVisualization({ start_date: startDate, end_date: endDate }),
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
      <div className="row-between">
        <h2 className="muted" style={{ margin: 0, fontSize: "var(--font-xl)" }}>
          Transaction insights
        </h2>
        <div style={{ display: "flex", gap: 8 }}>
          <Link to="/app/transactions" className="ui-btn ui-btn--secondary">
            Ledger
          </Link>
          <Link to="/app/transactions/calendar" className="ui-btn ui-btn--secondary">
            Calendar
          </Link>
        </div>
      </div>

      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
          <label className="ui-field">
            <span className="ui-label">Start</span>
            <input className="ui-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="ui-field">
            <span className="ui-label">End</span>
            <input className="ui-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <div style={{ display: "flex", alignItems: "end" }}>
            <Button variant="secondary" onClick={() => void query.refetch()}>
              Reload visualization
            </Button>
          </div>
        </div>
      </Card>

      {query.isLoading ? <LoadingState label="Loading visualization..." /> : null}
      {query.isError ? <ErrorState title="Visualization failed" onRetry={() => void query.refetch()} /> : null}

      <ChartFrame
        title="Daily flow"
        ariaLabel="Flow daily chart"
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
          title="Transaction type mix"
          ariaLabel="Transaction type pie"
          isLoading={query.isLoading}
          isError={Boolean(query.isError)}
          onRetry={() => void query.refetch()}
          isEmpty={typeData.length === 0}
        >
          <div className="recharts-host" style={{ width: "100%", minWidth: 0, height: 280, minHeight: 280 }}>
            <ResponsiveContainer width="100%" height={280} minWidth={0}>
              <PieChart>
                <Pie data={typeData} dataKey="amount" nameKey="tx_type" outerRadius={100}>
                  {typeData.map((d, idx) => (
                    <Cell key={`${d.tx_type}-${idx}`} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: unknown) => formatMoney(v as string | number, "USD")} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartFrame>

        <ChartFrame
          title="Top expense categories"
          ariaLabel="Top expense categories bar"
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
          View transactions in this range
        </Link>
      </Card>
    </div>
  );
}
