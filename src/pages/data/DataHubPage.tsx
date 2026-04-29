import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ErrorState } from "../../components/ui/ErrorState";
import { LoadingState } from "../../components/ui/LoadingState";
import { Modal } from "../../components/ui/Modal";
import {
  createCategory,
  createSource,
  createTag,
  deleteCategory,
  deleteSource,
  deleteTag,
  listCategories,
  listSourceNames,
  listTags,
  listTransactionsForTotals,
  renameCategory,
  renameTag,
  type SourceMutationPayload,
  updateSource,
} from "../../api/lookups";
import type { SourceRow, TransactionRecord } from "../../api/types";
import { tr, useLocale } from "../../lib/i18n";

type EntityType = "source" | "category" | "tag";

type EditorState = {
  entity: EntityType;
  mode: "create" | "rename" | "edit";
  currentName?: string;
};

type SourceDraft = {
  source: string;
  acc_type: string;
  amount: string;
  currency: string;
};

const DEFAULT_SOURCE_DRAFT: SourceDraft = {
  source: "",
  acc_type: "CHECKING",
  amount: "0.00",
  currency: "USD",
};

function parseApiError(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : "Request failed.";
  }
  const status = error.response?.status;
  const data = error.response?.data;
  if (Array.isArray(data)) {
    const rendered = data.map((item) => String(item)).join(" | ");
    return status ? `HTTP ${status}: ${rendered}` : rendered;
  }
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

function normalizeCategoryName(input: string | null | undefined): string {
  const name = (input ?? "").trim();
  return name || "Uncategorized";
}

function toCategoryTotals(rows: TransactionRecord[]): Array<{ category: string; total: number }> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const category = normalizeCategoryName(row.category);
    const amount = Math.abs(Number(row.amount) || 0);
    const txType = String(row.tx_type || "").toUpperCase();
    let signed = amount;
    if (txType === "EXPENSE" || txType === "XFER_OUT") {
      signed = -amount;
    }
    totals.set(category, (totals.get(category) ?? 0) + signed);
  }
  return Array.from(totals.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
}

function toTagFrequency(rows: TransactionRecord[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    for (const tag of row.tags ?? []) {
      const normalized = String(tag ?? "").trim().toLowerCase();
      if (!normalized) {
        continue;
      }
      counts[normalized] = (counts[normalized] ?? 0) + 1;
    }
  }
  return counts;
}

export function DataHubPage(): ReactNode {
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [textDraft, setTextDraft] = useState("");
  const [sourceDraft, setSourceDraft] = useState<SourceDraft>(DEFAULT_SOURCE_DRAFT);
  const [editorError, setEditorError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Record<string, boolean>>({});

  const categoriesQuery = useQuery({
    queryKey: ["lookups", "categories"] as const,
    queryFn: listCategories,
  });
  const tagsQuery = useQuery({
    queryKey: ["lookups", "tags"] as const,
    queryFn: listTags,
  });
  const sourcesQuery = useQuery({
    queryKey: ["lookups", "sources"] as const,
    queryFn: listSourceNames,
  });
  const txForTotalsQuery = useQuery({
    queryKey: ["transactions", "category-totals"] as const,
    queryFn: listTransactionsForTotals,
  });

  const categoryTotals = useMemo(() => toCategoryTotals(txForTotalsQuery.data ?? []), [txForTotalsQuery.data]);
  const tagFrequency = useMemo(() => toTagFrequency(txForTotalsQuery.data ?? []), [txForTotalsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editor) {
        return;
      }
      if (editor.entity === "source") {
        if (editor.mode === "create") {
          const payload: SourceMutationPayload = {
            source: sourceDraft.source.trim(),
            acc_type: sourceDraft.acc_type.trim().toUpperCase(),
            amount: sourceDraft.amount,
            currency: sourceDraft.currency.trim().toUpperCase(),
          };
          await createSource(payload);
          return;
        }
        if (editor.currentName) {
          await updateSource(editor.currentName, {
            source: sourceDraft.source.trim(),
            acc_type: sourceDraft.acc_type.trim().toUpperCase(),
            amount: sourceDraft.amount,
            currency: sourceDraft.currency.trim().toUpperCase(),
          });
        }
        return;
      }
      if (editor.entity === "category") {
        if (editor.mode === "create") {
          await createCategory(textDraft.trim());
        } else if (editor.currentName) {
          await renameCategory(editor.currentName, textDraft.trim());
        }
        return;
      }
      if (editor.mode === "create") {
        await createTag(textDraft.trim());
      } else if (editor.currentName) {
        await renameTag(editor.currentName, textDraft.trim());
      }
    },
    onMutate: () => setEditorError(""),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lookups"] });
      setEditor(null);
      setTextDraft("");
      setSourceDraft(DEFAULT_SOURCE_DRAFT);
    },
    onError: (error) => setEditorError(parseApiError(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ entity, name }: { entity: EntityType; name: string }) => {
      if (entity === "source") {
        await deleteSource(name);
      } else if (entity === "category") {
        await deleteCategory(name);
      } else {
        await deleteTag(name);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lookups"] });
    },
  });

  const anyLoading = categoriesQuery.isLoading || tagsQuery.isLoading || sourcesQuery.isLoading;
  const anyError = categoriesQuery.isError || tagsQuery.isError || sourcesQuery.isError;

  function openCreate(entity: EntityType): void {
    setEditor({ entity, mode: "create" });
    setEditorError("");
    setTextDraft("");
    setSourceDraft(DEFAULT_SOURCE_DRAFT);
  }

  function openRename(entity: EntityType, currentName: string): void {
    setEditor({ entity, mode: "rename", currentName });
    setEditorError("");
    setTextDraft(currentName);
  }

  function openSourceEdit(row: SourceRow): void {
    setEditor({ entity: "source", mode: "edit", currentName: row.source });
    setEditorError("");
    setSourceDraft({
      source: row.source,
      acc_type: row.acc_type,
      amount: row.amount,
      currency: row.currency,
    });
  }

  function requestDelete(entity: EntityType, name: string): void {
    const key = `${entity}:${name}`;
    if (!pendingDelete[key]) {
      setPendingDelete((prev) => ({ ...prev, [key]: true }));
      return;
    }
    deleteMutation.mutate({ entity, name });
    setPendingDelete((prev) => ({ ...prev, [key]: false }));
  }

  function isDeletePending(entity: EntityType, name: string): boolean {
    return Boolean(pendingDelete[`${entity}:${name}`]);
  }

  const editorCanSave =
    editor?.entity === "source" && (editor.mode === "create" || editor.mode === "edit")
      ? Boolean(
          sourceDraft.source.trim() &&
            sourceDraft.acc_type.trim() &&
            sourceDraft.currency.trim().length === 3 &&
            !Number.isNaN(Number(sourceDraft.amount)),
        )
      : Boolean(textDraft.trim());

  return (
    <div className="stack">
      <div className="app-surface app-surface--data">
        <h2 className="muted" style={{ margin: 0, fontSize: "var(--font-xl)" }}>
          {tr("dataHub.title", locale)}
        </h2>
      </div>
      {anyError ? (
        <ErrorState
          title={tr("dataHub.failed", locale)}
          description={tr("dataHub.failedDesc", locale)}
          onRetry={() => {
            void categoriesQuery.refetch();
            void tagsQuery.refetch();
            void sourcesQuery.refetch();
            void txForTotalsQuery.refetch();
          }}
        />
      ) : anyLoading && !categoriesQuery.data && !tagsQuery.data && !sourcesQuery.data ? (
        <LoadingState label={tr("dataHub.loading", locale)} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          <Card>
            <div className="stack" style={{ gap: 10 }}>
              <div className="row-between">
                <h3 style={{ margin: 0 }}>{tr("common.sources", locale)}</h3>
                <Button variant="secondary" onClick={() => openCreate("source")}>
                  {tr("common.add", locale)}
                </Button>
              </div>
              {(sourcesQuery.data ?? []).length === 0 ? (
                <p className="muted-text" style={{ margin: 0 }}>
                  {tr("dataHub.noSources", locale)}
                </p>
              ) : (
                (sourcesQuery.data ?? []).map((row) => (
                  <div key={row.source} className="row-between">
                    <div style={{ display: "grid", gap: 2 }}>
                      <strong>{row.source}</strong>
                      <span className="muted-text">
                        {row.acc_type} • {row.amount} {row.currency}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        className="ui-btn ui-btn--secondary"
                        onClick={() => openSourceEdit(row)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="ui-btn ui-btn--ghost"
                        onClick={() => requestDelete("source", row.source)}
                      >
                        {isDeletePending("source", row.source) ? "Confirm delete?" : "Delete"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <div className="stack" style={{ gap: 10 }}>
              <div className="row-between">
                <h3 style={{ margin: 0 }}>{tr("common.categories", locale)}</h3>
                <Button variant="secondary" onClick={() => openCreate("category")}>
                  {tr("common.add", locale)}
                </Button>
              </div>
              {(categoriesQuery.data ?? []).length === 0 ? (
                <p className="muted-text" style={{ margin: 0 }}>
                  {tr("dataHub.noCategories", locale)}
                </p>
              ) : (
                (categoriesQuery.data ?? []).map((name) => {
                  const total = categoryTotals.find((row) => row.category.toLowerCase() === name.toLowerCase())?.total ?? 0;
                  const totalLabel = `${total >= 0 ? "+" : "-"}${Math.abs(total).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`;
                  return (
                    <div key={name} className="row-between">
                      <div style={{ display: "grid", gap: 2 }}>
                        <strong>{name}</strong>
                        <span className="muted-text">Category total: {totalLabel}</span>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" className="ui-btn ui-btn--secondary" onClick={() => openRename("category", name)}>
                          Rename
                        </button>
                        <button type="button" className="ui-btn ui-btn--ghost" onClick={() => requestDelete("category", name)}>
                          {isDeletePending("category", name) ? "Confirm delete?" : "Delete"}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          <Card>
            <div className="stack" style={{ gap: 10 }}>
              <div className="row-between">
                <h3 style={{ margin: 0 }}>{tr("common.tags", locale)}</h3>
                <Button variant="secondary" onClick={() => openCreate("tag")}>
                  {tr("common.add", locale)}
                </Button>
              </div>
              {(tagsQuery.data ?? []).length === 0 ? (
                <p className="muted-text" style={{ margin: 0 }}>
                  {tr("dataHub.noTags", locale)}
                </p>
              ) : (
                (tagsQuery.data ?? []).map((name) => (
                  <div key={name} className="row-between">
                    <div style={{ display: "grid", gap: 2 }}>
                      <strong>{name}</strong>
                      <span className="muted-text">Used {tagFrequency[name.toLowerCase()] ?? 0}x</span>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" className="ui-btn ui-btn--secondary" onClick={() => openRename("tag", name)}>
                        Rename
                      </button>
                      <button type="button" className="ui-btn ui-btn--ghost" onClick={() => requestDelete("tag", name)}>
                        {isDeletePending("tag", name) ? "Confirm delete?" : "Delete"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      <Modal
        open={Boolean(editor)}
        onClose={() => setEditor(null)}
        title={
          editor
            ? `${editor.mode === "create" ? "Create" : editor.mode === "edit" ? "Edit" : "Rename"} ${editor.entity}`
            : "Edit"
        }
      >
        <div className="stack" style={{ marginTop: 12 }}>
          {editorError ? <ErrorState title="Save failed" description={editorError} /> : null}
          {editor?.entity === "source" && (editor.mode === "create" || editor.mode === "edit") ? (
            <>
              <label className="ui-field">
                <span className="ui-label">Source name</span>
                <input
                  className="ui-input"
                  value={sourceDraft.source}
                  onChange={(e) => setSourceDraft((prev) => ({ ...prev, source: e.target.value }))}
                />
              </label>
              <label className="ui-field">
                <span className="ui-label">Account type</span>
                <input
                  className="ui-input"
                  value={sourceDraft.acc_type}
                  onChange={(e) => setSourceDraft((prev) => ({ ...prev, acc_type: e.target.value.toUpperCase() }))}
                />
              </label>
              <label className="ui-field">
                <span className="ui-label">Amount</span>
                <input
                  className="ui-input"
                  value={sourceDraft.amount}
                  onChange={(e) => setSourceDraft((prev) => ({ ...prev, amount: e.target.value }))}
                />
              </label>
              <label className="ui-field">
                <span className="ui-label">Currency</span>
                <input
                  className="ui-input"
                  value={sourceDraft.currency}
                  onChange={(e) => setSourceDraft((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))}
                />
              </label>
            </>
          ) : (
            <label className="ui-field">
              <span className="ui-label">Name</span>
              <input className="ui-input" value={textDraft} onChange={(e) => setTextDraft(e.target.value)} />
            </label>
          )}
          <Button disabled={!editorCanSave || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
