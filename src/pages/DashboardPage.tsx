import { useQuery } from "@tanstack/react-query";
import { getSnapshotCurrentMonth } from "../api/client";
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

export function DashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["snapshot-current-month"],
    queryFn: getSnapshotCurrentMonth,
  });

  if (isLoading) {
    return <section className="card">Loading dashboard data...</section>;
  }

  if (isError || !data) {
    return (
      <section className="card">
        <h2>Dashboard data failed</h2>
        <p>Unable to load snapshot. Retry after checking API/proxy.</p>
        <button onClick={() => refetch()}>Retry</button>
      </section>
    );
  }

  const currency = firstCurrency(data.source_balances);
  const summary = data.snapshot ?? ({} as Record<string, number>);
  const kpis = [
    { label: "Income", value: asCurrency(data.total_income_for_month, currency) },
    { label: "Outgoing", value: asCurrency(data.total_expenses_for_month, currency) },
    { label: "Assets", value: asCurrency(summary.total_assets, currency) },
    { label: "Safe to spend", value: asCurrency(summary.safe_to_spend, currency) },
  ];

  return (
    <section className="stack">
      <div className="card row-between">
        <div>
          <h2>Dashboard</h2>
          <p className="muted-text">Current month snapshot.</p>
        </div>
        <button onClick={() => refetch()}>Refresh</button>
      </div>

      <div className="kpi-grid">
        {kpis.map((kpi) => (
          <article key={kpi.label} className="card kpi-card">
            <p className="muted-text">{kpi.label}</p>
            <h3>{kpi.value}</h3>
          </article>
        ))}
      </div>

      <div className="grid">
        <article className="card">
          <h3>Incoming vs outgoing flows</h3>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.flow_series}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="incoming" fill="#16a34a" />
                <Bar dataKey="outgoing" fill="#7c3aed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="card">
          <h3>Expense by Category</h3>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={data.expense_by_category} dataKey="value" nameKey="name" outerRadius={96} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="card">
          <h3>Spend account balances</h3>
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
        </article>
      </div>
    </section>
  );
}
