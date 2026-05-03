import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "react-router-dom";
import { listUpcomingExpenses } from "../../api/upcomingExpenses";
import { getTransactionsVisualization } from "../../api/transactions";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ChartFrame } from "../../components/dashboard/ChartFrame";
import { DataTable, type ColumnDef } from "../../components/ui/DataTable";
import { ErrorState } from "../../components/ui/ErrorState";
import { KPI } from "../../components/ui/KPI";
import { LoadingState } from "../../components/ui/LoadingState";
import { formatMoney } from "../../lib/money";
import { tr, useLocale } from "../../lib/i18n";
import { readOptsFromQuery } from "../../offline/pwaReadBypass";

type TimelineRow = {
  due_date: string;
  name: string;
  amount: number;
  currency: string;
  paid_flag: boolean;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function toNumber(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
}

function normalizeMonthly(input: unknown): Array<{ period: string; amount: number }> {
  if (!Array.isArray(input)) return [];
  return input
    .map((row) => {
      const rec = row as Record<string, unknown>;
      const period = String(rec.period ?? "");
      if (!period) return null;
      return { period, amount: toNumber(rec.amount) };
    })
    .filter((row): row is { period: string; amount: number } => row != null);
}

function normalizeTimeline(input: unknown): TimelineRow[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((row) => {
      const rec = row as Record<string, unknown>;
      const due_date = String(rec.due_date ?? "");
      const name = String(rec.name ?? "");
      if (!due_date || !name) return null;
      return {
        due_date,
        name,
        amount: toNumber(rec.amount),
        currency: String(rec.currency ?? "USD"),
        paid_flag: Boolean(rec.paid_flag),
      };
    })
    .filter((row): row is TimelineRow => row != null)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
}

export function UpcomingDeepDivePage(): ReactNode {
  const locale = useLocale();
  const [startDate, setStartDate] = useState(monthStartIso());
  const [endDate, setEndDate] = useState(todayIso());

  const vizQuery = useQuery({
    queryKey: ["upcoming-viz", startDate, endDate] as const,
    queryFn: (ctx) =>
      getTransactionsVisualization({ start_date: startDate, end_date: endDate }, readOptsFromQuery(ctx)),
  });
  const upcomingQuery = useQuery({
    queryKey: ["upcoming-expenses", "all"] as const,
    queryFn: (ctx) => listUpcomingExpenses(readOptsFromQuery(ctx)),
  });

  const monthlyData = useMemo(
    () => normalizeMonthly((vizQuery.data as Record<string, unknown> | undefined)?.upcoming_expenses_monthly),
    [vizQuery.data],
  );
  const timelineData = useMemo(
    () => normalizeTimeline((vizQuery.data as Record<string, unknown> | undefined)?.upcoming_expenses_timeline),
    [vizQuery.data],
  );

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`;
  const totalThisMonth = monthlyData.find((m) => m.period === currentMonth)?.amount ?? 0;
  const totalNextMonth = monthlyData.find((m) => m.period === nextMonth)?.amount ?? 0;
  const recurringPct = useMemo(() => {
    const rows = upcomingQuery.data ?? [];
    if (rows.length === 0) return 0;
    const recurringCount = rows.filter((r) => r.recurring_flag).length;
    return Math.round((recurringCount / rows.length) * 100);
  }, [upcomingQuery.data]);
  const overdueAmount = useMemo(() => {
    const today = todayIso();
    return timelineData
      .filter((row) => !row.paid_flag && row.due_date < today)
      .reduce((acc, row) => acc + row.amount, 0);
  }, [timelineData]);

  const columns = useMemo<Array<ColumnDef<TimelineRow>>>(
    () => [
      { id: "due", header: "Due date", cell: (r) => r.due_date, sortValue: (r) => r.due_date },
      { id: "name", header: "Name", cell: (r) => r.name, sortValue: (r) => r.name },
      { id: "amount", header: "Amount", cell: (r) => formatMoney(r.amount, r.currency), sortValue: (r) => r.amount },
      {
        id: "status",
        header: "Status",
        cell: (r) => {
          const overdue = !r.paid_flag && r.due_date < todayIso();
          return <span className="tx-badge">{r.paid_flag ? "Paid" : overdue ? "Overdue" : "Upcoming"}</span>;
        },
      },
    ],
    [],
  );

  const isLoading = vizQuery.isLoading || upcomingQuery.isLoading;
  const isError = Boolean(vizQuery.isError || upcomingQuery.isError);

  return (
    <div className="stack">
      <div className="app-toolbar app-surface">
        <h2 className="muted" style={{ margin: 0, fontSize: "var(--font-xl)" }}>
          {tr("upcomingDive.title", locale)}
        </h2>
        <div style={{ display: "flex", gap: 8 }}>
          <Link to="/app/upcoming-expenses" className="ui-btn ui-btn--secondary">
            {tr("upcomingDive.list", locale)}
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
            <Button variant="secondary" onClick={() => void vizQuery.refetch()}>
              {tr("upcomingDive.reload", locale)}
            </Button>
          </div>
        </div>
      </Card>

      {isLoading ? <LoadingState label={tr("upcomingDive.loading", locale)} /> : null}
      {isError ? <ErrorState title={tr("upcomingDive.failed", locale)} onRetry={() => void vizQuery.refetch()} /> : null}

      <div style={{ display: "grid", gap: "var(--space-4)", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <KPI label={tr("upcomingDive.kpi.thisMonth", locale)} value={formatMoney(totalThisMonth, "USD")} />
        <KPI label={tr("upcomingDive.kpi.nextMonth", locale)} value={formatMoney(totalNextMonth, "USD")} />
        <KPI label={tr("upcomingDive.kpi.recurring", locale)} value={`${recurringPct}%`} />
        <KPI label={tr("upcomingDive.kpi.overdue", locale)} value={formatMoney(overdueAmount, "USD")} />
      </div>

      <ChartFrame
        title={tr("upcomingDive.monthlyTotals", locale)}
        ariaLabel={tr("upcomingDive.monthlyTotalsAria", locale)}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void vizQuery.refetch()}
        isEmpty={monthlyData.length === 0}
      >
        <div className="recharts-host" style={{ width: "100%", minWidth: 0, height: 280, minHeight: 280 }}>
          <ResponsiveContainer width="100%" height={280} minWidth={0}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip formatter={(v: unknown) => formatMoney(v as number, "USD")} />
              <Bar dataKey="amount" fill="var(--chart-outgoing, var(--accent))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>

      <Card>
        <h3 className="muted" style={{ marginTop: 0 }}>
          {tr("upcomingDive.timeline", locale)}
        </h3>
        <DataTable columns={columns} data={timelineData} keyField="name" emptyTitle={tr("upcomingDive.empty", locale)} />
      </Card>
    </div>
  );
}
