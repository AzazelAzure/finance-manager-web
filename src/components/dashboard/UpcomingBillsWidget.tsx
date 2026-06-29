import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listUpcomingExpenses } from "../../api/upcomingExpenses";
import { formatBillCadenceLabel } from "../../lib/billCadence";
import { formatMoney } from "../../lib/money";
import { tr, useLocale } from "../../lib/i18n";
import { readOptsFromQuery } from "../../offline/pwaReadBypass";
import { Card } from "../ui/Card";
import { ErrorState } from "../ui/ErrorState";
import { LoadingState } from "../ui/LoadingState";

export function UpcomingBillsWidget(): ReactNode {
  const locale = useLocale();
  const upcomingQuery = useQuery({
    queryKey: ["upcoming-expenses", "all"] as const,
    queryFn: (ctx) => listUpcomingExpenses(readOptsFromQuery(ctx)),
  });

  const visibleBills = useMemo(() => {
    return (upcomingQuery.data ?? [])
      .filter((row) => row.recurring_flag && !row.paid_flag)
      .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.name.localeCompare(b.name))
      .slice(0, 3);
  }, [upcomingQuery.data]);

  if (upcomingQuery.isLoading) {
    return (
      <Card>
        <LoadingState label={tr("bills.cadence.widgetHeading", locale)} />
      </Card>
    );
  }

  if (upcomingQuery.isError) {
    return (
      <Card>
        <ErrorState
          title={tr("bills.cadence.widgetHeading", locale)}
          description={upcomingQuery.error instanceof Error ? upcomingQuery.error.message : "Request failed."}
          onRetry={() => void upcomingQuery.refetch()}
        />
      </Card>
    );
  }

  return (
    <Card>
      <div className="stack" style={{ gap: "var(--spacing-3)" }}>
        <h3 style={{ margin: 0 }}>{tr("bills.cadence.widgetHeading", locale)}</h3>
        {visibleBills.length === 0 ? (
          <p className="muted-text" style={{ margin: 0 }}>
            {tr("bills.cadence.widgetEmpty", locale)}{" "}
            <Link to="/app/upcoming-expenses">{tr("upcoming.title", locale)}</Link>
          </p>
        ) : (
          <div className="stack" style={{ gap: "var(--spacing-3)" }}>
            {visibleBills.map((row) => (
              <div key={row.name} className="row-between" style={{ gap: 12 }}>
                <div className="stack" style={{ gap: 4, minWidth: 0 }}>
                  <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</strong>
                  <span className="muted-text" style={{ fontSize: "var(--font-xs)" }}>
                    {tr("upcoming.due", locale)} {row.due_date} ·{" "}
                    {formatBillCadenceLabel(locale, row.cadence, row.custom_interval_days)}
                  </span>
                </div>
                <span className="money-value">{formatMoney(row.amount, row.currency)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
