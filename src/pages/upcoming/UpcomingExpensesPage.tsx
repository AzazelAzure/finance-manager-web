import { useEffect, useMemo, useState, type ReactNode } from "react";
import { HelpModeWrapper, useTour } from "../../components/tours/TourProvider";
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
  catchUpUpcomingExpense,
  deleteUpcomingExpense,
  listUpcomingExpenses,
  updateUpcomingExpense,
} from "../../api/upcomingExpenses";
import { listSourceNames } from "../../api/lookups";
import { getAppProfile } from "../../api/profile";
import { isOfflineQueued, type AppProfileResponse, type UpcomingExpenseMutationPayload, type UpcomingExpenseRecord } from "../../api/types";
import { formatMoney } from "../../lib/money";
import { useBreakpoint } from "../../lib/breakpoints";
import { tr, trFmt, useLocale } from "../../lib/i18n";
import { estimateMissedPeriods, isOverdueUnpaid } from "../../lib/billRecurrence";
import { readOptsFromQuery, requestPwaReadBypassAfterMutation } from "../../offline/pwaReadBypass";

const UPCOMING_EXPENSES_TOUR_STEPS = [
  {
    target: "#upcoming-list",
    title: "Upcoming Obligations",
    content: "Upcoming Obligations — View your upcoming bills and scheduled transfers here.",
    disableBeacon: true,
  },
  {
    target: "#upcoming-add",
    title: "Schedule New",
    content: "Schedule New — Add a future expense or recurring bill.",
  },
] as const;

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
  bill_class: "rigid" | "volatile";
  use_partial_payment: boolean;
  planned_partial_amount: string;
  cycle_residual_amount: string;
  remainder_due_date: string;
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
    bill_class: "rigid",
    use_partial_payment: false,
    planned_partial_amount: "",
    cycle_residual_amount: "",
    remainder_due_date: "",
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
    bill_class: draft.bill_class,
  };
  if (draft.use_partial_payment) {
    payload.planned_partial_amount = draft.planned_partial_amount || null;
    payload.cycle_residual_amount = draft.cycle_residual_amount || null;
    payload.remainder_due_date = draft.remainder_due_date || null;
  } else {
    payload.planned_partial_amount = null;
    payload.cycle_residual_amount = null;
    payload.remainder_due_date = null;
  }
  if (draft.source.trim()) {
    payload.source = draft.source.trim();
  }
  if (draft.use_start_end) {
    if (draft.start_date) payload.start_date = draft.start_date;
    if (draft.end_date) payload.end_date = draft.end_date;
  }
  return payload;
}

function draftFromRow(row: UpcomingExpenseRecord, baseCurrency: string): UpcomingDraft {
  const cur = String(row.currency ?? "")
    .trim()
    .toUpperCase();
  const hasPartialPlan = Boolean(row.planned_partial_amount || row.cycle_residual_amount || row.remainder_due_date);
  return {
    name: row.name,
    amount: String(row.amount),
    currency: cur.length === 3 ? cur : baseCurrency,
    due_date: row.due_date,
    source: row.source || "",
    paid_flag: row.paid_flag,
    recurring_flag: row.recurring_flag,
    bill_class: row.bill_class === "volatile" ? "volatile" : "rigid",
    use_partial_payment: hasPartialPlan,
    planned_partial_amount: row.planned_partial_amount ? String(row.planned_partial_amount) : "",
    cycle_residual_amount: row.cycle_residual_amount ? String(row.cycle_residual_amount) : "",
    remainder_due_date: row.remainder_due_date || "",
    use_start_end: Boolean(row.start_date || row.end_date),
    start_date: row.start_date || "",
    end_date: row.end_date || "",
  };
}

function hasPartialPlan(row: UpcomingExpenseRecord): boolean {
  return Boolean(row.planned_partial_amount || row.cycle_residual_amount || row.remainder_due_date);
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

function currentPayCycleRange(profile: AppProfileResponse): { start: string; end: string } | null {
  if (profile.sts_window_mode !== "pay_cycle" || !profile.pay_cycle_anchor_date || !profile.pay_cycle_frequency) {
    return null;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let start = parseDateLocal(profile.pay_cycle_anchor_date);
  let end = addPayCycleStep(start, profile.pay_cycle_frequency);
  while (today < start) {
    end = start;
    start = subtractPayCycleStep(start, profile.pay_cycle_frequency);
  }
  while (today >= end) {
    start = end;
    end = addPayCycleStep(end, profile.pay_cycle_frequency);
  }
  return { start: formatDateLocal(start), end: formatDateLocal(new Date(end.getTime() - 86400000)) };
}

function parseDateLocal(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function formatDateLocal(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addPayCycleStep(value: Date, frequency: NonNullable<AppProfileResponse["pay_cycle_frequency"]>): Date {
  const next = new Date(value);
  if (frequency === "weekly") next.setDate(next.getDate() + 7);
  if (frequency === "biweekly") next.setDate(next.getDate() + 14);
  if (frequency === "semimonthly") next.setDate(next.getDate() + 15);
  if (frequency === "monthly") next.setMonth(next.getMonth() + 1);
  return next;
}

function subtractPayCycleStep(value: Date, frequency: NonNullable<AppProfileResponse["pay_cycle_frequency"]>): Date {
  const next = new Date(value);
  if (frequency === "weekly") next.setDate(next.getDate() - 7);
  if (frequency === "biweekly") next.setDate(next.getDate() - 14);
  if (frequency === "semimonthly") next.setDate(next.getDate() - 15);
  if (frequency === "monthly") next.setMonth(next.getMonth() - 1);
  return next;
}

export function UpcomingExpensesPage(): ReactNode {
  const locale = useLocale();
  const { atOrAboveMd } = useBreakpoint();
  const queryClient = useQueryClient();
  const [recurring, setRecurring] = useState<RecurringFilter>("both");
  const [paid, setPaid] = useState<PaidFilter>("both");
  const [dateQuick, setDateQuick] = useState<DateQuickFilter>("all");
  const { startTour, isTourCompleted } = useTour();
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
  const payCycleRange = profileQuery.data ? currentPayCycleRange(profileQuery.data) : null;
  const primaryDateFilterLabel = payCycleRange ? tr("upcoming.thisPayPeriod", locale) : tr("upcoming.thisMonth", locale);

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

  const catchUpMutation = useMutation({
    mutationFn: async ({ name, periods }: { name: string; periods?: number }) => catchUpUpcomingExpense(name, periods),
    onSuccess: () => {
      requestPwaReadBypassAfterMutation();
      void queryClient.invalidateQueries({ queryKey: ["upcoming-expenses"], refetchType: "all" });
      void queryClient.invalidateQueries({ queryKey: ["snapshot"], refetchType: "all" });
      void queryClient.invalidateQueries({ queryKey: ["upcoming-expenses", "unpaid-names"], refetchType: "all" });
    },
  });

  function renderOverdueActions(row: UpcomingExpenseRecord): ReactNode {
    if (!isOverdueUnpaid(row)) {
      return null;
    }
    const missed = estimateMissedPeriods(row);
    return (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button
          type="button"
          variant="secondary"
          disabled={catchUpMutation.isPending}
          onClick={() => catchUpMutation.mutate({ name: row.name, periods: 1 })}
        >
          {tr("upcoming.markPaidAdvance", locale)}
        </Button>
        {missed > 1 ? (
          <Button
            type="button"
            variant="secondary"
            disabled={catchUpMutation.isPending}
            onClick={() => catchUpMutation.mutate({ name: row.name })}
          >
            {trFmt("upcoming.catchUpPeriods", locale, { count: missed })}
          </Button>
        ) : null}
      </div>
    );
  }

  const filteredRows = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const thisMonth = monthRange(0);
    const nextMonth = monthRange(1);
    const currentRange = payCycleRange ?? thisMonth;
    return (upcomingQuery.data ?? []).filter((row) => {
      if (recurring === "yes" && !row.recurring_flag) return false;
      if (recurring === "no" && row.recurring_flag) return false;
      if (paid === "yes" && !row.paid_flag) return false;
      if (paid === "no" && row.paid_flag) return false;
      if (dateQuick === "this_month") {
        return row.due_date >= currentRange.start && row.due_date <= currentRange.end;
      }
      if (dateQuick === "next_month") {
        return row.due_date >= nextMonth.start && row.due_date <= nextMonth.end;
      }
      if (dateQuick === "overdue") {
        return row.due_date < today && !row.paid_flag;
      }
      return true;
    });
  }, [dateQuick, paid, payCycleRange, recurring, upcomingQuery.data]);

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
      {
        id: "bill-plan",
        header: "Plan",
        cell: (r) =>
          r.bill_class === "volatile" || hasPartialPlan(r) ? (
            <span className="tx-badge">
              {r.bill_class === "volatile" ? tr("upcoming.billClass.volatile", locale) : tr("upcoming.billClass.rigid", locale)}
              {hasPartialPlan(r) && r.planned_partial_amount
                ? ` · ${tr("upcoming.partialPlan.short", locale)} ${formatMoney(r.planned_partial_amount, r.currency)}`
                : ""}
            </span>
          ) : (
            <span className="muted-text">—</span>
          ),
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
                  setDraft(draftFromRow(r, baseCurrency));
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
              {renderOverdueActions(r)}
            </div>
          );
        },
      },
    ],
    [baseCurrency, deleteMutation, locale, pendingDelete],
  );

  const invalidWindow = Boolean(
    draft.use_start_end && draft.start_date && draft.end_date && draft.end_date < draft.start_date,
  );
  const invalidAmount = !draft.amount || Number.isNaN(Number(draft.amount)) || Number(draft.amount) <= 0;
  const hasAnyPartialField = Boolean(
    draft.planned_partial_amount || draft.cycle_residual_amount || draft.remainder_due_date,
  );
  const plannedPartialValue = Number(draft.planned_partial_amount);
  const invalidPartialAmount = Boolean(
    draft.use_partial_payment &&
      (!hasAnyPartialField ||
        (draft.planned_partial_amount &&
          (Number.isNaN(plannedPartialValue) ||
            plannedPartialValue <= 0 ||
            plannedPartialValue > Number(draft.amount || 0)))),
  );
  const isSaveDisabled =
    saveMutation.isPending ||
    !draft.name.trim() ||
    !draft.due_date ||
    !draft.currency.trim() ||
    draft.currency.trim().length !== 3 ||
    invalidAmount ||
    invalidPartialAmount ||
    invalidWindow;

  useEffect(() => {
    if (!upcomingQuery.isSuccess) {
      return;
    }
    if (isTourCompleted("upcoming_expenses_tour")) {
      return;
    }
    const timer = setTimeout(() => {
      startTour("upcoming_expenses_tour", [...UPCOMING_EXPENSES_TOUR_STEPS] as any);
    }, 500);
    return () => clearTimeout(timer);
  }, [upcomingQuery.isSuccess, isTourCompleted, startTour]);

  return (
    <div className="stack">
      <div className="app-toolbar app-surface">
        <h2 className="muted" style={{ margin: 0, fontSize: "var(--font-xl)" }}>
          {tr("upcoming.title", locale)}
        </h2>
        <div className="app-toolbar__actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => startTour("upcoming_expenses_tour", [...UPCOMING_EXPENSES_TOUR_STEPS] as any, true)}
          >
            {tr("tour.replayTour", locale)}
          </Button>
          <Link className="ui-btn ui-btn--secondary" to="/app/upcoming-expenses/deep-dive">
            {tr("txCalendar.deepDive", locale)}
          </Link>
          <Button
            id="upcoming-add"
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

      <HelpModeWrapper id="upcoming-filters" title={tr("guide.upcoming.filters.title", locale)} content={tr("guide.upcoming.filters.content", locale)}>
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
              <option value="this_month">{primaryDateFilterLabel}</option>
              <option value="next_month">{tr("upcoming.nextMonth", locale)}</option>
              <option value="overdue">{tr("upcoming.overdue", locale)}</option>
            </select>
          </label>
        </div>
      </Card>
      </HelpModeWrapper>

      <HelpModeWrapper id="upcoming-list-wrap" title={tr("guide.upcoming.list.title", locale)} content={tr("guide.upcoming.list.content", locale)}>
      <div id="upcoming-list">
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
                      {row.bill_class === "volatile" || hasPartialPlan(row) ? (
                        <p className="muted-text" style={{ margin: 0 }}>
                          {row.bill_class === "volatile" ? tr("upcoming.billClass.volatile", locale) : tr("upcoming.billClass.rigid", locale)}
                          {hasPartialPlan(row) && row.planned_partial_amount
                            ? ` · ${tr("upcoming.partialPlan.short", locale)} ${formatMoney(row.planned_partial_amount, row.currency)}`
                            : ""}
                        </p>
                      ) : null}
                      {isOverdueUnpaid(row) ? (
                        <p className="muted-text" style={{ margin: 0 }}>
                          {tr("upcoming.overdueLabel", locale)}
                        </p>
                      ) : null}
                      {renderOverdueActions(row)}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          className="ui-btn ui-btn--secondary"
                          onClick={() => {
                            setEditingName(row.name);
                            setDraft(draftFromRow(row, baseCurrency));
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
      </div>
      </HelpModeWrapper>

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
          {(invalidAmount || invalidWindow || invalidPartialAmount) && !saveMutation.isPending ? (
            <div className="ui-state" role="status">
              <p className="muted-text" style={{ margin: 0 }}>
                {invalidWindow
                  ? tr("upcoming.invalidWindow", locale)
                  : invalidPartialAmount
                    ? tr("upcoming.invalidPartialAmount", locale)
                    : tr("upcoming.invalidAmount", locale)}
              </p>
            </div>
          ) : null}
          <HelpModeWrapper id="bill-form-name" title={tr("guide.form.billName.title", locale)} content={tr("guide.form.billName.content", locale)}>
            <label className="ui-field">
              <span className="ui-label">{tr("upcoming.editor.label.name", locale)}</span>
              <input className="ui-input" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
            </label>
          </HelpModeWrapper>
          <HelpModeWrapper id="bill-form-amount" title={tr("guide.form.amount.title", locale)} content={tr("guide.form.amount.content", locale)}>
            <label className="ui-field">
              <span className="ui-label">{tr("upcoming.editor.label.amount", locale)}</span>
              <input className="ui-input" value={draft.amount} onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))} />
            </label>
          </HelpModeWrapper>
          <label className="ui-field">
            <span className="ui-label">{tr("upcoming.editor.label.billClass", locale)}</span>
            <select
              className="ui-input"
              value={draft.bill_class}
              onChange={(e) => setDraft((d) => ({ ...d, bill_class: e.target.value as "rigid" | "volatile" }))}
            >
              <option value="rigid">{tr("upcoming.billClass.rigid", locale)}</option>
              <option value="volatile">{tr("upcoming.billClass.volatile", locale)}</option>
            </select>
            <span className="muted-text" style={{ fontSize: "var(--font-xs)" }}>
              {draft.bill_class === "volatile"
                ? tr("upcoming.billClass.volatileHint", locale)
                : tr("upcoming.billClass.rigidHint", locale)}
            </span>
          </label>
          <label className="ui-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={draft.use_partial_payment}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  use_partial_payment: e.target.checked,
                  planned_partial_amount: e.target.checked ? d.planned_partial_amount : "",
                  cycle_residual_amount: e.target.checked ? d.cycle_residual_amount : "",
                  remainder_due_date: e.target.checked ? d.remainder_due_date : "",
                }))
              }
            />
            <span className="ui-label">{tr("upcoming.partialPlan.toggle", locale)}</span>
          </label>
          {draft.use_partial_payment ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
              <label className="ui-field">
                <span className="ui-label">{tr("upcoming.partialPlan.plannedAmount", locale)}</span>
                <input
                  className="ui-input"
                  value={draft.planned_partial_amount}
                  onChange={(e) => setDraft((d) => ({ ...d, planned_partial_amount: e.target.value }))}
                />
              </label>
              <label className="ui-field">
                <span className="ui-label">{tr("upcoming.partialPlan.residualAmount", locale)}</span>
                <input
                  className="ui-input"
                  value={draft.cycle_residual_amount}
                  onChange={(e) => setDraft((d) => ({ ...d, cycle_residual_amount: e.target.value }))}
                />
              </label>
              <label className="ui-field">
                <span className="ui-label">{tr("upcoming.partialPlan.remainderDue", locale)}</span>
                <input
                  className="ui-input"
                  type="date"
                  value={draft.remainder_due_date}
                  onChange={(e) => setDraft((d) => ({ ...d, remainder_due_date: e.target.value }))}
                />
              </label>
            </div>
          ) : null}
          <HelpModeWrapper id="bill-form-currency" title={tr("guide.form.currency.title", locale)} content={tr("guide.form.currency.content", locale)}>
            <label className="ui-field">
              <span className="ui-label">{tr("upcoming.editor.label.currency", locale)}</span>
              <select className="ui-input" value={draft.currency} onChange={(e) => setDraft((d) => ({ ...d, currency: e.target.value }))}>
                {currencyOptions.map((curr) => (
                  <option key={`bill-curr-${curr}`} value={curr}>
                    {curr}
                  </option>
                ))}
              </select>
            </label>
          </HelpModeWrapper>
          <HelpModeWrapper id="bill-form-date" title={tr("guide.form.dueDate.title", locale)} content={tr("guide.form.dueDate.content", locale)}>
            <label className="ui-field">
              <span className="ui-label">{tr("upcoming.editor.label.dueDate", locale)}</span>
              <input className="ui-input" type="date" value={draft.due_date} onChange={(e) => setDraft((d) => ({ ...d, due_date: e.target.value }))} />
            </label>
          </HelpModeWrapper>
          <HelpModeWrapper id="bill-form-source" title={tr("guide.form.source.title", locale)} content={tr("guide.form.source.content", locale)}>
            <label className="ui-field">
              <span className="ui-label">{tr("form.label.sourceOptional", locale)}</span>
              <input className="ui-input" value={draft.source} onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))} />
            </label>
          </HelpModeWrapper>
          <HelpModeWrapper id="bill-form-recurring" title={tr("guide.form.recurring.title", locale)} content={tr("guide.form.recurring.content", locale)}>
            <label className="ui-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={draft.recurring_flag}
                onChange={(e) => setDraft((d) => ({ ...d, recurring_flag: e.target.checked }))}
              />
              <span className="ui-label">{tr("upcoming.recurring", locale)}</span>
            </label>
          </HelpModeWrapper>
          <HelpModeWrapper id="bill-form-paid" title={tr("guide.form.paid.title", locale)} content={tr("guide.form.paid.content", locale)}>
            <label className="ui-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={draft.paid_flag}
                onChange={(e) => setDraft((d) => ({ ...d, paid_flag: e.target.checked }))}
              />
              <span className="ui-label">{tr("form.label.markedPaid", locale)}</span>
            </label>
          </HelpModeWrapper>
          <HelpModeWrapper id="bill-form-window-toggle" title={tr("guide.form.window.title", locale)} content={tr("guide.form.window.content", locale)}>
            <label className="ui-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={draft.use_start_end}
                onChange={(e) => setDraft((d) => ({ ...d, use_start_end: e.target.checked }))}
              />
              <span className="ui-label">{tr("form.label.useDateWindow", locale)}</span>
            </label>
          </HelpModeWrapper>
          {draft.use_start_end ? (
            <>
              <label className="ui-field">
                <span className="ui-label">{tr("form.label.startDate", locale)}</span>
                <input
                  type="date"
                  className="ui-input"
                  value={draft.start_date}
                  onChange={(e) => setDraft((d) => ({ ...d, start_date: e.target.value }))}
                />
              </label>
              <label className="ui-field">
                <span className="ui-label">{tr("form.label.endDate", locale)}</span>
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
