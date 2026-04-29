import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Card } from "../ui/Card";
import { tr, useLocale } from "../../lib/i18n";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { createTransactions } from "../../api/transactions";
import { createUpcomingExpense } from "../../api/upcomingExpenses";
import { ErrorState } from "../ui/ErrorState";

type QuickActionType = "INCOME" | "EXPENSE" | "XFER" | "BILL";

const items = [
  { type: "INCOME" as QuickActionType },
  { type: "EXPENSE" as QuickActionType },
  { type: "XFER" as QuickActionType },
  { type: "BILL" as QuickActionType },
];

export function QuickActions(): ReactNode {
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [activeType, setActiveType] = useState<QuickActionType | null>(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({
    amount: "",
    source: "",
    currency: "USD",
    category: "",
    description: "",
    dueDate: new Date().toISOString().slice(0, 10),
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
      if (activeType === "BILL") {
        await createUpcomingExpense({
          name: draft.description || "Quick bill",
          amount: draft.amount,
          currency: draft.currency,
          due_date: draft.dueDate,
          source: draft.source || undefined,
          paid_flag: false,
          recurring_flag: false,
        });
        return;
      }
      if (activeType === "XFER") {
        await createTransactions([
          {
            date: new Date().toISOString().slice(0, 10),
            amount: draft.amount,
            source: draft.source,
            currency: draft.currency,
            tx_type: "XFER_OUT",
            description: draft.description,
            ...(draft.category.trim() ? { category: draft.category.trim() } : {}),
          },
        ]);
        return;
      }
      await createTransactions([
        {
          date: new Date().toISOString().slice(0, 10),
          amount: draft.amount,
          source: draft.source,
          currency: draft.currency,
          tx_type: activeType,
          description: draft.description,
          ...(draft.category.trim() ? { category: draft.category.trim() } : {}),
        },
      ]);
    },
    onMutate: () => setError(""),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["snapshot"] });
      void queryClient.invalidateQueries({ queryKey: ["upcoming-expenses"] });
      setActiveType(null);
      setDraft({
        amount: "",
        source: "",
        currency: "USD",
        category: "",
        description: "",
        dueDate: new Date().toISOString().slice(0, 10),
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
            <span className="ui-label">Amount</span>
            <input className="ui-input" value={draft.amount} onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))} />
          </label>
          <label className="ui-field">
            <span className="ui-label">Source</span>
            <input className="ui-input" value={draft.source} onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))} />
          </label>
          <label className="ui-field">
            <span className="ui-label">Currency</span>
            <input className="ui-input" value={draft.currency} onChange={(e) => setDraft((d) => ({ ...d, currency: e.target.value.toUpperCase() }))} />
          </label>
          {activeType === "BILL" ? (
            <label className="ui-field">
              <span className="ui-label">Due date</span>
              <input className="ui-input" type="date" value={draft.dueDate} onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))} />
            </label>
          ) : (
            <label className="ui-field">
              <span className="ui-label">Category</span>
              <input className="ui-input" value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))} />
            </label>
          )}
          <label className="ui-field">
            <span className="ui-label">Description</span>
            <input className="ui-input" value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
          </label>
          <Button disabled={saveMutation.isPending || !draft.amount || !draft.source} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
