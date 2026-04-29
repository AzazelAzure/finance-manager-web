import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getTransactionsCalendar } from "../../api/transactions";
import { Card } from "../../components/ui/Card";
import { LoadingState } from "../../components/ui/LoadingState";
import { ErrorState } from "../../components/ui/ErrorState";
import { DataTable } from "../../components/ui/DataTable";
import { formatMoney } from "../../lib/money";
import { ChartFrame } from "../../components/dashboard/ChartFrame";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function toNumber(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : 0;
  return Number.isFinite(n) ? n : 0;
}

function isSameMonth(dateIso: string, baseIso: string): boolean {
  return dateIso.slice(0, 7) === baseIso.slice(0, 7);
}

function monthGridAnchor(startIso: string): Date {
  const d = new Date(`${startIso}T00:00:00`);
  d.setDate(1);
  const dow = d.getDay();
  d.setDate(d.getDate() - dow);
  return d;
}

export function CalendarPage(): ReactNode {
  const [startDate, setStartDate] = useState(monthStartIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [displayCurrencyMode, setDisplayCurrencyMode] = useState<"base" | "original">("base");
  const [heatMetricMode, setHeatMetricMode] = useState<"net" | "expense_only" | "count">("net");
  const [selectedDay, setSelectedDay] = useState<string>("");

  const query = useQuery({
    queryKey: ["transactions-calendar", startDate, endDate, displayCurrencyMode, heatMetricMode] as const,
    queryFn: () =>
      getTransactionsCalendar({
        start_date: startDate,
        end_date: endDate,
        display_currency_mode: displayCurrencyMode,
        heat_metric_mode: heatMetricMode,
      }),
  });

  const dayDrillRows = useMemo(() => {
    const rows = query.data?.day_drill ?? [];
    if (!selectedDay) return rows;
    return rows.filter((r) => r.date === selectedDay);
  }, [query.data?.day_drill, selectedDay]);

  const dailyRows = useMemo(() => query.data?.daily ?? [], [query.data?.daily]);
  const monthRows = useMemo(() => query.data?.monthly ?? [], [query.data?.monthly]);
  const selectedDayResolved = useMemo(() => {
    if (selectedDay) return selectedDay;
    return dailyRows[0]?.date ?? "";
  }, [dailyRows, selectedDay]);

  const chartRows = useMemo(() => {
    return dailyRows.map((row) => {
      const metric =
        heatMetricMode === "count"
          ? toNumber(row.tx_count ?? row.count)
          : heatMetricMode === "expense_only"
            ? toNumber(row.expense_only)
            : toNumber(row.net);
      return { date: row.date, metric, tx_count: toNumber(row.tx_count ?? row.count) };
    });
  }, [dailyRows, heatMetricMode]);

  const monthBars = useMemo(() => {
    return monthRows.map((row, idx) => {
      const label = String(
        (row as Record<string, unknown>).month ??
          (row as Record<string, unknown>).label ??
          (row as Record<string, unknown>).period ??
          `M${String(idx + 1)}`,
      );
      const value =
        toNumber((row as Record<string, unknown>).total) ||
        toNumber((row as Record<string, unknown>).amount) ||
        toNumber((row as Record<string, unknown>).net) ||
        toNumber((row as Record<string, unknown>).value);
      return { label, value };
    });
  }, [monthRows]);

  const dailyByDate = useMemo(() => {
    const map = new Map<string, { metric: number; txCount: number }>();
    for (const row of chartRows) {
      map.set(row.date, { metric: row.metric, txCount: row.tx_count });
    }
    return map;
  }, [chartRows]);

  const heatMax = useMemo(() => {
    const values = Array.from(dailyByDate.values()).map((v) => Math.abs(v.metric));
    return Math.max(...values, 0);
  }, [dailyByDate]);

  const monthCells = useMemo(() => {
    const anchor = monthGridAnchor(startDate);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(anchor);
      d.setDate(anchor.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const day = d.getDate();
      const inMonth = isSameMonth(iso, startDate);
      const rec = dailyByDate.get(iso);
      const metric = rec?.metric ?? 0;
      const txCount = rec?.txCount ?? 0;
      const normalized = heatMax <= 0 ? 0 : Math.min(Math.abs(metric) / heatMax, 1);
      return { iso, day, inMonth, metric, txCount, normalized };
    });
  }, [dailyByDate, heatMax, startDate]);

  const inMonthDates = useMemo(
    () => monthCells.filter((c) => c.inMonth).map((c) => c.iso),
    [monthCells],
  );

  function onDayKeyDown(ev: KeyboardEvent<HTMLButtonElement>, date: string): void {
    const idx = inMonthDates.indexOf(date);
    if (idx < 0) return;
    const move = (nextIdx: number): void => {
      const safe = Math.max(0, Math.min(inMonthDates.length - 1, nextIdx));
      setSelectedDay(inMonthDates[safe]);
    };
    if (ev.key === "ArrowRight") {
      ev.preventDefault();
      move(idx + 1);
    } else if (ev.key === "ArrowLeft") {
      ev.preventDefault();
      move(idx - 1);
    } else if (ev.key === "ArrowDown") {
      ev.preventDefault();
      move(idx + 7);
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      move(idx - 7);
    } else if (ev.key === "Home") {
      ev.preventDefault();
      move(0);
    } else if (ev.key === "End") {
      ev.preventDefault();
      move(inMonthDates.length - 1);
    }
  }

  return (
    <div className="stack">
      <div className="row-between">
        <h2 className="muted" style={{ margin: 0, fontSize: "var(--font-xl)" }}>
          Transactions calendar
        </h2>
        <div style={{ display: "flex", gap: 8 }}>
          <Link to="/app/transactions" className="ui-btn ui-btn--secondary">
            Ledger
          </Link>
          <Link to="/app/transactions/deep-dive" className="ui-btn ui-btn--secondary">
            Deep dive
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
          <label className="ui-field">
            <span className="ui-label">Display currency</span>
            <select className="ui-input" value={displayCurrencyMode} onChange={(e) => setDisplayCurrencyMode(e.target.value as "base" | "original")}>
              <option value="base">Base</option>
              <option value="original">Original</option>
            </select>
          </label>
          <label className="ui-field">
            <span className="ui-label">Heat metric</span>
            <select className="ui-input" value={heatMetricMode} onChange={(e) => setHeatMetricMode(e.target.value as "net" | "expense_only" | "count")}>
              <option value="net">Net</option>
              <option value="expense_only">Expense only</option>
              <option value="count">Count</option>
            </select>
          </label>
        </div>
      </Card>

      {query.isLoading ? <LoadingState label="Loading calendar..." /> : null}
      {query.isError ? <ErrorState title="Calendar load failed" onRetry={() => void query.refetch()} /> : null}

      {query.data ? (
        <>
          <ChartFrame
            title="Daily activity"
            ariaLabel="Daily transactions metric chart"
            isLoading={query.isLoading}
            isError={Boolean(query.isError)}
            onRetry={() => void query.refetch()}
            isEmpty={chartRows.length === 0}
            minHeight={220}
          >
            <div className="recharts-host" style={{ width: "100%", minWidth: 0, height: 260, minHeight: 260 }}>
              <ResponsiveContainer width="100%" height={260} minWidth={0}>
                <BarChart data={chartRows}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip
                    formatter={(v: unknown) =>
                      heatMetricMode === "count" ? String(v) : formatMoney(v as string | number, "USD")
                    }
                  />
                  <Bar dataKey="metric" fill="var(--chart-outgoing, var(--accent))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartFrame>

          <Card>
            <h3 className="muted" style={{ margin: "0 0 0.75rem" }}>
              Month grid
            </h3>
            <div
              role="grid"
              aria-label="Calendar month grid"
              style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: 6 }}
            >
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="muted-text" style={{ fontSize: "var(--font-sm)", textAlign: "center" }}>
                  {d}
                </div>
              ))}
              {monthCells.map((cell) => {
                const bg = cell.normalized > 0 ? `color-mix(in oklab, var(--accent) ${Math.round(cell.normalized * 85)}%, var(--surface))` : "var(--surface)";
                const selected = selectedDayResolved === cell.iso;
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    role="gridcell"
                    aria-selected={selected}
                    disabled={!cell.inMonth}
                    onClick={() => setSelectedDay(cell.iso)}
                    onKeyDown={(ev) => onDayKeyDown(ev, cell.iso)}
                    style={{
                      border: selected ? "2px solid var(--accent)" : "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      background: cell.inMonth ? bg : "var(--surface-2)",
                      color: cell.inMonth ? "var(--fg)" : "var(--muted)",
                      minHeight: 56,
                      textAlign: "left",
                      padding: 6,
                      cursor: cell.inMonth ? "pointer" : "not-allowed",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
                      <span style={{ fontWeight: 600 }}>{cell.day}</span>
                      <span className="muted-text" style={{ fontSize: "0.72rem" }}>
                        {cell.txCount}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          <ChartFrame
            title="Monthly totals"
            ariaLabel="Monthly totals chart"
            isLoading={query.isLoading}
            isError={Boolean(query.isError)}
            onRetry={() => void query.refetch()}
            isEmpty={monthBars.length === 0}
            minHeight={220}
          >
            <div className="recharts-host" style={{ width: "100%", minWidth: 0, height: 260, minHeight: 260 }}>
              <ResponsiveContainer width="100%" height={260} minWidth={0}>
                <BarChart data={monthBars}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip formatter={(v: unknown) => formatMoney(v as string | number, "USD")} />
                  <Bar dataKey="value" fill="var(--chart-incoming, var(--success))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartFrame>

          <Card>
            <h3 className="muted" style={{ margin: "0 0 0.5rem" }}>
              Due events
            </h3>
            <DataTable
              keyField="date"
              data={query.data.due_events ?? []}
              columns={[
                { id: "date", header: "Date", cell: (r) => r.date },
                { id: "name", header: "Name", cell: (r) => r.expense_name },
                { id: "amount", header: "Amount", cell: (r) => formatMoney(r.amount, r.currency) },
                { id: "paid", header: "Paid", cell: (r) => (r.paid_flag ? "Yes" : "No") },
              ]}
              emptyTitle="No due events in range"
            />
          </Card>

          <Card>
            <h3 className="muted" style={{ margin: "0 0 0.5rem" }}>
              Day drill {selectedDay ? `(${selectedDay})` : ""}
            </h3>
            <DataTable
              keyField="tx_id"
              data={dayDrillRows}
              columns={[
                { id: "date", header: "Date", cell: (r) => r.date },
                { id: "type", header: "Type", cell: (r) => r.tx_type },
                { id: "desc", header: "Description", cell: (r) => r.description || "—" },
                { id: "amt", header: "Amount", cell: (r) => formatMoney(r.amount, r.currency) },
                { id: "src", header: "Source", cell: (r) => r.source || "—" },
              ]}
              emptyTitle="No day drill rows"
            />
          </Card>
        </>
      ) : null}
    </div>
  );
}
