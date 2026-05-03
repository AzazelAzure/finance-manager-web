import { useMemo, useState, type ReactNode } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { DataTable, type ColumnDef } from "../../components/ui/DataTable";
import { ErrorState } from "../../components/ui/ErrorState";
import { LoadingState } from "../../components/ui/LoadingState";
import { Modal } from "../../components/ui/Modal";
import {
  createUpcomingExpense,
  deleteUpcomingExpense,
  listUpcomingExpenses,
  updateUpcomingExpense,
} from "../../api/upcomingExpenses";
import { listSourceNames } from "../../api/lookups";
import { getAppProfile } from "../../api/profile";
import { isOfflineQueued, type UpcomingExpenseMutationPayload, type UpcomingExpenseRecord } from "../../api/types";
import { formatMoney } from "../../lib/money";
import { useBreakpoint } from "../../lib/breakpoints";
import { tr, useLocale } from "../../lib/i18n";
import { readOptsFromQuery, requestPwaReadBypassAfterMutation } from "../../offline/pwaReadBypass";

type RecurringFilter = "both" | "yes" | "no";
type PaidFilter = "both" | "yes" | "no";
type DateQuickFilter = "all" | "this_month" | "next_month" | "overdue";

type UpcomingDraft = {
  name: string;
  amount: string;
  currency: string;
  due_date: string;
  source: string;
  paid_flag: boolean;
  recurring_flag: boolean;
  use_start_end: boolean;
  start_date: string;
  end_date: string;
};

/** New bills default to profile base currency; options match transaction editor (source currencies + base). */
function emptyUpcomingDraft(baseCurrency: string): UpcomingDraft {
  const c = baseCurrency.trim().toUpperCase() || "USD";
  return {
    name: "",
    amount: "",
    currency: c,
    due_date: new Date().toISOString().slice(0, 10),
    source: "",
    paid_flag: false,
    recurring_flag: false,
    use_start_end: false,
    start_date: "",
    end_date: "",
  };
}

function parseError(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : "Request failed.";
  }
  const status = error.response?.status;
  const data = error.response?.data;
  if (data && typeof data === "object") {
    const parts = Object.entries(data as Record<string, unknown>).map(([k, v]) => `${k}: ${String(v)}`);
    if (parts.length > 0) {
      return status ? `HTTP ${status}: ${parts.join(" | ")}` : parts.join(" | ");
    }
  }
  if (typeof data === "string" && data.trim()) {
    return status ? `HTTP ${status}: ${data}` : data;
  }
  return status ? `HTTP ${status}: Request rejected.` : error.message;
}

function toPayload(draft: UpcomingDraft): UpcomingExpenseMutationPayload {
  const payload: UpcomingExpenseMutationPayload = {
    name: draft.name.trim(),
    amount: draft.amount,
    currency: draft.currency.trim().toUpperCase(),
    due_date: draft.due_date,
    paid_flag: draft.paid_flag,
    is_recurring: draft.recurring_flag,
  };
  if (draft.source.trim()) {
    payload.source = draft.source.trim();
  }
  if (draft.use_start_end) {
    if (draft.start_date) payload.start_date = draft.start_date;
    if (draft.end_date) payload.end_date = draft.end_date;
  }
  return payload;
}

function monthRange(offsetMonths: number): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + offsetMonths;
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export function UpcomingExpensesPage(): ReactNode {
  const locale = useLocale();
  const { atOrAboveMd } = useBreakpoint();
  const queryClient = useQueryClient();
  const [recurring, setRecurring] = useState<RecurringFilter>("both");
  const [paid, setPaid] = useState<PaidFilter>("both");
  const [dateQuick, setDateQuick] = useState<DateQuickFilter>("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [draft, setDraft] = useState<UpcomingDraft>(() => emptyUpcomingDraft("USD"));
  const [editorError, setEditorError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Record<string, boolean>>({});

  const upcomingQuery = useQuery({
    queryKey: ["upcoming-expenses", "all"] as const,
    queryFn: (ctx) => listUpcomingExpenses(readOptsFromQuery(ctx)),
    placeholderData: keepPreviousData,
  });

  const profileQuery = useQuery({
    queryKey: ["app-profile"] as const,
    queryFn: (ctx) => getAppProfile(readOptsFromQuery(ctx)),
  });
  const sourcesQuery = useQuery({
    queryKey: ["sources", "all"] as const,
    queryFn: (ctx) => listSourceNames(readOptsFromQuery(ctx)),
  });
  const baseCurrency = (profileQuery.data?.base_currency ?? "USD").trim().toUpperCase() || "USD";
  const sourceCurrencyOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of sourcesQuery.data ?? []) {
      const normalized = String(row.currency ?? "").trim().toUpperCase();
      if (normalized) {
        set.add(normalized);
      }
    }
    set.add(baseCurrency);
    return [...set].sort();
  }, [baseCurrency, sourcesQuery.data]);
  const currencyOptions = sourceCurrencyOptions.length > 0 ? sourceCurrencyOptions : [baseCurrency];
  const draftCurrency = draft.currency.trim().toUpperCase();
  const currencySelectOptions = useMemo(() => {
    const set = new Set(currencyOptions);
    if (draftCurrency.length === 3) {
      set.add(draftCurrency);
    }
    return [...set].sort();
  }, [currencyOptions, draftCurrency]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = toPayload(draft);
      if (editingName) {
        const u = await updateUpcomingExpense(editingName, payload);
        if (isOfflineQueued(u)) {
          return;
        }
      } else {
        const c = await createUpcomingExpense(payload);
        if (isOfflineQueued(c)) {
          return;
        }
      }
    },
    onMutate: () => setEditorError(""),
    onSuccess: () => {
      requestPwaReadBypassAfterMutation();
      void queryClient.invalidateQueries({ queryKey: ["upcoming-expenses"], refetchType: "all" });
      void queryClient.invalidateQueries({ queryKey: ["snapshot"], refetchType: "all" });
      void queryClient.invalidateQueries({ queryKey: ["upcoming-expenses", "unpaid-names"], refetchType: "all" });
      setEditorOpen(false);
      setEditingName(null);
      setDraft(emptyUpcomingDraft(baseCurrency));
    },
    onError: (err) => setEditorError(parseError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (name: string) => {
      const r = await deleteUpcomingExpense(name);
      if (isOfflineQueued(r)) {
        return "queued" as const;
      }
      return "ok" as const;
    },
    onSuccess: () => {
      requestPwaReadBypassAfterMutation();
      void queryClient.invalidateQueries({ queryKey: ["upcoming-expenses"], refetchType: "all" });
      void queryClient.invalidateQueries({ queryKey: ["snapshot"], refetchType: "all" });
      void queryClient.invalidateQueries({ queryKey: ["upcoming-expenses", "unpaid-names"], refetchType: "all" });
    },
  });

  const filteredRows = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const thisMonth = monthRange(0);
    const nextMonth = monthRange(1);
    return (upcomingQuery.data ?? []).filter((row) => {
      if (recurring === "yes" && !row.recurring_flag) return false;
      if (recurring === "no" && row.recurring_flag) return false;
      if (paid === "yes" && !row.paid_flag) return false;
      if (paid === "no" && row.paid_flag) return false;
      if (dateQuick === "this_month") {
        return row.due_date >= thisMonth.start && row.due_date <= thisMonth.end;
      }
      if (dateQuick === "next_month") {
        return row.due_date >= nextMonth.start && row.due_date <= nextMonth.end;
      }
      if (dateQuick === "overdue") {
        return row.due_date < today && !row.paid_flag;
      }
      return true;
    });
  }, [dateQuick, paid, recurring, upcomingQuery.data]);

  const columns = useMemo<Array<ColumnDef<UpcomingExpenseRecord>>>(
    () => [
      { id: "name", header: "Name", cell: (r) => r.name, sortValue: (r) => r.name },
      { id: "amt", header: "Amount", cell: (r) => formatMoney(r.amount, r.currency) },
      { id: "due", header: "Due date", cell: (r) => r.due_date, sortValue: (r) => r.due_date },
      {
        id: "paid",
        header: "Paid",
        cell: (r) => <span className="tx-badge">{r.paid_flag ? "Paid" : "Unpaid"}</span>,
      },
      {
        id: "recurring",
        header: "Recurring",
        cell: (r) => <span className="tx-badge">{r.recurring_flag ? "Recurring" : "One-time"}</span>,
      },
      { id: "source", header: "Source", cell: (r) => r.source || "—" },
      {
        id: "actions",
        header: "Actions",
        cell: (r) => {
          const isConfirm = Boolean(pendingDelete[r.name]);
          return (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="ui-btn ui-btn--secondary"
                onClick={() => {
                  setEditingName(r.name);
                  const cur = String(r.currency ?? "")
                    .trim()
                    .toUpperCase();
                  setDraft({
                    name: r.name,
                    amount: String(r.amount),
                    currency: cur.length === 3 ? cur : baseCurrency,
                    due_date: r.due_date,
                    source: r.source || "",
                    paid_flag: r.paid_flag,
                    recurring_flag: r.recurring_flag,
                    use_start_end: Boolean(r.start_date || r.end_date),
                    start_date: r.start_date || "",
                    end_date: r.end_date || "",
                  });
                  setEditorError("");
                  setEditorOpen(true);
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="ui-btn ui-btn--ghost"
                onClick={() => {
                  if (!isConfirm) {
                    setPendingDelete((prev) => ({ ...prev, [r.name]: true }));
                    return;
                  }
                  deleteMutation.mutate(r.name);
                }}
              >
                {isConfirm ? "Confirm delete?" : "Delete"}
              </button>
            </div>
          );
        },
      },
    ],
    [baseCurrency, deleteMutation, pendingDelete],
  );

  const invalidWindow = Boolean(
    draft.use_start_end && draft.start_date && draft.end_date && draft.end_date < draft.start_date,
  );
  const invalidAmount = !draft.amount || Number.isNaN(Number(draft.amount)) || Number(draft.amount) <= 0;
  const isSaveDisabled =
    saveMutation.isPending ||
    !draft.name.trim() ||
    !draft.due_date ||
    !draft.currency.trim() ||
    draft.currency.trim().length !== 3 ||
    invalidAmount ||
    invalidWindow;

  return (
    <div className="stack">
      <div className="app-toolbar app-surface">
        <h2 className="muted" style={{ margin: 0, fontSize: "var(--font-xl)" }}>
          {tr("upcoming.title", locale)}
        </h2>
        <div className="app-toolbar__actions">
          <Link className="ui-btn ui-btn--secondary" to="/app/upcoming-expenses/deep-dive">
            {tr("txCalendar.deepDive", locale)}
          </Link>
          <Button
            onClick={() => {
              setEditingName(null);
              setDraft(emptyUpcomingDraft(baseCurrency));
              setEditorError("");
              setEditorOpen(true);
            }}
          >
            {tr("upcoming.addBill", locale)}
          </Button>
        </div>
      </div>

      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
          <label className="ui-field">
            <span className="ui-label">{tr("upcoming.recurring", locale)}</span>
            <select className="ui-input" value={recurring} onChange={(e) => setRecurring(e.target.value as RecurringFilter)}>
              <option value="both">{tr("common.both", locale)}</option>
              <option value="yes">{tr("upcoming.recurringOnly", locale)}</option>
              <option value="no">{tr("upcoming.oneTimeOnly", locale)}</option>
            </select>
          </label>
          <label className="ui-field">
            <span className="ui-label">{tr("common.paid", locale)}</span>
            <select className="ui-input" value={paid} onChange={(e) => setPaid(e.target.value as PaidFilter)}>
              <option value="both">{tr("common.both", locale)}</option>
              <option value="yes">{tr("common.paid", locale)}</option>
              <option value="no">{tr("common.unpaid", locale)}</option>
            </select>
          </label>
          <label className="ui-field">
            <span className="ui-label">{tr("upcoming.dateQuick", locale)}</span>
            <select className="ui-input" value={dateQuick} onChange={(e) => setDateQuick(e.target.value as DateQuickFilter)}>
              <option value="all">{tr("common.all", locale)}</option>
              <option value="this_month">{tr("upcoming.thisMonth", locale)}</option>
              <option value="next_month">{tr("upcoming.nextMonth", locale)}</option>
              <option value="overdue">{tr("upcoming.overdue", locale)}</option>
            </select>
          </label>
        </div>
      </Card>

      {upcomingQuery.isError ? (
        <ErrorState title={tr("upcoming.failedLoad", locale)} onRetry={() => void upcomingQuery.refetch()} />
      ) : upcomingQuery.isLoading && !upcomingQuery.data ? (
        <LoadingState label={tr("upcoming.loading", locale)} />
      ) : atOrAboveMd ? (
        <Card>
          <DataTable columns={columns} data={filteredRows} keyField="name" emptyTitle={tr("upcoming.empty", locale)} />
        </Card>
      ) : (
        <div className="stack">
          {filteredRows.length === 0 ? (
            <Card>
              <p className="muted-text" style={{ margin: 0 }}>
                {tr("upcoming.empty", locale)}
              </p>
            </Card>
          ) : (
            filteredRows.map((row) => {
              const isConfirm = Boolean(pendingDelete[row.name]);
              return (
                <Card key={row.name}>
                  <div className="stack" style={{ gap: 8 }}>
                    <div className="row-between">
                      <strong>{row.name}</strong>
                      <span>{formatMoney(row.amount, row.currency)}</span>
                    </div>
                    <div className="row-between">
                      <span className="muted-text">{tr("upcoming.due", locale)} {row.due_date}</span>
                      <span className="tx-badge">{row.paid_flag ? tr("common.paid", locale) : tr("common.unpaid", locale)}</span>
                    </div>
                    <div className="row-between">
                      <span className="tx-badge">{row.recurring_flag ? tr("upcoming.recurring", locale) : tr("upcoming.oneTime", locale)}</span>
                      <span className="muted-text">{row.source || tr("upcoming.noSource", locale)}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        className="ui-btn ui-btn--secondary"
                        onClick={() => {
                          setEditingName(row.name);
                          const cur = String(row.currency ?? "")
                            .trim()
                            .toUpperCase();
                          setDraft({
                            name: row.name,
                            amount: String(row.amount),
                            currency: cur.length === 3 ? cur : baseCurrency,
                            due_date: row.due_date,
                            source: row.source || "",
                            paid_flag: row.paid_flag,
                            recurring_flag: row.recurring_flag,
                            use_start_end: Boolean(row.start_date || row.end_date),
                            start_date: row.start_date || "",
                            end_date: row.end_date || "",
                          });
                          setEditorError("");
                          setEditorOpen(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="ui-btn ui-btn--ghost"
                        onClick={() => {
                          if (!isConfirm) {
                            setPendingDelete((prev) => ({ ...prev, [row.name]: true }));
                            return;
                          }
                          deleteMutation.mutate(row.name);
                        }}
                      >
                        {isConfirm ? "Confirm delete?" : "Delete"}
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      <Modal
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setEditorError("");
        }}
        title={editingName ? tr("upcoming.editExpense", locale) : tr("upcoming.addExpense", locale)}
      >
        <div className="stack" style={{ marginTop: 12 }}>
          {editorError ? <ErrorState title={tr("common.saveFailed", locale)} description={editorError} /> : null}
          {(invalidAmount || invalidWindow) && !saveMutation.isPending ? (
            <div className="ui-state" role="status">
              <p className="muted-text" style={{ margin: 0 }}>
                {invalidWindow
                  ? tr("upcoming.invalidWindow", locale)
                  : tr("upcoming.invalidAmount", locale)}
              </p>
            </div>
          ) : null}
          <label className="ui-field">
            <span className="ui-label">Name</span>
            <input className="ui-input" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
          </label>
          <label className="ui-field">
            <span className="ui-label">Amount</span>
            <input className="ui-input" value={draft.amount} onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))} />
          </label>
          <label className="ui-field">
            <span className="ui-label">Currency</span>
            <select
              className="ui-input"
              value={currencySelectOptions.includes(draftCurrency) ? draftCurrency : currencySelectOptions[0] ?? baseCurrency}
              onChange={(e) => setDraft((d) => ({ ...d, currency: e.target.value }))}
            >
              {currencySelectOptions.map((curr) => (
                <option key={curr} value={curr}>
                  {curr}
                </option>
              ))}
            </select>
          </label>
          <label className="ui-field">
            <span className="ui-label">Due date</span>
            <input
              type="date"
              className="ui-input"
              value={draft.due_date}
              onChange={(e) => setDraft((d) => ({ ...d, due_date: e.target.value }))}
            />
          </label>
          <label className="ui-field">
            <span className="ui-label">Source (optional)</span>
            <input className="ui-input" value={draft.source} onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))} />
          </label>
          <label className="ui-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={draft.recurring_flag}
              onChange={(e) => setDraft((d) => ({ ...d, recurring_flag: e.target.checked }))}
            />
            <span className="ui-label">Recurring</span>
          </label>
          <label className="ui-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={draft.paid_flag}
              onChange={(e) => setDraft((d) => ({ ...d, paid_flag: e.target.checked }))}
            />
            <span className="ui-label">Marked paid</span>
          </label>
          <label className="ui-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={draft.use_start_end}
              onChange={(e) => setDraft((d) => ({ ...d, use_start_end: e.target.checked }))}
            />
            <span className="ui-label">Use start / end window</span>
          </label>
          {draft.use_start_end ? (
            <>
              <label className="ui-field">
                <span className="ui-label">Start date</span>
                <input
                  type="date"
                  className="ui-input"
                  value={draft.start_date}
                  onChange={(e) => setDraft((d) => ({ ...d, start_date: e.target.value }))}
                />
              </label>
              <label className="ui-field">
                <span className="ui-label">End date</span>
                <input
                  type="date"
                  className="ui-input"
                  value={draft.end_date}
                  onChange={(e) => setDraft((d) => ({ ...d, end_date: e.target.value }))}
                />
              </label>
            </>
          ) : null}
          <Button disabled={isSaveDisabled} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? "Saving..." : editingName ? "Save changes" : "Create"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
