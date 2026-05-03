import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useState, type ReactNode } from "react";
import { Card } from "../ui/Card";
import { tr, useLocale } from "../../lib/i18n";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { createTransactions, listUnpaidExpenseNames } from "../../api/transactions";
import { createUpcomingExpense } from "../../api/upcomingExpenses";
import { ErrorState } from "../ui/ErrorState";
import { createCategory, listCategories, listTags } from "../../api/lookups";
import { isOfflineQueued, type SourceRow } from "../../api/types";
import { SourceSelect } from "../transactions/SourceSelect";

type QuickActionType = "INCOME" | "EXPENSE" | "XFER" | "BILL";

// +Bill / KNOWN_ISSUES #2: disabled until Quick pay bill ships. Staged design (transaction + bill, v1 fields):
// Parent workspace: plans/cursor/s1b/quick-pay-bill-design/DESIGN_DECISION.md
const items = [
  { type: "INCOME" as QuickActionType },
  { type: "EXPENSE" as QuickActionType },
  { type: "XFER" as QuickActionType },
  { type: "BILL" as QuickActionType, disabled: true },
];

type Props = {
  baseCurrency: string;
  sources: SourceRow[];
};

export function QuickActions({ baseCurrency, sources }: Props): ReactNode {
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [activeType, setActiveType] = useState<QuickActionType | null>(null);
  const [error, setError] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const sourceCurrency = new Map(sources.map((row) => [row.source, row.currency]));
  const categoriesQuery = useQuery({
    queryKey: ["categories", "all"] as const,
    queryFn: listCategories,
  });
  const tagsQuery = useQuery({ queryKey: ["tags", "all"] as const, queryFn: listTags });
  const unpaidBillsQuery = useQuery({
    queryKey: ["upcoming-expenses", "unpaid-names"] as const,
    queryFn: listUnpaidExpenseNames,
  });
  const categoryOptions = categoriesQuery.data ?? [];
  const tagOptions = tagsQuery.data ?? [];
  const currencyOptions = Array.from(
    new Set([
      baseCurrency,
      ...sources.map((row) => String(row.currency ?? "").trim().toUpperCase()).filter(Boolean),
    ]),
  ).sort((a, b) => a.localeCompare(b));
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [pendingTag, setPendingTag] = useState("");
  const [draft, setDraft] = useState({
    date: today,
    amount: "",
    source: "",
    currency: baseCurrency,
    category: "",
    description: "",
    bill: "",
    dueDate: today,
    toSource: "",
    sentAmount: "",
    receivedAmount: "",
    receivedCurrency: baseCurrency,
  });
  const labels: Record<string, string> = {
    INCOME: tr("dashboard.quick.income", locale),
    EXPENSE: tr("dashboard.quick.expense", locale),
    XFER: tr("dashboard.quick.transfer", locale),
    BILL: tr("dashboard.quick.bill", locale),
  };
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!activeType) return;
      const categoryRaw = draft.category.trim();
      const hasExistingCategory =
        categoryRaw.length === 0 ||
        categoryOptions.some((name) => name.trim().toLowerCase() === categoryRaw.toLowerCase());
      if (!hasExistingCategory) {
        try {
          await createCategory(categoryRaw);
          void queryClient.invalidateQueries({ queryKey: ["categories", "all"] });
        } catch (error) {
          if (!axios.isAxiosError(error) || (error.response?.status !== 400 && error.response?.status !== 409)) {
            throw error;
          }
        }
      }
      if (activeType === "BILL") {
        const billRes = await createUpcomingExpense({
          name: draft.description || "Quick bill",
          amount: draft.amount,
          currency: draft.currency,
          due_date: draft.dueDate,
          source: draft.source || undefined,
          paid_flag: false,
          recurring_flag: false,
        });
        if (isOfflineQueued(billRes)) {
          return;
        }
        return;
      }
      const tagPayload = selectedTags.length > 0 ? selectedTags : undefined;
      const billPayload = draft.bill.trim() ? draft.bill.trim() : undefined;
      if (activeType === "XFER") {
        const transferCategory = categoryRaw;
        const xferRes = await createTransactions([
          {
            date: draft.date,
            amount: draft.sentAmount,
            source: draft.source,
            currency: draft.currency,
            tx_type: "XFER_OUT",
            description: draft.description,
            ...(transferCategory ? { category: transferCategory } : {}),
            ...(billPayload ? { bill: billPayload } : {}),
            ...(tagPayload ? { tags: tagPayload } : {}),
          },
          {
            date: draft.date,
            amount: draft.receivedAmount,
            source: draft.toSource,
            currency: draft.receivedCurrency,
            tx_type: "XFER_IN",
            description: draft.description,
            ...(transferCategory ? { category: transferCategory } : {}),
            ...(billPayload ? { bill: billPayload } : {}),
            ...(tagPayload ? { tags: tagPayload } : {}),
          },
        ]);
        if (isOfflineQueued(xferRes)) {
          return;
        }
        return;
      }
      const singleRes = await createTransactions([
        {
          date: draft.date,
          amount: draft.amount,
          source: draft.source,
          currency: draft.currency,
          tx_type: activeType,
          description: draft.description,
          ...(draft.category.trim() ? { category: draft.category.trim() } : {}),
          ...(billPayload ? { bill: billPayload } : {}),
          ...(tagPayload ? { tags: tagPayload } : {}),
        },
      ]);
      if (isOfflineQueued(singleRes)) {
        return;
      }
    },
    onMutate: () => setError(""),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["snapshot"] });
      void queryClient.invalidateQueries({ queryKey: ["sources", "all"] });
      void queryClient.invalidateQueries({ queryKey: ["tags", "all"] });
      void queryClient.invalidateQueries({ queryKey: ["upcoming-expenses"] });
      setActiveType(null);
      setSelectedTags([]);
      setPendingTag("");
      setDraft({
        date: today,
        amount: "",
        source: "",
        currency: baseCurrency,
        category: "",
        description: "",
        bill: "",
        dueDate: today,
        toSource: "",
        sentAmount: "",
        receivedAmount: "",
        receivedCurrency: baseCurrency,
      });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to save."),
  });
  return (
    <Card>
      <h3 className="muted" style={{ margin: "0 0 0.75rem" }}>
        {tr("dashboard.quick.title", locale)}
      </h3>
      <div className="quick-actions">
        {items.map((i) => (
          <button
            key={i.type}
            type="button"
            className="ui-btn ui-btn--secondary quick-actions__btn"
            disabled={Boolean(i.disabled)}
            onClick={() => setActiveType(i.type)}
          >
            {labels[i.type]}
          </button>
        ))}
      </div>
      <Modal
        open={Boolean(activeType)}
        onClose={() => setActiveType(null)}
        title={activeType ? labels[activeType] : "Quick add"}
      >
        <div className="stack" style={{ marginTop: 12 }}>
          {error ? <ErrorState title="Save failed" description={error} /> : null}
          <label className="ui-field">
            <span className="ui-label">Date</span>
            <input className="ui-input" type="date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} />
          </label>
          {activeType === "XFER" ? (
            <>
              <label className="ui-field">
                <span className="ui-label">From source</span>
                <SourceSelect
                  sources={sources}
                  value={draft.source}
                  emptyLabel={tr("common.selectSource", locale)}
                  unknownSourceLabel={tr("common.unknownSourceHint", locale)}
                  onSourceChange={(source) =>
                    setDraft((d) => ({
                      ...d,
                      source,
                      currency: sourceCurrency.get(source) ?? d.currency,
                    }))
                  }
                />
              </label>
              <label className="ui-field">
                <span className="ui-label">To source</span>
                <SourceSelect
                  sources={sources}
                  value={draft.toSource}
                  emptyLabel={tr("common.selectSource", locale)}
                  unknownSourceLabel={tr("common.unknownSourceHint", locale)}
                  onSourceChange={(source) =>
                    setDraft((d) => ({
                      ...d,
                      toSource: source,
                      receivedCurrency: sourceCurrency.get(source) ?? d.receivedCurrency,
                    }))
                  }
                />
              </label>
              <label className="ui-field">
                <span className="ui-label">Sent amount</span>
                <input className="ui-input" value={draft.sentAmount} onChange={(e) => setDraft((d) => ({ ...d, sentAmount: e.target.value }))} />
              </label>
              <label className="ui-field">
                <span className="ui-label">Sent currency</span>
                <select className="ui-input" value={draft.currency} onChange={(e) => setDraft((d) => ({ ...d, currency: e.target.value }))}>
                  {currencyOptions.map((curr) => (
                    <option key={`quick-sent-${curr}`} value={curr}>
                      {curr}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ui-field">
                <span className="ui-label">Received amount</span>
                <input className="ui-input" value={draft.receivedAmount} onChange={(e) => setDraft((d) => ({ ...d, receivedAmount: e.target.value }))} />
              </label>
              <label className="ui-field">
                <span className="ui-label">Received currency</span>
                <select
                  className="ui-input"
                  value={draft.receivedCurrency}
                  onChange={(e) => setDraft((d) => ({ ...d, receivedCurrency: e.target.value }))}
                >
                  {currencyOptions.map((curr) => (
                    <option key={`quick-received-${curr}`} value={curr}>
                      {curr}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
          <label className="ui-field">
            <span className="ui-label">Amount</span>
            <input className="ui-input" value={draft.amount} onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))} />
          </label>
          <label className="ui-field">
            <span className="ui-label">Source</span>
            <SourceSelect
              sources={sources}
              value={draft.source}
              emptyLabel={tr("common.selectSource", locale)}
              unknownSourceLabel={tr("common.unknownSourceHint", locale)}
              onSourceChange={(source) =>
                setDraft((d) => ({
                  ...d,
                  source,
                  currency: sourceCurrency.get(source) ?? d.currency,
                }))
              }
            />
          </label>
          <label className="ui-field">
            <span className="ui-label">Currency</span>
            <select className="ui-input" value={draft.currency} onChange={(e) => setDraft((d) => ({ ...d, currency: e.target.value }))}>
              {currencyOptions.map((curr) => (
                <option key={`quick-curr-${curr}`} value={curr}>
                  {curr}
                </option>
              ))}
            </select>
          </label>
            </>
          )}
          {activeType === "BILL" ? (
            <label className="ui-field">
              <span className="ui-label">Due date</span>
              <input className="ui-input" type="date" value={draft.dueDate} onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))} />
            </label>
          ) : (
            <label className="ui-field">
              <span className="ui-label">Category</span>
              <input className="ui-input" list="quick-category-list" value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))} />
            </label>
          )}
          {activeType !== "BILL" ? (
            <>
              <label className="ui-field">
                <span className="ui-label">{tr("dashboard.quick.linkBill", locale)}</span>
                <input
                  className="ui-input"
                  list="quick-bill-list"
                  value={draft.bill}
                  onChange={(e) => setDraft((d) => ({ ...d, bill: e.target.value }))}
                />
              </label>
              <datalist id="quick-bill-list">
                {(unpaidBillsQuery.data ?? []).map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              <div className="ui-field">
                <span className="ui-label">{tr("dashboard.quick.tags", locale)}</span>
                {selectedTags.length > 0 ? (
                  <p className="muted" style={{ margin: "0 0 0.35rem", fontSize: "0.85rem" }}>
                    {selectedTags.join(", ")}
                  </p>
                ) : null}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <input
                    className="ui-input"
                    style={{ flex: "1 1 140px", minWidth: 0 }}
                    value={pendingTag}
                    onChange={(e) => setPendingTag(e.target.value)}
                    placeholder={tr("dashboard.quick.tagPlaceholder", locale)}
                    list="quick-tags-datalist"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const next = pendingTag.trim();
                      if (!next || selectedTags.includes(next)) return;
                      setSelectedTags((prev) => [...prev, next]);
                      setPendingTag("");
                    }}
                  >
                    {tr("dashboard.quick.addTag", locale)}
                  </Button>
                </div>
                <datalist id="quick-tags-datalist">
                  {tagOptions.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
            </>
          ) : null}
          <label className="ui-field">
            <span className="ui-label">Description</span>
            <input className="ui-input" value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
          </label>
          <datalist id="quick-category-list">
            {categoryOptions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <Button
            disabled={
              saveMutation.isPending ||
              (activeType === "XFER"
                ? !draft.source || !draft.toSource || !draft.sentAmount || !draft.receivedAmount
                : !draft.amount || !draft.source)
            }
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
