import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getAppProfile } from "../../api/profile";
import { getSnapshot } from "../../api/snapshot";
import { listCategories, listSourceNames, listTags } from "../../api/lookups";
import type { SnapshotResponse } from "../../api/types";
import { CategoryPie } from "../../components/dashboard/CategoryPie";
import { FilterRow } from "../../components/dashboard/FilterRow";
import { FlowChart } from "../../components/dashboard/FlowChart";
import { KPIRow } from "../../components/dashboard/KPIRow";
import { ProfileOverview } from "../../components/dashboard/ProfileOverview";
import { QuickActions } from "../../components/dashboard/QuickActions";
import { RecentTransactions } from "../../components/dashboard/RecentTransactions";
import { SourceBalances } from "../../components/dashboard/SourceBalances";
import { SpendChart } from "../../components/dashboard/SpendChart";
import { TagPie } from "../../components/dashboard/TagPie";
import { topTagNamesFromTransactions } from "../../components/dashboard/tagAggregates";
import "../../components/dashboard/dashboard.css";
import { Button } from "../../components/ui/Button";
import { ErrorState } from "../../components/ui/ErrorState";
import { LoadingState } from "../../components/ui/LoadingState";
import { Card } from "../../components/ui/Card";
import {
  type DashboardFilterDraft,
  appliedSnapshotKey,
  filterDraftToURLSearchParams,
  searchParamsToApiParams,
  urlSearchParamsToFilterDraft,
} from "../../lib/dashboardQueryParams";
import { firstCurrency } from "./dashboardUtil";

function balanceCurrency(data: SnapshotResponse | undefined, profile: { base_currency: string } | undefined): string {
  if (data && data.source_balances.length > 0) {
    return firstCurrency(data.source_balances);
  }
  return profile?.base_currency ?? "USD";
}

function appendDrill(
  sp: ReturnType<typeof useSearchParams>[0],
  extra: Record<string, string>,
): string {
  const p = new URLSearchParams(sp.toString());
  p.set("fromDashboard", "1");
  for (const [k, v] of Object.entries(extra)) {
    if (v) {
      p.set(k, v);
    } else {
      p.delete(k);
    }
  }
  return `?${p.toString()}`;
}

export function DashboardPage(): ReactNode {
  const [searchParams, setSearchParams] = useSearchParams();
  const nav = useNavigate();
  const appliedKey = useMemo(() => appliedSnapshotKey(searchParams), [searchParams]);
  const initialFilterDraft = useMemo(() => urlSearchParamsToFilterDraft(searchParams), [searchParams]);

  const { data, isError, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["snapshot", appliedKey] as const,
    queryFn: () => {
      return getSnapshot(searchParamsToApiParams(searchParams));
    },
    placeholderData: keepPreviousData,
  });

  const profileQuery = useQuery({
    queryKey: ["app-profile"] as const,
    queryFn: getAppProfile,
  });

  const tagsQuery = useQuery({
    queryKey: ["tags", "all"] as const,
    queryFn: listTags,
  });

  const catQuery = useQuery({
    queryKey: ["categories", "all"] as const,
    queryFn: listCategories,
  });

  const sourceQuery = useQuery({
    queryKey: ["sources", "all"] as const,
    queryFn: listSourceNames,
  });

  const currency = balanceCurrency(data, profileQuery.data);
  const summary = data?.snapshot ?? null;
  const txRows = useMemo(() => data?.transactions_for_month ?? [], [data]);
  const topTagNames = useMemo(
    () => topTagNamesFromTransactions(data?.transactions_for_month ?? [], 8),
    [data?.transactions_for_month],
  );

  const sourceNameList = useMemo(() => {
    return (sourceQuery.data ?? []).map((s) => s.source);
  }, [sourceQuery.data]);

  const currencyOptions = useMemo(() => {
    const ccy = new Set<string>();
    ccy.add(currency);
    (sourceQuery.data ?? []).forEach((s) => ccy.add(s.currency));
    if (profileQuery.data?.base_currency) {
      ccy.add(profileQuery.data.base_currency);
    }
    return Array.from(ccy);
  }, [sourceQuery.data, profileQuery.data, currency]);

  const onDrillCategory = useCallback(
    (name: string) => {
      const q = appendDrill(searchParams, { category: name });
      nav({ pathname: "/app/transactions", search: q });
    },
    [nav, searchParams],
  );

  const onDrillTag = useCallback(
    (name: string) => {
      if (!name) {
        const q = appendDrill(searchParams, { untagged: "1" });
        nav({ pathname: "/app/transactions", search: q });
        return;
      }
      const q = appendDrill(searchParams, { tag_name: name });
      nav({ pathname: "/app/transactions", search: q });
    },
    [nav, searchParams],
  );

  const onApply = useCallback(
    (d: DashboardFilterDraft) => {
      setSearchParams(filterDraftToURLSearchParams(d), { replace: true });
    },
    [setSearchParams],
  );

  const onReset = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  const chartLoading = isLoading && !data;
  const errMsg = error instanceof Error ? error.message : "Unknown error";

  if (isError && !data) {
    return (
      <div className="stack dashboard-page">
        <ErrorState
          title="Dashboard data failed"
          description={`Unable to load snapshot: ${errMsg}. Check API, proxy, or try again.`}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  if (!data && (isLoading || isFetching)) {
    return (
      <Card>
        <LoadingState label="Loading dashboard data…" />
      </Card>
    );
  }

  if (!data) {
    return <ErrorState title="No data" onRetry={() => void refetch()} description="No snapshot was returned." />;
  }

  return (
    <div className="stack dashboard-page" style={{ maxWidth: 1920, margin: "0 auto" }}>
      <div className="dashboard-header">
        <div>
          <h2 className="muted" style={{ margin: 0, fontSize: "var(--font-xl)" }}>
            Dashboard
          </h2>
          <p className="muted-text" style={{ margin: "0.25rem 0 0" }}>
            Account snapshot. Adjust filters, then <strong>Apply</strong> to refetch. Filters are stored in the URL.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => void refetch()}>
          Refresh
        </Button>
      </div>

      <section className="dashboard-section" aria-label="KPIs">
        <KPIRow
          currency={currency}
          summary={summary}
          totalIncome={data.total_income_for_month}
          totalExpenses={data.total_expenses_for_month}
          totalLeaks={data.total_leaks_for_month}
          transactionCount={txRows.length}
        />
      </section>

      <section className="dashboard-section" aria-label="Filters">
        <FilterRow
          key={appliedKey}
          initialDraft={initialFilterDraft}
          onApply={onApply}
          onRefresh={() => void refetch()}
          onReset={onReset}
          topTagNames={topTagNames}
          allTagNames={tagsQuery.data ?? []}
          categoryNames={catQuery.data ?? []}
          sourceNames={sourceNameList}
          currencyOptions={currencyOptions}
          isRefetching={isFetching}
        />
      </section>

      <div className="dashboard-root">
        <div className="dashboard-root__row">
          <div className="dashboard-root__main" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <FlowChart
              data={data.flow_series}
              baseCurrency={currency}
              isLoading={chartLoading}
              isError={isError}
              onRetry={() => void refetch()}
            />
            <SpendChart
              dailySpend={data.daily_spend}
              dailyIncome={data.daily_income}
              baseCurrency={currency}
              isLoading={chartLoading}
              isError={isError}
              onRetry={() => void refetch()}
            />
            <CategoryPie
              expenseByCategory={data.expense_by_category}
              baseCurrency={currency}
              isLoading={chartLoading}
              isError={isError}
              onRetry={() => void refetch()}
              onSelectCategory={onDrillCategory}
            />
            <TagPie
              transactions={txRows}
              baseCurrency={currency}
              isLoading={chartLoading}
              isError={isError}
              onRetry={() => void refetch()}
              onSelectTag={onDrillTag}
            />
          </div>
          <aside className="dashboard-root__side" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <SourceBalances rows={data.source_balances} />
            <ProfileOverview profile={profileQuery.data} isError={profileQuery.isError} />
            <QuickActions />
          </aside>
        </div>
        <RecentTransactions rows={txRows} baseCurrency={currency} />
      </div>
    </div>
  );
}
