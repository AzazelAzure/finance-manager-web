import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { HelpCircle } from "lucide-react";
import axios from "axios";
import {
  createTransactions,
  deleteTransaction,
  getTransaction,
  listTransactions,
  listUnpaidExpenseNames,
  updateTransaction,
  type TransactionFilters,
} from "../../api/transactions";
import { createCategory, listCategories, listSourceNames, listTags } from "../../api/lookups";
import { getAppProfile } from "../../api/profile";
import { isOfflineQueued, type TransactionRecord } from "../../api/types";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { DataTable, type ColumnDef } from "../../components/ui/DataTable";
import { ErrorState } from "../../components/ui/ErrorState";
import { LoadingState } from "../../components/ui/LoadingState";
import { Modal } from "../../components/ui/Modal";
import { SuccessState } from "../../components/ui/SuccessState";
import { formatMoney } from "../../lib/money";
import { categoryInitialValueForEditor } from "../../lib/transactionCategoryEdit";
import { tr, useLocale } from "../../lib/i18n";
import { readOptsFromQuery, requestPwaReadBypassAfterMutation } from "../../offline/pwaReadBypass";
import { SourceSelect } from "../../components/transactions/SourceSelect";
import {
  transactionFilterSignature,
  transactionsDraftToSearchParams,
  urlSearchParamsToTransactionsDraft,
  searchParamsToTransactionFilters,
  type TransactionsFilterDraft,
} from "../../lib/transactionsQueryParams";
import { HelpModeWrapper, useTour } from "../../components/tours/TourProvider";

type DeleteState = Record<string, number>;
type EditorMode = "single" | "transfer";

type SingleDraft = {
  date: string;
  amount: string;
  currency: string;
  source: string;
  tx_type: string;
  category: string;
  description: string;
  bill: string;
};

type TransferDraft = {
  date: string;
  from_source: string;
  to_source: string;
  sent_amount: string;
  received_amount: string;
  sent_currency: string;
  received_currency: string;
  category: string;
  description: string;
  bill: string;
};

function defaultSingleDraft(baseCurrency: string): SingleDraft {
  return {
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    currency: baseCurrency,
    source: "",
    tx_type: "EXPENSE",
    category: "",
    description: "",
    bill: "",
  };
}

function defaultTransferDraft(baseCurrency: string): TransferDraft {
  return {
    date: new Date().toISOString().slice(0, 10),
    from_source: "",
    to_source: "",
    sent_amount: "",
    received_amount: "",
    sent_currency: baseCurrency,
    received_currency: baseCurrency,
    category: "",
    description: "",
    bill: "",
  };
}

function mutationFailureMessage(result: {
  rejected?: Array<Record<string, unknown>>;
}): string {
  const first = result.rejected?.[0];
  if (!first) {
    return "Transaction was not accepted by the API.";
  }
  const raw =
    (typeof first.reason === "string" ? first.reason : "") ||
    (typeof first.error === "string" ? first.error : "") ||
    (typeof first.message === "string" ? first.message : "");
  return raw ?? "Transaction was rejected by the API.";
}

function parseApiError(err: unknown): string {
  if (!axios.isAxiosError(err)) {
    return err instanceof Error ? err.message : "Could not save transaction.";
  }
  const status = err.response?.status;
  const data = err.response?.data;
  if (Array.isArray(data)) {
    const message = data
      .map((item, idx) => {
        if (item && typeof item === "object") {
          return Object.entries(item as Record<string, unknown>)
            .map(([k, v]) => {
              if (Array.isArray(v)) {
                return `${k}: ${v.map((x) => String(x)).join(", ")}`;
              }
              return `${k}: ${String(v)}`;
            })
            .join(" | ");
        }
        return `${idx}: ${String(item)}`;
      })
      .filter((part) => Boolean(part))
      .join(" || ");
    if (message) {
      return status ? `HTTP ${status}: ${message}` : message;
    }
  }
  if (data && typeof data === "object") {
    const message = Object.entries(data as Record<string, unknown>)
      .map(([k, v]) => {
        if (Array.isArray(v)) {
          return `${k}: ${v.map((x) => String(x)).join(", ")}`;
        }
        return `${k}: ${String(v)}`;
      })
      .join(" | ");
    if (message) {
      return status ? `HTTP ${status}: ${message}` : message;
    }
  }
  if (typeof data === "string" && data.trim()) {
    return status ? `HTTP ${status}: ${data}` : data;
  }
  return status ? `HTTP ${status}: Request rejected by API.` : err.message;
}

function typeBadge(t: string): string {
  if (t === "EXPENSE") return "Exp";
  if (t === "INCOME") return "Inc";
  if (t === "XFER_IN" || t === "XFER_OUT") return "Xfer";
  return t;
}

function normalizedCategory(category: string): string {
  const trimmed = category.trim();
  return trimmed;
}

export function TransactionsPage(): ReactNode {
  const locale = useLocale();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { startTour, isTourCompleted } = useTour();
  const searchString = searchParams.toString();
  const profileQuery = useQuery({
    queryKey: ["app-profile"] as const,
    queryFn: (ctx) => getAppProfile(readOptsFromQuery(ctx)),
  });
  const baseCurrency = (profileQuery.data?.base_currency ?? "USD").trim().toUpperCase() || "USD";
  const filters = useMemo<TransactionFilters>(
    () => searchParamsToTransactionFilters(new URLSearchParams(searchString)),
    [searchString],
  );
  const signature = useMemo(
    () => transactionFilterSignature(new URLSearchParams(searchString)),
    [searchString],
  );
  const draft = useMemo(
    () => urlSearchParamsToTransactionsDraft(new URLSearchParams(searchString)),
    [searchString],
  );
  const [localDraft, setLocalDraft] = useState<TransactionsFilterDraft>(draft);
  const [pendingDelete, setPendingDelete] = useState<DeleteState>({});
  const [editorOpen, setEditorOpen] = useState(location.pathname.endsWith("/new"));
  const [editorMode, setEditorMode] = useState<EditorMode>("single");
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [singleDraft, setSingleDraft] = useState<SingleDraft>(() => defaultSingleDraft("USD"));
  const [transferDraft, setTransferDraft] = useState<TransferDraft>(() => defaultTransferDraft("USD"));
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [pendingTagInput, setPendingTagInput] = useState("");
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [isLoadingEditor, setIsLoadingEditor] = useState(false);
  const [editorError, setEditorError] = useState("");
  const [showFormHelp, setShowFormHelp] = useState(false);

  const txQuery = useQuery({
    queryKey: ["transactions", signature] as const,
    queryFn: (ctx) => listTransactions(filters, readOptsFromQuery(ctx)),
    placeholderData: keepPreviousData,
  });

  const tagsQuery = useQuery({
    queryKey: ["tags", "all"] as const,
    queryFn: (ctx) => listTags(readOptsFromQuery(ctx)),
  });
  const categoriesQuery = useQuery({
    queryKey: ["categories", "all"] as const,
    queryFn: (ctx) => listCategories(readOptsFromQuery(ctx)),
  });
  const sourcesQuery = useQuery({
    queryKey: ["sources", "all"] as const,
    queryFn: (ctx) => listSourceNames(readOptsFromQuery(ctx)),
  });
  const unpaidBillsQuery = useQuery({
    queryKey: ["upcoming-expenses", "unpaid-names"] as const,
    queryFn: (ctx) => listUnpaidExpenseNames(readOptsFromQuery(ctx)),
  });
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

  const saveMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (editingTxId) {
        const txType = singleDraft.tx_type;
        const category = normalizedCategory(singleDraft.category);
        const updated = await updateTransaction(editingTxId, {
          date: singleDraft.date,
          amount: singleDraft.amount,
          source: singleDraft.source,
          currency: singleDraft.currency,
          tx_type: txType,
          ...(category ? { category } : {}),
          description: singleDraft.description,
          bill: singleDraft.bill,
          tags: selectedTags,
        });
        if (isOfflineQueued(updated)) {
          return;
        }
        return;
      }
      if (editorMode === "single") {
        const txType = singleDraft.tx_type;
        const category = normalizedCategory(singleDraft.category);
        const result = await createTransactions([
          {
            date: singleDraft.date,
            amount: singleDraft.amount,
            source: singleDraft.source,
            currency: singleDraft.currency,
            tx_type: txType,
            ...(category ? { category } : {}),
            description: singleDraft.description,
            bill: singleDraft.bill,
            tags: selectedTags,
          },
        ]);
        if (isOfflineQueued(result)) {
          return;
        }
        const accepted = (result.accepted?.length ?? 0) + (result.updated?.length ?? 0);
        if (accepted < 1) {
          throw new Error(mutationFailureMessage(result));
        }
        return;
      }
      const transferCategory = normalizedCategory(transferDraft.category);
      const result = await createTransactions([
        {
          date: transferDraft.date,
          amount: transferDraft.sent_amount,
          source: transferDraft.from_source,
          currency: transferDraft.sent_currency,
          tx_type: "XFER_OUT",
          ...(transferCategory ? { category: transferCategory } : {}),
          description: transferDraft.description,
          bill: transferDraft.bill,
          tags: selectedTags,
        },
        {
          date: transferDraft.date,
          amount: transferDraft.received_amount,
          source: transferDraft.to_source,
          currency: transferDraft.received_currency,
          tx_type: "XFER_IN",
          ...(transferCategory ? { category: transferCategory } : {}),
          description: transferDraft.description,
          bill: transferDraft.bill,
          tags: selectedTags,
        },
      ]);
      if (isOfflineQueued(result)) {
        return;
      }
      const accepted = (result.accepted?.length ?? 0) + (result.updated?.length ?? 0);
      if (accepted < 2) {
        throw new Error(mutationFailureMessage(result));
      }
    },
    onMutate: () => {
      setEditorError("");
    },
    onSuccess: () => {
      void (async () => {
        requestPwaReadBypassAfterMutation();
        await queryClient.invalidateQueries({ queryKey: ["snapshot"], refetchType: "all" });
        await queryClient.invalidateQueries({ queryKey: ["transactions"], refetchType: "all" });
        await queryClient.invalidateQueries({ queryKey: ["sources", "all"], refetchType: "all" });
        await queryClient.invalidateQueries({ queryKey: ["transactions-calendar"], refetchType: "all" });
        await queryClient.invalidateQueries({ queryKey: ["transactions-viz"], refetchType: "all" });
      })();
      setEditorOpen(false);
      setEditingTxId(null);
      setEditorMode("single");
      setSingleDraft(defaultSingleDraft(baseCurrency));
      setTransferDraft(defaultTransferDraft(baseCurrency));
      setSelectedTags([]);
      if (location.pathname.endsWith("/new")) {
        navigate("/app/transactions", { replace: true });
      }
    },
    onError: (err) => {
      setEditorError(parseApiError(err));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (payload: { txId: string; echo?: TransactionRecord }) => {
      const r = await deleteTransaction(payload.txId, payload.echo ? { echo: payload.echo } : undefined);
      if (isOfflineQueued(r)) {
        return "queued" as const;
      }
      return "ok" as const;
    },
    onSuccess: () => {
      void (async () => {
        requestPwaReadBypassAfterMutation();
        await queryClient.invalidateQueries({ queryKey: ["snapshot"], refetchType: "all" });
        await queryClient.invalidateQueries({ queryKey: ["transactions"], refetchType: "all" });
        await queryClient.invalidateQueries({ queryKey: ["sources", "all"], refetchType: "all" });
        await queryClient.invalidateQueries({ queryKey: ["transactions-calendar"], refetchType: "all" });
        await queryClient.invalidateQueries({ queryKey: ["transactions-viz"], refetchType: "all" });
      })();
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: (name: string) => createCategory(name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["categories", "all"] });
    },
  });

  const categoryExists = useMemo(() => {
    const name = (editingTxId ? singleDraft.category : editorMode === "single" ? singleDraft.category : transferDraft.category)
      .trim()
      .toLowerCase();
    if (!name) {
      return true;
    }
    return (categoriesQuery.data ?? []).some((c) => typeof c === "string" && c.trim().toLowerCase() === name);
  }, [categoriesQuery.data, editorMode, editingTxId, singleDraft.category, transferDraft.category]);

  const isSaveDisabled = useMemo(() => {
    if (saveMutation.isPending || isLoadingEditor) {
      return true;
    }
    if (editingTxId) {
      return !singleDraft.date || !singleDraft.amount || !singleDraft.source;
    }
    if (editorMode === "single") {
      return !singleDraft.date || !singleDraft.amount || !singleDraft.source;
    }
    return (
      !transferDraft.date ||
      !transferDraft.from_source ||
      !transferDraft.to_source ||
      !transferDraft.sent_amount ||
      !transferDraft.received_amount
    );
  }, [editingTxId, editorMode, isLoadingEditor, saveMutation.isPending, singleDraft, transferDraft]);

  async function openEditorForEdit(txId: string): Promise<void> {
    setIsLoadingEditor(true);
    setEditorError("");
    try {
      const tx = await getTransaction(txId);
      const userCats = categoriesQuery.data ?? [];
      setEditingTxId(txId);
      setEditorMode("single");
      setSelectedTags(tx.tags ?? []);
      setSingleDraft({
        date: tx.date || new Date().toISOString().slice(0, 10),
        amount: String(tx.amount ?? ""),
        currency: tx.currency || "USD",
        source: tx.source || "",
        tx_type: tx.tx_type || "EXPENSE",
        category: categoryInitialValueForEditor(tx, userCats),
        description: tx.description || "",
        bill: tx.bill || "",
      });
      setEditorOpen(true);
    } finally {
      setIsLoadingEditor(false);
    }
  }

  function openEditorForCreate(mode: EditorMode): void {
    setEditingTxId(null);
    setEditorMode(mode);
    setSingleDraft(defaultSingleDraft(baseCurrency));
    setTransferDraft(defaultTransferDraft(baseCurrency));
    setSelectedTags([]);
    setPendingTagInput("");
    setEditorError("");
    setEditorOpen(true);
  }

  const columns = useMemo<Array<ColumnDef<TransactionRecord>>>(
    () => [
      { id: "date", header: "Date", cell: (r) => r.date, sortValue: (r) => r.date },
      { id: "type", header: "Type", cell: (r) => <span className="tx-badge">{typeBadge(r.tx_type)}</span> },
      { id: "desc", header: "Description", cell: (r) => r.description || "—" },
      {
        id: "amt",
        header: "Amount",
        cell: (r) => <span style={{ fontWeight: 600 }}>{formatMoney(r.amount, r.currency || "USD")}</span>,
        sortValue: (r) => Number(r.amount),
      },
      { id: "source", header: "Source", cell: (r) => r.source || "—" },
      { id: "category", header: "Category", cell: (r) => r.category || "—" },
      { id: "tags", header: "Tags", cell: (r) => (r.tags ?? []).join(", ") || "—" },
      {
        id: "actions",
        header: "Actions",
        cell: (r) => {
          const isConfirm = (pendingDelete[r.tx_id] ?? 0) > Date.now();
          const queuedLocal = r.tx_id.startsWith("pending:");
          const pendingTitle = queuedLocal ? tr("tx.pendingActions", locale) : undefined;
          return (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="ui-btn ui-btn--secondary"
                type="button"
                title={queuedLocal ? tr("tx.pendingEditDraft", locale) : undefined}
                onClick={() => {
                  void openEditorForEdit(r.tx_id);
                }}
              >
                Edit
              </button>
              <button
                className="ui-btn ui-btn--ghost"
                type="button"
                disabled={queuedLocal}
                title={pendingTitle}
                onClick={() => {
                  if (!isConfirm) {
                    setPendingDelete((prev) => ({ ...prev, [r.tx_id]: Date.now() + 5000 }));
                    return;
                  }
                  deleteMutation.mutate({ txId: r.tx_id, echo: r });
                }}
              >
                {isConfirm ? "Confirm delete?" : "Delete"}
              </button>
            </div>
          );
        },
      },
    ],
    [pendingDelete, deleteMutation, locale],
  );

  const fromDashboard = searchParams.get("fromDashboard") === "1";
  const onApply = (): void => {
    setSearchParams(transactionsDraftToSearchParams(localDraft), { replace: true });
  };

  useEffect(() => {
    if (isTourCompleted("transactions_linear_tour")) {
      return;
    }
    // Start the linear tour when the page loads
    startTour("transactions_linear_tour", [
      { 
        target: '#tx-filters', 
        title: 'Refine History',
        content: 'Narrow down your search by date range, transaction type, or specific source accounts. Click "Apply" to refresh the list.' 
      },
      { 
        target: '#tx-add', 
        title: 'New Records',
        content: 'Log single transactions or account transfers. Use the "? Guide" inside the forms for step-by-step help.' 
      },
      { 
        target: '#tx-table', 
        title: 'Your Ledger',
        content: 'A comprehensive list of all your historical records. You can click any row to see details or use the action buttons to edit/delete.' 
      }
    ]);
  }, [startTour, isTourCompleted]);

  return (
    <div className="stack">
      <div className="app-toolbar app-surface">
        <h2 className="muted" style={{ margin: 0, fontSize: "var(--font-xl)" }}>
          Transactions
        </h2>
        <div className="app-toolbar__actions" id="tx-add">
          <Link to="/app/transactions/calendar" className="ui-btn ui-btn--secondary">
            Calendar
          </Link>
          <Link to="/app/transactions/deep-dive" className="ui-btn ui-btn--secondary">
            Deep dive
          </Link>
          <HelpModeWrapper id="tx-add" title="Add Transactions" content="Use Add transaction or Add transfer for proper payloads.">
            <div style={{ display: "flex", gap: "8px" }}>
              <Button onClick={() => openEditorForCreate("single")}>Add transaction</Button>
              <Button variant="secondary" onClick={() => openEditorForCreate("transfer")}>
                Add transfer
              </Button>
            </div>
          </HelpModeWrapper>
        </div>
      </div>

      {fromDashboard ? (
        <Card>
          <SuccessState message="Filtered from dashboard drillthrough. Adjust filters or clear to broaden results." />
          <Button
            variant="ghost"
            onClick={() => {
              const p = new URLSearchParams(searchParams.toString());
              p.delete("fromDashboard");
              p.delete("category");
              p.delete("tag_name");
              p.delete("untagged");
              setSearchParams(p, { replace: true });
            }}
          >
            Clear dashboard filters
          </Button>
        </Card>
      ) : null}

      <HelpModeWrapper id="tx-filters" title="Filters" content="Filter by period, type, or source and apply to reload results.">
        <Card>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
          <label className="ui-field">
            <span className="ui-label">Period</span>
            <select
              className="ui-input"
              value={localDraft.period}
              onChange={(e) => setLocalDraft((d) => ({ ...d, period: e.target.value as TransactionsFilterDraft["period"] }))}
            >
              <option value="current">Current month</option>
              <option value="last">Last month</option>
              <option value="week">Previous week</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label className="ui-field">
            <span className="ui-label">Type</span>
            <select className="ui-input" value={localDraft.txType} onChange={(e) => setLocalDraft((d) => ({ ...d, txType: e.target.value }))}>
              <option value="">All</option>
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
              <option value="XFER_OUT">Transfer out</option>
              <option value="XFER_IN">Transfer in</option>
            </select>
          </label>
          <label className="ui-field">
            <span className="ui-label">Tag</span>
            <input className="ui-input" value={localDraft.tagName} onChange={(e) => setLocalDraft((d) => ({ ...d, tagName: e.target.value }))} list="tx-tags" />
          </label>
          <label className="ui-field">
            <span className="ui-label">Category</span>
            <select className="ui-input" value={localDraft.category} onChange={(e) => setLocalDraft((d) => ({ ...d, category: e.target.value }))}>
              <option value="">Any</option>
              {(categoriesQuery.data ?? []).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="ui-field">
            <span className="ui-label">Source</span>
            <select className="ui-input" value={localDraft.source} onChange={(e) => setLocalDraft((d) => ({ ...d, source: e.target.value }))}>
              <option value="">Any</option>
              {(sourcesQuery.data ?? []).map((s) => (
                <option key={s.source} value={s.source}>
                  {s.source}
                </option>
              ))}
            </select>
          </label>
          <label className="ui-field">
            <span className="ui-label">Currency</span>
            <input className="ui-input" value={localDraft.currency} onChange={(e) => setLocalDraft((d) => ({ ...d, currency: e.target.value }))} />
          </label>
        </div>
        <datalist id="tx-tags">
          {(tagsQuery.data ?? []).map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <Button variant="secondary" onClick={onApply}>
            Apply
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setSearchParams(new URLSearchParams(), { replace: true });
              setLocalDraft(urlSearchParamsToTransactionsDraft(new URLSearchParams()));
            }}
          >
            Reset
          </Button>
        </div>
      </Card>
      </HelpModeWrapper>

      {txQuery.isError ? (
        <ErrorState title="Transactions failed to load" onRetry={() => void txQuery.refetch()} />
      ) : txQuery.isLoading && !txQuery.data ? (
        <LoadingState label="Loading transactions..." />
      ) : (
        <HelpModeWrapper id="tx-table" title="Transaction List" content="Edit and delete actions are in-line per row.">
          <Card>
            <DataTable columns={columns} data={txQuery.data ?? []} keyField="tx_id" emptyTitle="No transactions in this range" />
          </Card>
        </HelpModeWrapper>
      )}

      <Modal
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setEditorError("");
          setShowFormHelp(false);
          if (location.pathname.endsWith("/new")) {
            navigate("/app/transactions", { replace: true });
          }
        }}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span>{editingTxId ? "Edit transaction" : editorMode === "single" ? "Add transaction" : "Add transfer"}</span>
            <button
              type="button"
              className="ui-btn ui-btn--ghost ui-btn--sm"
              onClick={() => setShowFormHelp(!showFormHelp)}
              style={{ fontSize: "0.8rem", padding: "2px 8px" }}
            >
              <HelpCircle size={14} /> {showFormHelp ? "Hide guide" : "Guide"}
            </button>
          </div>
        }
      >
        <div className="stack" style={{ marginTop: 12 }}>
          {showFormHelp && editorMode === "single" ? (
            <div className="ui-state" style={{ textAlign: "left", fontSize: "0.9rem" }}>
              <strong>Single Transaction Guide</strong>
              <ul style={{ paddingLeft: 20, margin: "8px 0 0 0" }}>
                <li><strong>Amount:</strong> The absolute value of the transaction.</li>
                <li><strong>Source:</strong> The account involved.</li>
                <li><strong>Type:</strong> Expense (money out) or Income (money in).</li>
                <li><strong>Category:</strong> E.g. "Food" or "Salary" to group spending.</li>
              </ul>
              <Button 
                variant="primary" 
                style={{ marginTop: 8 }}
                onClick={() => startTour('tx_single_tour', [
                  { target: '#tx-form-date', title: 'Date', content: 'When did this happen? It defaults to today.' },
                  { target: '#tx-form-amount', title: 'Amount', content: 'Enter the absolute value of the transaction.' },
                  { target: '#tx-form-source', title: 'Payment Source', content: 'Select where the money is coming from (e.g., Gcash, Cash).' },
                  { target: '#tx-form-cat', title: 'Category', content: 'Categorize your spending to see trends on the Dashboard.' },
                  { target: '#tx-form-desc', title: 'Description', content: 'Add a small note for future reference.' }
                ], true)}
              >
                Start step-by-step guide
              </Button>
            </div>
          ) : null}
          {showFormHelp && editorMode === "transfer" ? (
            <div className="ui-state" style={{ textAlign: "left", fontSize: "0.9rem" }}>
              <strong>Transfer Guide & Leak Tracking</strong>
              <ul style={{ paddingLeft: 20, margin: "8px 0 0 0" }}>
                <li><strong>From source:</strong> The account the money left.</li>
                <li><strong>To source:</strong> The account the money entered.</li>
                <li><strong>Sent amount:</strong> How much left the <em>From source</em>.</li>
                <li><strong>Received amount:</strong> How much entered the <em>To source</em>.</li>
              </ul>
              <Button 
                variant="primary" 
                style={{ marginTop: 8 }}
                onClick={() => startTour('tx_transfer_tour', [
                  { target: '#tx-xfer-date', title: 'Date', content: 'When the transfer occurred.' },
                  { target: '#tx-xfer-from', title: 'From Account', content: 'The source account of the transfer.' },
                  { target: '#tx-xfer-to', title: 'To Account', content: 'The destination account where the money is going.' },
                  { target: '#tx-xfer-sent', title: 'Amount Sent', content: 'How much left the source account.' },
                  { target: '#tx-xfer-received', title: 'Amount Received', content: 'How much entered the destination (helps track transfer fees/leaks).' }
                ], true)}
              >
                Start step-by-step guide
              </Button>
            </div>
          ) : null}

          {editorError ? (
            <ErrorState title="Save failed" description={editorError} />
          ) : null}
          {!editingTxId ? (
            <label className="ui-field">
              <span className="ui-label">Mode</span>
              <select
                className="ui-input"
                value={editorMode}
                onChange={(e) => setEditorMode(e.target.value as EditorMode)}
              >
                <option value="single">Single transaction</option>
                <option value="transfer">Transfer pair</option>
              </select>
            </label>
          ) : null}
          {editorMode === "single" || editingTxId ? (
            <>
              <label className="ui-field" id="tx-form-date">
                <span className="ui-label">Date</span>
                <input
                  className="ui-input"
                  type="date"
                  value={singleDraft.date}
                  onChange={(e) => setSingleDraft((d) => ({ ...d, date: e.target.value }))}
                />
              </label>
              <label className="ui-field" id="tx-form-amount">
                <span className="ui-label">Amount</span>
                <input
                  className="ui-input"
                  value={singleDraft.amount}
                  onChange={(e) => setSingleDraft((d) => ({ ...d, amount: e.target.value }))}
                />
              </label>
              <label className="ui-field">
                <span className="ui-label">Currency</span>
                <select className="ui-input" value={singleDraft.currency} onChange={(e) => setSingleDraft((d) => ({ ...d, currency: e.target.value }))}>
                  {currencyOptions.map((curr) => (
                    <option key={curr} value={curr}>
                      {curr}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ui-field" id="tx-form-source">
                <span className="ui-label">Source</span>
                <SourceSelect
                  sources={sourcesQuery.data ?? []}
                  value={singleDraft.source}
                  emptyLabel={tr("common.selectSource", locale)}
                  unknownSourceLabel={tr("common.unknownSourceHint", locale)}
                  onSourceChange={(source) => {
                    setSingleDraft((d) => ({
                      ...d,
                      source,
                      currency: source
                        ? (sourcesQuery.data ?? []).find((s) => s.source === source)?.currency ?? d.currency
                        : d.currency,
                    }));
                  }}
                />
              </label>
              <label className="ui-field">
                <span className="ui-label">Type</span>
                <select
                  className="ui-input"
                  value={singleDraft.tx_type}
                  onChange={(e) => setSingleDraft((d) => ({ ...d, tx_type: e.target.value }))}
                >
                  <option value="EXPENSE">Expense</option>
                  <option value="INCOME">Income</option>
                  <option value="XFER_OUT">Transfer out</option>
                  <option value="XFER_IN">Transfer in</option>
                </select>
              </label>
            </>
          ) : (
            <>
              <label className="ui-field" id="tx-xfer-from">
                <span className="ui-label">From source</span>
                <SourceSelect
                  sources={sourcesQuery.data ?? []}
                  value={transferDraft.from_source}
                  emptyLabel={tr("common.selectSource", locale)}
                  unknownSourceLabel={tr("common.unknownSourceHint", locale)}
                  onSourceChange={(source) => setTransferDraft((d) => ({ ...d, from_source: source }))}
                />
              </label>
              <label className="ui-field" id="tx-xfer-to">
                <span className="ui-label">To source</span>
                <SourceSelect
                  sources={sourcesQuery.data ?? []}
                  value={transferDraft.to_source}
                  emptyLabel={tr("common.selectSource", locale)}
                  unknownSourceLabel={tr("common.unknownSourceHint", locale)}
                  onSourceChange={(source) => setTransferDraft((d) => ({ ...d, to_source: source }))}
                />
              </label>
              <label className="ui-field" id="tx-xfer-sent">
                <span className="ui-label">Sent amount</span>
                <input
                  className="ui-input"
                  value={transferDraft.sent_amount}
                  onChange={(e) => setTransferDraft((d) => ({ ...d, sent_amount: e.target.value }))}
                />
              </label>
              <label className="ui-field">
                <span className="ui-label">Sent currency</span>
                <select
                  className="ui-input"
                  value={transferDraft.sent_currency}
                  onChange={(e) => setTransferDraft((d) => ({ ...d, sent_currency: e.target.value }))}
                >
                  {currencyOptions.map((curr) => (
                    <option key={`sent-${curr}`} value={curr}>
                      {curr}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ui-field" id="tx-xfer-received">
                <span className="ui-label">Received amount</span>
                <input
                  className="ui-input"
                  value={transferDraft.received_amount}
                  onChange={(e) => setTransferDraft((d) => ({ ...d, received_amount: e.target.value }))}
                />
              </label>
              <label className="ui-field">
                <span className="ui-label">Received currency</span>
                <select
                  className="ui-input"
                  value={transferDraft.received_currency}
                  onChange={(e) => setTransferDraft((d) => ({ ...d, received_currency: e.target.value }))}
                >
                  {currencyOptions.map((curr) => (
                    <option key={`received-${curr}`} value={curr}>
                      {curr}
                    </option>
                  ))}
                </select>
              </label>
              <p className="muted-text" style={{ margin: 0 }}>
                {transferDraft.sent_amount && transferDraft.received_amount
                  ? `${formatMoney(
                      transferDraft.sent_amount,
                      transferDraft.sent_currency,
                    )} will move from ${transferDraft.from_source || "source A"} to ${transferDraft.to_source || "source B"}, receiving ${formatMoney(transferDraft.received_amount, transferDraft.received_currency)}.`
                  : "Enter amounts and sources to preview transfer impact."}
              </p>
              {showFormHelp && (
                <Card style={{ background: "var(--bg-depth-2)", border: "1px dashed var(--accent-primary)" }}>
                  <p style={{ fontSize: "0.9rem", margin: 0 }}>
                    <strong>Transfer Guide:</strong> Use this to move money between accounts.
                    <br />
                    • <strong>Sent amount:</strong> Put the amount sent here. Include any fees in the total.
                    <br />
                    • <strong>Received amount:</strong> The final amount that landed in the target account.
                    <br />
                    <Button
                      variant="primary"
                      style={{ marginTop: 8 }}
                      onClick={() =>
                        startTour("tx_transfer_tour", [
                          {
                            target: "#tx-xfer-from",
                            content: "Select where the money is coming from.",
                            title: "Origin",
                          },
                          {
                            target: "#tx-xfer-to",
                            content: "Select the destination account.",
                            title: "Destination",
                          },
                          {
                            target: "#tx-xfer-sent",
                            content: "Put the amount sent here. Include any fees in the total.",
                            title: "Sent Amount",
                          },
                          {
                            target: "#tx-xfer-received",
                            content: "The final amount that landed in the target account. This can be different if currency conversion occurred.",
                            title: "Received Amount",
                          },
                        ] as any, true)
                      }
                    >
                      Start step-by-step guide
                    </Button>
                  </p>
                </Card>
              )}
            </>
          )}
          <label className="ui-field" id="tx-form-cat">
            <span className="ui-label">Category</span>
            <input
              className="ui-input"
              list="tx-category-list"
              value={editingTxId ? singleDraft.category : editorMode === "single" ? singleDraft.category : transferDraft.category}
              onChange={(e) => {
                const v = e.target.value;
                if (editingTxId || editorMode === "single") {
                  setSingleDraft((d) => ({ ...d, category: v }));
                } else {
                  setTransferDraft((d) => ({ ...d, category: v }));
                }
              }}
            />
          </label>
          {!categoryExists ? (
            <div className="ui-state" role="status">
              <p className="muted-text" style={{ marginTop: 0 }}>
                Category does not exist yet.
              </p>
              <Button
                variant="secondary"
                disabled={createCategoryMutation.isPending}
                onClick={() => {
                  const raw =
                    editingTxId || editorMode === "single" ? singleDraft.category : transferDraft.category;
                  const name = raw.trim();
                  if (!name) return;
                  createCategoryMutation.mutate(name);
                }}
              >
                {createCategoryMutation.isPending ? "Creating..." : "Create category"}
              </Button>
            </div>
          ) : null}
          <label className="ui-field">
            <span className="ui-label">Bill (optional)</span>
            <select
              className="ui-input"
              value={editingTxId ? singleDraft.bill : editorMode === "single" ? singleDraft.bill : transferDraft.bill}
              onChange={(e) => {
                const v = e.target.value;
                if (editingTxId || editorMode === "single") {
                  setSingleDraft((d) => ({ ...d, bill: v }));
                } else {
                  setTransferDraft((d) => ({ ...d, bill: v }));
                }
              }}
            >
              <option value="">None</option>
              {(unpaidBillsQuery.data ?? []).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="ui-field" id="tx-form-desc">
            <span className="ui-label">Description</span>
            <input
              className="ui-input"
              value={editingTxId ? singleDraft.description : editorMode === "single" ? singleDraft.description : transferDraft.description}
              onChange={(e) => {
                const v = e.target.value;
                if (editingTxId || editorMode === "single") {
                  setSingleDraft((d) => ({ ...d, description: v }));
                } else {
                  setTransferDraft((d) => ({ ...d, description: v }));
                }
              }}
            />
          </label>
          <div className="ui-field">
            <span className="ui-label">Tags</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {selectedTags.length === 0 ? <span className="muted-text">No tags</span> : null}
              {selectedTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="tx-badge"
                  onClick={() => setSelectedTags((prev) => prev.filter((t) => t !== tag))}
                >
                  {tag} ×
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <input
                className="ui-input"
                value={pendingTagInput}
                onChange={(e) => setPendingTagInput(e.target.value)}
                placeholder="Add tag"
                list="tx-tags"
              />
              <Button
                variant="secondary"
                onClick={() => {
                  const next = pendingTagInput.trim();
                  if (!next || selectedTags.includes(next)) return;
                  setSelectedTags((prev) => [...prev, next]);
                  setPendingTagInput("");
                }}
              >
                Add
              </Button>
              <Button variant="ghost" onClick={() => setTagPickerOpen(true)}>
                Pick tags
              </Button>
            </div>
          </div>
          <datalist id="tx-category-list">
            {(categoriesQuery.data ?? []).map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <Button
            disabled={isSaveDisabled}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? "Saving..." : editingTxId ? "Save changes" : "Create"}
          </Button>
        </div>
      </Modal>

      <Modal open={tagPickerOpen} onClose={() => setTagPickerOpen(false)} title="Pick tags">
        <div className="stack" style={{ marginTop: 12 }}>
          {(tagsQuery.data ?? []).map((tag) => {
            const on = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                className={on ? "ui-btn" : "ui-btn ui-btn--secondary"}
                onClick={() => {
                  setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
                }}
              >
                {on ? "✓ " : ""}{tag}
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
