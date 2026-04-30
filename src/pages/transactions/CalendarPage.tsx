import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTransactionsCalendar, listTransactions } from "../../api/transactions";
import { Card } from "../../components/ui/Card";
import { LoadingState } from "../../components/ui/LoadingState";
import { ErrorState } from "../../components/ui/ErrorState";
import { DataTable } from "../../components/ui/DataTable";
import { formatMoney } from "../../lib/money";
import { ChartFrame } from "../../components/dashboard/ChartFrame";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { tr, useLocale } from "../../lib/i18n";

function formatLocalIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseIsoLocal(iso: string): Date {
  const [year, month, day] = iso.split("-").map((part) => Number(part));
  return new Date(year, (month || 1) - 1, day || 1);
}

function monthStartIso(): string {
  const d = new Date();
  return formatLocalIso(new Date(d.getFullYear(), d.getMonth(), 1));
}

function monthEndIso(fromMonthStartIso: string): string {
  const d = parseIsoLocal(fromMonthStartIso);
  return formatLocalIso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

function toNumber(v: unknown): number {
  const normalized =
    typeof v === "string" ? v.replace(/[^0-9.-]/g, "") : v;
  const n = typeof normalized === "string" ? Number(normalized) : typeof normalized === "number" ? normalized : 0;
  return Number.isFinite(n) ? n : 0;
}

function resolveDailyMetric(
  row: Record<string, unknown>,
  mode: "net" | "expense_only" | "count",
): number {
  if (mode === "count") {
    return toNumber(row.tx_count ?? row.count);
  }
  if (mode === "expense_only") {
    if (row.expense_only !== undefined) {
      return toNumber(row.expense_only);
    }
    if (row.heat_value !== undefined) {
      return toNumber(row.heat_value);
    }
    return Math.abs(Math.min(0, toNumber(row.net ?? row.amount)));
  }
  return toNumber(row.net ?? row.amount);
}

function isSameMonth(dateIso: string, baseIso: string): boolean {
  return dateIso.slice(0, 7) === baseIso.slice(0, 7);
}

function monthGridAnchor(startIso: string): Date {
  const d = parseIsoLocal(startIso);
  d.setDate(1);
  const dow = d.getDay();
  d.setDate(d.getDate() - dow);
  return d;
}

function txRowDate(row: { date?: string; created_on?: string }): string {
  if (row.date && row.date.length >= 10) {
    return row.date.slice(0, 10);
  }
  const fallback =
    String((row as Record<string, unknown>).created_on ?? "") ||
    String((row as Record<string, unknown>).created_at ?? "") ||
    String((row as Record<string, unknown>).transaction_date ?? "");
  return fallback.slice(0, 10);
}

export function CalendarPage(): ReactNode {
  const locale = useLocale();
  const [startDate, setStartDate] = useState(monthStartIso());
  const [endDate, setEndDate] = useState(monthEndIso(monthStartIso()));
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
    return rows.filter((r) => txRowDate(r) === selectedDay);
  }, [query.data?.day_drill, selectedDay]);
  const dailyRows = useMemo(() => query.data?.daily ?? [], [query.data?.daily]);
  const monthRows = useMemo(() => query.data?.monthly ?? [], [query.data?.monthly]);
  const selectedDayResolved = useMemo(() => {
    if (selectedDay) return selectedDay;
    return dailyRows[0]?.date ?? "";
  }, [dailyRows, selectedDay]);
  const dueEventsForSelectedDay = useMemo(() => {
    if (!selectedDayResolved) {
      return [];
    }
    return (query.data?.due_events ?? []).filter((row) => row.date === selectedDayResolved);
  }, [query.data?.due_events, selectedDayResolved]);
  const selectedDayTransactionsQuery = useQuery({
    queryKey: ["transactions-by-day", selectedDayResolved] as const,
    queryFn: () => listTransactions({ date: selectedDayResolved }),
    enabled: Boolean(selectedDayResolved),
  });
  const selectedDayTransactions = useMemo(() => {
    if (!selectedDayResolved) {
      return [];
    }
    if ((selectedDayTransactionsQuery.data?.length ?? 0) > 0) {
      return selectedDayTransactionsQuery.data ?? [];
    }
    return dayDrillRows;
  }, [dayDrillRows, selectedDayResolved, selectedDayTransactionsQuery.data]);

  const chartRows = useMemo(() => {
    return dailyRows.map((row) => {
      const rec = row as Record<string, unknown>;
      const metric = resolveDailyMetric(rec, heatMetricMode);
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
    const map = new Map<string, { metric: number; txCount: number; heatIntensity: number }>();
    for (const row of dailyRows) {
      const rec = row as Record<string, unknown>;
      const metric = resolveDailyMetric(rec, heatMetricMode);
      const txCount = toNumber(
        row.tx_count ??
          row.count ??
          rec.transactions ??
          rec.tx_total,
      );
      const heatIntensity = Math.max(0, Math.min(100, toNumber(rec.heat_intensity)));
      map.set(row.date, { metric, txCount, heatIntensity });
    }
    return map;
  }, [dailyRows, heatMetricMode]);

  const heatMax = useMemo(() => {
    const values = Array.from(dailyByDate.values()).map((v) => v.heatIntensity);
    return Math.max(...values, 0);
  }, [dailyByDate]);

  const monthCells = useMemo(() => {
    const anchor = monthGridAnchor(startDate);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(anchor);
      d.setDate(anchor.getDate() + i);
      const iso = formatLocalIso(d);
      const day = d.getDate();
      const inMonth = isSameMonth(iso, startDate);
      const rec = dailyByDate.get(iso);
      const metric = rec?.metric ?? 0;
      const txCount = rec?.txCount ?? 0;
      const normalized = heatMax <= 0 ? 0 : Math.min((rec?.heatIntensity ?? 0) / heatMax, 1);
      const dueCount = (query.data?.due_events ?? []).filter((e) => e.date === iso && !e.paid_flag).length;
      return { iso, day, inMonth, metric, txCount, normalized, dueCount };
    });
  }, [dailyByDate, heatMax, query.data?.due_events, startDate]);
  function shiftMonth(delta: number): void {
    const d = parseIsoLocal(startDate);
    const nextStart = formatLocalIso(new Date(d.getFullYear(), d.getMonth() + delta, 1));
    const nextEnd = monthEndIso(nextStart);
    setStartDate(nextStart);
    setEndDate(nextEnd);
    setSelectedDay(nextStart);
  }

  const monthTitle = useMemo(() => {
    const d = parseIsoLocal(startDate);
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }, [startDate]);


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
      <div className="app-toolbar app-surface">
        <h2 className="muted" style={{ margin: 0, fontSize: "var(--font-xl)" }}>
          {tr("txCalendar.title", locale)}
        </h2>
        <div style={{ display: "flex", gap: 8 }}>
          <Link to="/app/transactions" className="ui-btn ui-btn--secondary">
            {tr("txCalendar.ledger", locale)}
          </Link>
          <Link to="/app/transactions/deep-dive" className="ui-btn ui-btn--secondary">
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
          <label className="ui-field">
            <span className="ui-label">{tr("txCalendar.displayCurrency", locale)}</span>
            <select className="ui-input" value={displayCurrencyMode} onChange={(e) => setDisplayCurrencyMode(e.target.value as "base" | "original")}>
              <option value="base">{tr("common.base", locale)}</option>
              <option value="original">{tr("common.original", locale)}</option>
            </select>
          </label>
          <label className="ui-field">
            <span className="ui-label">{tr("txCalendar.heatMetric", locale)}</span>
            <select className="ui-input" value={heatMetricMode} onChange={(e) => setHeatMetricMode(e.target.value as "net" | "expense_only" | "count")}>
              <option value="net">{tr("common.net", locale)}</option>
              <option value="expense_only">{tr("txCalendar.expenseOnly", locale)}</option>
              <option value="count">{tr("common.count", locale)}</option>
            </select>
          </label>
        </div>
      </Card>

      {query.isLoading ? <LoadingState label={tr("txCalendar.loading", locale)} /> : null}
      {query.isError ? <ErrorState title={tr("txCalendar.loadFailed", locale)} onRetry={() => void query.refetch()} /> : null}

      {query.data ? (
        <>
          <ChartFrame
            title={tr("txCalendar.dailyActivity", locale)}
            ariaLabel={tr("txCalendar.dailyActivityAria", locale)}
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
            <div className="row-between" style={{ marginBottom: "0.75rem" }}>
              <h3 className="muted" style={{ margin: 0 }}>
                Month grid
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button type="button" className="ui-icon-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                  <ChevronLeft size={18} />
                </button>
                <strong>{monthTitle}</strong>
                <button type="button" className="ui-icon-btn" onClick={() => shiftMonth(1)} aria-label="Next month">
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
            <div
              role="grid"
              aria-label={tr("txCalendar.monthGridAria", locale)}
              style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: 6 }}
            >
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="muted-text" style={{ fontSize: "var(--font-sm)", textAlign: "center" }}>
                  {d}
                </div>
              ))}
              {monthCells.map((cell) => {
                const heat = Math.round(8 + cell.normalized * 82);
                const bg = cell.normalized > 0 ? `color-mix(in oklab, var(--danger) ${heat}%, var(--surface))` : "var(--surface)";
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
                    {cell.dueCount > 0 ? (
                      <div style={{ marginTop: 4, display: "grid", gap: 2 }}>
                        {Array.from({ length: Math.min(3, cell.dueCount) }).map((_, idx) => (
                          <span
                            key={`${cell.iso}-${idx}`}
                            style={{
                              display: "block",
                              height: 3,
                              borderRadius: 999,
                              background: "color-mix(in srgb, var(--warn) 82%, var(--surface))",
                            }}
                          />
                        ))}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card>
            <h3 className="muted" style={{ margin: "0 0 0.5rem" }}>
              Day detail {selectedDayResolved ? `(${selectedDayResolved})` : ""}
            </h3>
            <p className="muted-text" style={{ margin: "0 0 0.55rem" }}>
              Transactions: {selectedDayTransactions.length} · Due expenses: {dueEventsForSelectedDay.length}
            </p>
            {selectedDayTransactions.length > 0 ? (
              <div style={{ display: "grid", gap: 6, marginBottom: 8 }}>
                {selectedDayTransactions.slice(0, 4).map((row) => (
                  <div key={row.tx_id} className="tx-badge" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{row.description || row.tx_type}</span>
                    <span>{formatMoney(row.amount, row.currency)}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {dueEventsForSelectedDay.length > 0 ? (
              <div style={{ display: "grid", gap: 6 }}>
                {dueEventsForSelectedDay.map((row) => (
                  <div key={`${row.date}-${row.expense_name}`} className="tx-badge" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{row.expense_name}</span>
                    <span>{formatMoney(row.amount, row.currency)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted-text" style={{ margin: 0 }}>
                No due expenses for this day.
              </p>
            )}
          </Card>

          <ChartFrame
            title={tr("txCalendar.monthlyTotals", locale)}
            ariaLabel={tr("txCalendar.monthlyTotalsAria", locale)}
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
              {tr("txCalendar.dueEvents", locale)}
            </h3>
            <DataTable
              keyField="date"
              data={query.data.due_events ?? []}
              columns={[
                { id: "date", header: tr("common.date", locale), cell: (r) => r.date },
                { id: "name", header: tr("common.name", locale), cell: (r) => r.expense_name },
                { id: "amount", header: tr("common.amount", locale), cell: (r) => formatMoney(r.amount, r.currency) },
                { id: "paid", header: tr("common.paid", locale), cell: (r) => (r.paid_flag ? tr("common.yes", locale) : tr("common.no", locale)) },
              ]}
              emptyTitle={tr("txCalendar.noDueEvents", locale)}
            />
          </Card>

          <Card>
            <h3 className="muted" style={{ margin: "0 0 0.5rem" }}>
              {tr("txCalendar.dayDrill", locale)} {selectedDay ? `(${selectedDay})` : ""}
            </h3>
            <DataTable
              keyField="tx_id"
              data={selectedDayTransactions}
              columns={[
                { id: "date", header: tr("common.date", locale), cell: (r) => r.date },
                { id: "type", header: tr("common.type", locale), cell: (r) => r.tx_type },
                { id: "desc", header: tr("common.description", locale), cell: (r) => r.description || "—" },
                { id: "amt", header: tr("common.amount", locale), cell: (r) => formatMoney(r.amount, r.currency) },
                { id: "src", header: tr("common.source", locale), cell: (r) => r.source || "—" },
              ]}
              emptyTitle={tr("txCalendar.noDayDrill", locale)}
            />
          </Card>
        </>
      ) : null}
    </div>
  );
}
