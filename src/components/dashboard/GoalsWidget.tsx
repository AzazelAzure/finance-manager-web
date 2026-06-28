import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listGoals, type SavingsGoal } from "../../api/goals";
import { formatMoney, toNumber } from "../../lib/money";
import { tr, useLocale } from "../../lib/i18n";
import { readOptsFromQuery } from "../../offline/pwaReadBypass";
import { Card } from "../ui/Card";
import { ErrorState } from "../ui/ErrorState";
import { LoadingState } from "../ui/LoadingState";

function isUnmet(goal: SavingsGoal): boolean {
  const current = toNumber(goal.current_amount) ?? 0;
  const target = toNumber(goal.target_amount) ?? 0;
  return current < target;
}

function progressPercent(current: string, target: string): number {
  const t = toNumber(target);
  const c = toNumber(current);
  if (t == null || t <= 0 || c == null) {
    return 0;
  }
  return Math.min(100, Math.round((c / t) * 100));
}

function truncateName(name: string, max = 30): string {
  if (name.length <= max) {
    return name;
  }
  return `${name.slice(0, max - 1)}…`;
}

export function GoalsWidget(): ReactNode {
  const locale = useLocale();
  const goalsQuery = useQuery({
    queryKey: ["goals"],
    queryFn: (ctx) => listGoals(readOptsFromQuery(ctx)),
  });

  const visibleGoals = useMemo(() => {
    const rows = goalsQuery.data ?? [];
    return rows
      .filter(isUnmet)
      .sort((a, b) => a.target_date.localeCompare(b.target_date))
      .slice(0, 3);
  }, [goalsQuery.data]);

  if (goalsQuery.isLoading) {
    return (
      <Card>
        <LoadingState label={tr("goals.heading", locale)} />
      </Card>
    );
  }

  if (goalsQuery.isError) {
    return (
      <Card>
        <ErrorState
          title={tr("goals.heading", locale)}
          description={goalsQuery.error instanceof Error ? goalsQuery.error.message : "Request failed."}
          onRetry={() => void goalsQuery.refetch()}
        />
      </Card>
    );
  }

  return (
    <Card>
      <div className="stack" style={{ gap: "var(--spacing-3)" }}>
        <h3 style={{ margin: 0 }}>{tr("goals.heading", locale)}</h3>

        {visibleGoals.length === 0 ? (
          <p className="muted-text" style={{ margin: 0 }}>
            {tr("goals.widgetEmpty", locale)}{" "}
            <Link to="/app/goals">{tr("goals.manageLink", locale)}</Link>
          </p>
        ) : (
          <div className="stack" style={{ gap: "var(--spacing-3)" }}>
            {visibleGoals.map((goal) => {
              const pct = progressPercent(goal.current_amount, goal.target_amount);
              return (
                <div key={goal.id} className="stack" style={{ gap: "var(--spacing-1)" }}>
                  <strong>{truncateName(goal.name)}</strong>
                  <div
                    className="goals-widget-progress"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div className="goals-widget-progress__fill" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="muted-text" style={{ margin: 0 }}>
                    {formatMoney(goal.current_amount, goal.currency)} / {formatMoney(goal.target_amount, goal.currency)}
                  </p>
                  <p className="muted-text" style={{ margin: 0 }}>
                    {formatMoney(goal.per_cycle_required, goal.currency)} {tr("goals.perCycle", locale)}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {visibleGoals.length > 0 ? (
          <Link to="/app/goals" className="dashboard-link">
            {tr("goals.manageLink", locale)}
          </Link>
        ) : null}
      </div>

      <style>{`
        .goals-widget-progress {
          height: 6px;
          border-radius: 999px;
          background: var(--color-border-subtle, rgba(255,255,255,0.12));
          overflow: hidden;
        }
        .goals-widget-progress__fill {
          height: 100%;
          border-radius: inherit;
          background: var(--color-accent, #6366f1);
        }
      `}</style>
    </Card>
  );
}
