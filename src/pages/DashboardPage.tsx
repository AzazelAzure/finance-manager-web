import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getSnapshotCurrentMonth } from "../api/snapshot";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ErrorState } from "../components/ui/ErrorState";
import { KPI } from "../components/ui/KPI";
import { LoadingState } from "../components/ui/LoadingState";
import type { ReactNode } from "react";

function asCurrency(value: number | string | undefined, currency = "USD"): string {
  const num = Number(value ?? 0);
  return `${num.toFixed(2)} ${currency}`;
}

function firstCurrency(
  sourceBalances: Array<{ currency: string }>,
  fallback = "USD",
): string {
  return sourceBalances[0]?.currency || fallback;
}

function chartIncoming(): string {
  return "var(--chart-incoming, var(--success))";
}
function chartOutgoing(): string {
  return "var(--chart-outgoing, var(--accent))";
}

export function DashboardPage(): ReactNode {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["snapshot-current-month"],
    queryFn: getSnapshotCurrentMonth,
  });

  if (isLoading) {
    return (
      <Card>
        <LoadingState label="Loading dashboard data…" />
      </Card>
    );
  }

  if (isError || !data) {
    return <ErrorState title="Dashboard data failed" description="Unable to load snapshot. Retry after checking API or proxy." onRetry={() => refetch()} />;
  }

  const currency = firstCurrency(data.source_balances);
  const summary = data.snapshot ?? ({} as Record<string, number | string | undefined>);
  const kpis = [
    { label: "Income", value: asCurrency(data.total_income_for_month, currency) },
    { label: "Outgoing", value: asCurrency(data.total_expenses_for_month, currency) },
    { label: "Assets", value: asCurrency(summary.total_assets, currency) },
    { label: "Safe to spend", value: asCurrency(summary.safe_to_spend, currency) },
  ];

  return (
    <section className="stack">
      <div className="row-between">
        <div>
          <h2 className="muted" style={{ margin: 0, fontSize: "var(--font-xl)" }}>
            Dashboard
          </h2>
          <p className="muted-text" style={{ margin: "0.25rem 0 0" }}>
            Current month snapshot.
          </p>
        </div>
        <Button type="button" onClick={() => void refetch()} variant="secondary">
          Refresh
        </Button>
      </div>

      <div className="kpi-grid">
        {kpis.map((kpi) => (
          <KPI key={kpi.label} label={kpi.label} value={kpi.value} />
        ))}
      </div>

      <div className="grid">
        <Card>
          <h3 className="muted" style={{ margin: "0 0 0.5rem" }}>
            Incoming vs outgoing flows
          </h3>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.flow_series}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="var(--muted)" />
                <YAxis stroke="var(--muted)" />
                <Tooltip
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--fg)" }}
                />
                <Legend />
                <Bar dataKey="incoming" name="Incoming" fill={chartIncoming()} />
                <Bar dataKey="outgoing" name="Outgoing" fill={chartOutgoing()} />
                <Bar dataKey="leaks" name="Leaks" fill="var(--chart-leak)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h3 className="muted" style={{ margin: "0 0 0.5rem" }}>
            Expense by category
          </h3>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={data.expense_by_category}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={96}
                  fill="var(--accent)"
                />
                <Tooltip
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--fg)" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h3 className="muted" style={{ margin: "0 0 0.5rem" }}>
            Spend account balances
          </h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Type</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {data.source_balances.map((src) => (
                  <tr key={src.source}>
                    <td>{src.source}</td>
                    <td>{src.acc_type || "N/A"}</td>
                    <td>{asCurrency(src.amount, src.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </section>
  );
}
