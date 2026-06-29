import { useMemo, useState, type ReactNode } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ErrorState } from "../../components/ui/ErrorState";
import { KPI } from "../../components/ui/KPI";
import { LoadingState } from "../../components/ui/LoadingState";
import { Modal } from "../../components/ui/Modal";
import { TabPanel, Tabs } from "../../components/ui/Tabs";
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
import { getAppProfile } from "../../api/profile";
import { fetchAppSnapshot } from "../../api/snapshot";
import type { SourceRow, TransactionRecord } from "../../api/types";
import { formatMoney } from "../../lib/money";
import { tr, useLocale } from "../../lib/i18n";
import { HelpModeWrapper } from "../../components/tours/TourProvider";
import { readOptsFromQuery } from "../../offline/pwaReadBypass";
import { SOURCE_ACCOUNT_TYPES, SOURCE_ACCOUNT_TYPE_OPTIONS } from "../../lib/sourceAccountTypes";

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

  const profileQuery = useQuery({
    queryKey: ["profile", "settings"] as const,
    queryFn: (ctx) => getAppProfile(readOptsFromQuery(ctx)),
  });
  const snapshotQuery = useQuery({
    queryKey: ["profile", "snapshot"] as const,
    queryFn: (ctx) => fetchAppSnapshot({ current_month: "1" }, readOptsFromQuery(ctx)),
    placeholderData: keepPreviousData,
  });
  const categoriesQuery = useQuery({
    queryKey: ["lookups", "categories"] as const,
    queryFn: (ctx) => listCategories(readOptsFromQuery(ctx)),
  });
  const tagsQuery = useQuery({
    queryKey: ["lookups", "tags"] as const,
    queryFn: (ctx) => listTags(readOptsFromQuery(ctx)),
  });
  const sourcesQuery = useQuery({
    queryKey: ["lookups", "sources"] as const,
    queryFn: (ctx) => listSourceNames(readOptsFromQuery(ctx)),
  });
  const txForTotalsQuery = useQuery({
    queryKey: ["transactions", "category-totals"] as const,
    queryFn: listTransactionsForTotals,
  });

  const categoryTotals = useMemo(() => toCategoryTotals(txForTotalsQuery.data ?? []), [txForTotalsQuery.data]);
  const tagFrequency = useMemo(() => toTagFrequency(txForTotalsQuery.data ?? []), [txForTotalsQuery.data]);

  const overviewKpis = useMemo(() => {
    const snap = snapshotQuery.data?.snapshot;
    const currency = profileQuery.data?.base_currency ?? "USD";
    const val = (field: string): ReactNode => {
      const raw = snap?.[field];
      if (raw === null || raw === undefined) return "N/A";
      return formatMoney(raw, currency);
    };
    return [
      { label: tr("dashboard.kpi.assets", locale), value: val("total_assets") },
      { label: "Savings", value: val("total_savings") },
      { label: "Checking", value: val("total_checking") },
      { label: "Investment", value: val("total_investment") },
      { label: "Cash", value: val("total_cash") },
      { label: "E-wallet", value: val("total_ewallet") },
      { label: "Monthly spending", value: val("total_monthly_spending") },
      { label: tr("dashboard.kpi.remaining", locale), value: val("total_remaining_expenses") },
      { label: tr("dashboard.kpi.leaks", locale), value: val("total_leaks") },
    ];
  }, [locale, profileQuery.data?.base_currency, snapshotQuery.data?.snapshot]);

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
      void queryClient.invalidateQueries({ queryKey: ["sources", "all"] });
      void queryClient.invalidateQueries({ queryKey: ["categories", "all"] });
      void queryClient.invalidateQueries({ queryKey: ["tags", "all"] });
      void queryClient.invalidateQueries({ queryKey: ["snapshot"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
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
      void queryClient.invalidateQueries({ queryKey: ["sources", "all"] });
      void queryClient.invalidateQueries({ queryKey: ["categories", "all"] });
      void queryClient.invalidateQueries({ queryKey: ["tags", "all"] });
      void queryClient.invalidateQueries({ queryKey: ["snapshot"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
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
    const normalizedType = row.acc_type.trim().toUpperCase();
    setEditor({ entity: "source", mode: "edit", currentName: row.source });
    setEditorError("");
    setSourceDraft({
      source: row.source,
      acc_type: SOURCE_ACCOUNT_TYPES.includes(normalizedType as (typeof SOURCE_ACCOUNT_TYPES)[number])
        ? normalizedType
        : "CHECKING",
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
            SOURCE_ACCOUNT_TYPES.includes(sourceDraft.acc_type.trim().toUpperCase() as (typeof SOURCE_ACCOUNT_TYPES)[number]) &&
            sourceDraft.currency.trim().length === 3 &&
            !Number.isNaN(Number(sourceDraft.amount)),
        )
      : Boolean(textDraft.trim());

  const sourcesPanel = (
    <TabPanel className="stack">
      <div style={{ marginTop: 12 }} />
      <HelpModeWrapper id="datahub-sources" title={tr("guide.dataHub.sources.title", locale)} content={tr("guide.dataHub.sources.content", locale)}>
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
                    <Button size="compact" variant="secondary" onClick={() => openSourceEdit(row)}>
                      Edit
                    </Button>
                    <Button size="compact" variant="ghost" onClick={() => requestDelete("source", row.source)}>
                      {isDeletePending("source", row.source) ? "Confirm delete?" : "Delete"}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </HelpModeWrapper>
    </TabPanel>
  );

  const categoriesPanel = (
    <TabPanel className="stack">
      <div style={{ marginTop: 12 }} />
      <HelpModeWrapper id="datahub-categories" title={tr("guide.dataHub.categories.title", locale)} content={tr("guide.dataHub.categories.content", locale)}>
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
                      <Button size="compact" variant="secondary" onClick={() => openRename("category", name)}>
                        Rename
                      </Button>
                      <Button size="compact" variant="ghost" onClick={() => requestDelete("category", name)}>
                        {isDeletePending("category", name) ? "Confirm delete?" : "Delete"}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </HelpModeWrapper>
    </TabPanel>
  );

  const tagsPanel = (
    <TabPanel className="stack">
      <div style={{ marginTop: 12 }} />
      <HelpModeWrapper id="datahub-tags" title={tr("guide.dataHub.tags.title", locale)} content={tr("guide.dataHub.tags.content", locale)}>
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
                    <Button size="compact" variant="secondary" onClick={() => openRename("tag", name)}>
                      Rename
                    </Button>
                    <Button size="compact" variant="ghost" onClick={() => requestDelete("tag", name)}>
                      {isDeletePending("tag", name) ? "Confirm delete?" : "Delete"}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </HelpModeWrapper>
    </TabPanel>
  );

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
            void snapshotQuery.refetch();
          }}
        />
      ) : anyLoading && !categoriesQuery.data && !tagsQuery.data && !sourcesQuery.data ? (
        <LoadingState label={tr("dataHub.loading", locale)} />
      ) : (
        <Tabs
          tabs={[
            {
              id: "overview",
              label: tr("dataHub.tab.overview", locale),
              content: (
                <TabPanel className="stack">
                  <div style={{ marginTop: 12 }} />
                  {snapshotQuery.isError ? (
                    <ErrorState title={tr("settings.snapshotUnavailable", locale)} onRetry={() => void snapshotQuery.refetch()} />
                  ) : snapshotQuery.isLoading && !snapshotQuery.data ? (
                    <LoadingState label={tr("dataHub.loading", locale)} />
                  ) : (
                    <HelpModeWrapper id="datahub-overview-kpis" title={tr("guide.dataHub.overview.title", locale)} content={tr("guide.dataHub.overview.content", locale)}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                        {overviewKpis.map((kpi) => (
                          <KPI key={kpi.label} label={kpi.label} value={kpi.value} />
                        ))}
                      </div>
                    </HelpModeWrapper>
                  )}
                </TabPanel>
              ),
            },
            {
              id: "sources",
              label: tr("dataHub.tab.sources", locale),
              content: sourcesPanel,
            },
            {
              id: "categories",
              label: tr("dataHub.tab.categories", locale),
              content: categoriesPanel,
            },
            {
              id: "tags",
              label: tr("dataHub.tab.tags", locale),
              content: tagsPanel,
            },
          ]}
        />
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
                <span className="ui-label">{tr("form.label.sourceName", locale)}</span>
                <input
                  className="ui-input"
                  value={sourceDraft.source}
                  onChange={(e) => setSourceDraft((prev) => ({ ...prev, source: e.target.value }))}
                />
              </label>
              <label className="ui-field">
                <span className="ui-label">{tr("form.label.accountType", locale)}</span>
                <select
                  className="ui-select"
                  value={sourceDraft.acc_type}
                  onChange={(e) => setSourceDraft((prev) => ({ ...prev, acc_type: e.target.value }))}
                >
                  {SOURCE_ACCOUNT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ui-field">
                <span className="ui-label">{tr("common.amount", locale)}</span>
                <input
                  className="ui-input"
                  value={sourceDraft.amount}
                  onChange={(e) => setSourceDraft((prev) => ({ ...prev, amount: e.target.value }))}
                />
              </label>
              <label className="ui-field">
                <span className="ui-label">{tr("form.label.currency", locale)}</span>
                <input
                  className="ui-input"
                  value={sourceDraft.currency}
                  onChange={(e) => setSourceDraft((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))}
                />
              </label>
            </>
          ) : (
            <label className="ui-field">
              <span className="ui-label">{tr("common.name", locale)}</span>
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
