import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ErrorState } from "../../components/ui/ErrorState";
import { LoadingState } from "../../components/ui/LoadingState";
import {
  createGoal,
  deleteGoal,
  listGoals,
  updateGoal,
  type SavingsGoal,
  type SavingsGoalWritePayload,
} from "../../api/goals";
import { getAppProfile } from "../../api/profile";
import { listSourceNames } from "../../api/lookups";
import type { AppProfileResponse } from "../../api/types";
import { formatMoney, toNumber } from "../../lib/money";
import { tr, trFmt, useLocale } from "../../lib/i18n";
import { preferOfflineCaches } from "../../offline/connectivity";
import { readOptsFromQuery } from "../../offline/pwaReadBypass";

type GoalDraft = SavingsGoalWritePayload;

function emptyDraft(baseCurrency: string): GoalDraft {
  const currency = baseCurrency.trim().toUpperCase() || "USD";
  return {
    name: "",
    target_amount: "",
    currency,
    target_date: new Date().toISOString().slice(0, 10),
    current_amount: "0",
    source: null,
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
  return status ? `HTTP ${status}: Request rejected.` : error.message;
}

function progressPercent(current: string, target: string): number {
  const t = toNumber(target);
  const c = toNumber(current);
  if (t == null || t <= 0 || c == null) {
    return 0;
  }
  return Math.min(100, Math.round((c / t) * 100));
}

function progressTone(pct: number): string {
  if (pct >= 80) {
    return "goals-progress--good";
  }
  if (pct >= 40) {
    return "goals-progress--mid";
  }
  return "goals-progress--low";
}

function payCycleSuffix(profile: AppProfileResponse | undefined, locale: ReturnType<typeof useLocale>): string {
  const freq = profile?.pay_cycle_frequency ?? "monthly";
  const key = `profile.payFrequency.${freq}` as const;
  const label = tr(key, locale);
  return `${tr("goals.perCycle", locale)} (${label})`;
}

function GoalFormFields({
  draft,
  onChange,
  savingsSources,
  disabled,
  locale,
}: {
  draft: GoalDraft;
  onChange: (next: GoalDraft) => void;
  savingsSources: string[];
  disabled: boolean;
  locale: ReturnType<typeof useLocale>;
}): ReactNode {
  return (
    <div className="stack" style={{ gap: "var(--spacing-3)" }}>
      <label className="ui-field">
        <span className="ui-label">{tr("goals.name", locale)}</span>
        <input
          className="ui-input"
          value={draft.name}
          disabled={disabled}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
        />
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--spacing-3)" }}>
        <label className="ui-field" style={{ flex: "1 1 140px" }}>
          <span className="ui-label">{tr("goals.targetAmount", locale)}</span>
          <input
            className="ui-input"
            inputMode="decimal"
            value={draft.target_amount}
            disabled={disabled}
            onChange={(e) => onChange({ ...draft, target_amount: e.target.value })}
          />
        </label>
        <label className="ui-field" style={{ flex: "0 1 100px" }}>
          <span className="ui-label">{tr("goals.currency", locale)}</span>
          <input
            className="ui-input"
            maxLength={3}
            value={draft.currency}
            disabled={disabled}
            onChange={(e) => onChange({ ...draft, currency: e.target.value.toUpperCase() })}
          />
        </label>
      </div>
      <label className="ui-field">
        <span className="ui-label">{tr("goals.targetDate", locale)}</span>
        <input
          className="ui-input"
          type="date"
          value={draft.target_date}
          disabled={disabled}
          onChange={(e) => onChange({ ...draft, target_date: e.target.value })}
        />
      </label>
      <label className="ui-field">
        <span className="ui-label">{tr("goals.currentAmount", locale)}</span>
        <input
          className="ui-input"
          inputMode="decimal"
          value={draft.current_amount}
          disabled={disabled}
          onChange={(e) => onChange({ ...draft, current_amount: e.target.value })}
        />
      </label>
      <label className="ui-field">
        <span className="ui-label">{tr("goals.linkedSource", locale)}</span>
        <select
          className="ui-input"
          value={draft.source ?? ""}
          disabled={disabled}
          onChange={(e) => onChange({ ...draft, source: e.target.value || null })}
        >
          <option value="">—</option>
          {savingsSources.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function GoalsPage(): ReactNode {
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [addDraft, setAddDraft] = useState<GoalDraft>(() => emptyDraft("USD"));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<GoalDraft>(() => emptyDraft("USD"));
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [offlineNotice, setOfflineNotice] = useState(false);

  const mutationsBlocked = preferOfflineCaches() || !navigator.onLine;

  const goalsQuery = useQuery({
    queryKey: ["goals"],
    queryFn: (ctx) => listGoals(readOptsFromQuery(ctx)),
  });

  const profileQuery = useQuery({
    queryKey: ["app-profile"],
    queryFn: (ctx) => getAppProfile(readOptsFromQuery(ctx)),
  });

  const sourcesQuery = useQuery({
    queryKey: ["sources", "all"],
    queryFn: (ctx) => listSourceNames(readOptsFromQuery(ctx)),
  });

  const baseCurrency = profileQuery.data?.base_currency ?? "USD";

  const savingsSources = useMemo(
    () =>
      (sourcesQuery.data ?? [])
        .filter((row) => row.acc_type === "SAVINGS")
        .map((row) => row.source),
    [sourcesQuery.data],
  );

  const createMutation = useMutation({
    mutationFn: (payload: GoalDraft) => createGoal(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["goals"] });
      setShowAddForm(false);
      setAddDraft(emptyDraft(baseCurrency));
      setFormError(null);
    },
    onError: (err) => setFormError(parseError(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<GoalDraft> }) => updateGoal(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["goals"] });
      setEditingId(null);
      setFormError(null);
    },
    onError: (err) => setFormError(parseError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteGoal(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["goals"] });
      const previous = queryClient.getQueryData<SavingsGoal[]>(["goals"]);
      queryClient.setQueryData<SavingsGoal[]>(["goals"], (old) => (old ?? []).filter((g) => g.id !== id));
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["goals"], context.previous);
      }
      setFormError(parseError(_err));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["goals"] });
      setDeleteConfirmId(null);
    },
  });

  function guardMutation(action: () => void): void {
    if (mutationsBlocked) {
      setOfflineNotice(true);
      return;
    }
    setOfflineNotice(false);
    action();
  }

  function openAddForm(): void {
    setAddDraft(emptyDraft(baseCurrency));
    setShowAddForm(true);
    setFormError(null);
  }

  function startEdit(goal: SavingsGoal): void {
    setEditingId(goal.id);
    setEditDraft({
      name: goal.name,
      target_amount: goal.target_amount,
      currency: goal.currency,
      target_date: goal.target_date,
      current_amount: goal.current_amount,
      source: goal.source,
    });
    setFormError(null);
  }

  function renderGoalCard(goal: SavingsGoal): ReactNode {
    const pct = progressPercent(goal.current_amount, goal.target_amount);
    const met = toNumber(goal.current_amount) != null && toNumber(goal.target_amount) != null
      && (toNumber(goal.current_amount) ?? 0) >= (toNumber(goal.target_amount) ?? 0);

    if (editingId === goal.id) {
      return (
        <Card key={goal.id}>
          <GoalFormFields
            draft={editDraft}
            onChange={setEditDraft}
            savingsSources={savingsSources}
            disabled={updateMutation.isPending}
            locale={locale}
          />
          <div style={{ display: "flex", gap: "var(--spacing-2)", marginTop: "var(--spacing-3)", flexWrap: "wrap" }}>
            <Button
              type="button"
              disabled={updateMutation.isPending}
              onClick={() =>
                guardMutation(() => {
                  updateMutation.mutate({ id: goal.id, payload: editDraft });
                })
              }
            >
              {tr("goals.save", locale)}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>
              {tr("goals.cancel", locale)}
            </Button>
          </div>
        </Card>
      );
    }

    return (
      <Card key={goal.id}>
        <div className="stack" style={{ gap: "var(--spacing-2)" }}>
          <div className="row-between">
            <strong>{goal.name}</strong>
            {met ? <span className="goals-met-badge">{tr("goals.met", locale)}</span> : null}
          </div>
          <div
            className={`goals-progress ${progressTone(pct)}`}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={trFmt("goals.progressLabel", locale, {
              current: formatMoney(goal.current_amount, goal.currency),
              target: formatMoney(goal.target_amount, goal.currency),
            })}
          >
            <div className="goals-progress__fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="muted-text" style={{ margin: 0 }}>
            {trFmt("goals.progressLabel", locale, {
              current: formatMoney(goal.current_amount, goal.currency),
              target: formatMoney(goal.target_amount, goal.currency),
            })}
          </p>
          <p className="muted-text" style={{ margin: 0 }}>
            {formatMoney(goal.per_cycle_required, goal.currency)} {payCycleSuffix(profileQuery.data, locale)}
          </p>
          <p className="muted-text" style={{ margin: 0 }}>
            {trFmt("goals.targetDateLabel", locale, { date: goal.target_date })}
          </p>
          <div style={{ display: "flex", gap: "var(--spacing-2)", flexWrap: "wrap" }}>
            <Button
              type="button"
              variant="secondary"
              title={mutationsBlocked ? tr("goals.offlineDisabled", locale) : undefined}
              onClick={() => guardMutation(() => startEdit(goal))}
            >
              {tr("goals.edit", locale)}
            </Button>
            <Button
              type="button"
              variant="ghost"
              title={mutationsBlocked ? tr("goals.offlineDisabled", locale) : undefined}
              onClick={() =>
                guardMutation(() => {
                  if (deleteConfirmId === goal.id) {
                    deleteMutation.mutate(goal.id);
                  } else {
                    setDeleteConfirmId(goal.id);
                  }
                })
              }
            >
              {deleteConfirmId === goal.id ? tr("goals.deleteConfirm", locale) : tr("goals.delete", locale)}
            </Button>
            {deleteConfirmId === goal.id ? (
              <Button type="button" variant="secondary" onClick={() => setDeleteConfirmId(null)}>
                {tr("goals.cancel", locale)}
              </Button>
            ) : null}
          </div>
        </div>
      </Card>
    );
  }

  if (goalsQuery.isLoading) {
    return <LoadingState label={tr("goals.heading", locale)} />;
  }

  if (goalsQuery.isError) {
    return <ErrorState description={parseError(goalsQuery.error)} onRetry={() => void goalsQuery.refetch()} />;
  }

  const goals = goalsQuery.data ?? [];

  return (
    <div className="stack" style={{ gap: "var(--spacing-4)" }}>
      <div className="row-between">
        <h2 style={{ margin: 0 }}>{tr("goals.heading", locale)}</h2>
        <Button
          type="button"
          title={mutationsBlocked ? tr("goals.offlineDisabled", locale) : undefined}
          onClick={() => guardMutation(openAddForm)}
          disabled={showAddForm}
        >
          {tr("goals.addGoal", locale)}
        </Button>
      </div>

      {offlineNotice || mutationsBlocked ? (
        <p className="muted-text" style={{ margin: 0 }}>
          {tr("goals.offlineDisabled", locale)}
        </p>
      ) : null}

      {formError ? (
        <p className="form-error" role="alert">
          {formError}
        </p>
      ) : null}

      {showAddForm ? (
        <Card>
          <GoalFormFields
            draft={addDraft}
            onChange={setAddDraft}
            savingsSources={savingsSources}
            disabled={createMutation.isPending}
            locale={locale}
          />
          <div style={{ display: "flex", gap: "var(--spacing-2)", marginTop: "var(--spacing-3)", flexWrap: "wrap" }}>
            <Button
              type="button"
              disabled={createMutation.isPending}
              onClick={() =>
                guardMutation(() => {
                  createMutation.mutate(addDraft);
                })
              }
            >
              {tr("goals.save", locale)}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowAddForm(false);
                setFormError(null);
              }}
            >
              {tr("goals.cancel", locale)}
            </Button>
          </div>
        </Card>
      ) : null}

      {goals.length === 0 ? (
        <p className="muted-text">{tr("goals.empty", locale)}</p>
      ) : (
        <div className="stack" style={{ gap: "var(--spacing-3)" }}>
          {goals.map((goal) => renderGoalCard(goal))}
        </div>
      )}

      <style>{`
        .goals-progress {
          height: 8px;
          border-radius: 999px;
          background: var(--color-border-subtle, rgba(255,255,255,0.12));
          overflow: hidden;
        }
        .goals-progress__fill {
          height: 100%;
          border-radius: inherit;
          transition: width 0.2s ease;
        }
        .goals-progress--good .goals-progress__fill { background: var(--color-success, #22c55e); }
        .goals-progress--mid .goals-progress__fill { background: var(--color-warning, #eab308); }
        .goals-progress--low .goals-progress__fill { background: var(--color-danger, #ef4444); }
        .goals-met-badge {
          font-size: 0.85rem;
          color: var(--color-success, #22c55e);
        }
      `}</style>
    </div>
  );
}
