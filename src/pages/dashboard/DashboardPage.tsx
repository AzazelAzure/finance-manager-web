import { keepPreviousData, useQuery, useQueryClient, type QueryFunctionContext } from "@tanstack/react-query";
import { useCallback, useMemo, useEffect, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getAppProfile } from "../../api/profile";
import { fetchAppSnapshot } from "../../api/snapshot";
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
import { tr, useLocale } from "../../lib/i18n";
import { preferOfflineCaches } from "../../offline/connectivity";
import { readOptsFromQuery } from "../../offline/pwaReadBypass";
import { HelpModeWrapper, useTour } from "../../components/tours/TourProvider";

function balanceCurrency(data: SnapshotResponse | undefined, profile: { base_currency: string } | undefined): string {
  if (profile?.base_currency) {
    return profile.base_currency;
  }
  if (data && data.source_balances.length > 0) {
    return firstCurrency(data.source_balances);
  }
  return "USD";
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
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const nav = useNavigate();
  const { startTour } = useTour();
  const searchString = searchParams.toString();
  const appliedKey = useMemo(
    () => appliedSnapshotKey(new URLSearchParams(searchString)),
    [searchString],
  );
  const initialFilterDraft = useMemo(
    () => urlSearchParamsToFilterDraft(new URLSearchParams(searchString)),
    [searchString],
  );

  const snapshotParams = useMemo(
    () => searchParamsToApiParams(new URLSearchParams(searchString)),
    [searchString],
  );

  const loadSnapshot = useCallback(
    ({ meta }: QueryFunctionContext<readonly ["snapshot", string]>) =>
      fetchAppSnapshot(snapshotParams, {
        forceNetwork: Boolean((meta as { forceNetwork?: boolean } | undefined)?.forceNetwork),
      }),
    [snapshotParams],
  );

  const { data, isError, isLoading, error, isFetching } = useQuery({
    queryKey: ["snapshot", appliedKey] as const,
    queryFn: loadSnapshot,
    placeholderData: keepPreviousData,
  });

  const refetchSnapshotForced = useCallback(
    () =>
      void queryClient.fetchQuery({
        queryKey: ["snapshot", appliedKey] as const,
        queryFn: () =>
          fetchAppSnapshot(snapshotParams, {
            forceNetwork: !preferOfflineCaches(),
          }),
      }),
    [queryClient, appliedKey, snapshotParams],
  );

  const profileQuery = useQuery({
    queryKey: ["app-profile"] as const,
    queryFn: (ctx) => getAppProfile(readOptsFromQuery(ctx)),
  });

  const tagsQuery = useQuery({
    queryKey: ["tags", "all"] as const,
    queryFn: (ctx) => listTags(readOptsFromQuery(ctx)),
  });

  const catQuery = useQuery({
    queryKey: ["categories", "all"] as const,
    queryFn: (ctx) => listCategories(readOptsFromQuery(ctx)),
  });

  const sourceQuery = useQuery({
    queryKey: ["sources", "all"] as const,
    queryFn: (ctx) => listSourceNames(readOptsFromQuery(ctx)),
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
          title={tr("dashboard.error.title", locale)}
          description={`${tr("dashboard.error.description", locale)}: ${errMsg}.`}
          onRetry={() => void refetchSnapshotForced()}
        />
      </div>
    );
  }

  if (!data && (isLoading || isFetching)) {
    return (
      <Card>
        <LoadingState label={tr("dashboard.loading", locale)} />
      </Card>
    );
  }

  if (!data) {
    return (
      <ErrorState
        title={tr("dashboard.noData.title", locale)}
        onRetry={() => void refetchSnapshotForced()}
        description={tr("dashboard.noData.description", locale)}
      />
    );
  }

  // Trigger linear tour when data is loaded
  useEffect(() => {
    if (data) {
      const timer = setTimeout(() => {
        startTour('dashboard_linear_tour', [
          { target: '#tour-kpis', content: 'Use KPI cards to spot period trends quickly.', disableBeacon: true, title: 'KPI Cards' },
          { target: '#tour-filters', content: 'Apply filters first, then refresh to compare snapshots.', title: 'Dashboard Filters' },
          { target: '#tour-quick-actions', content: 'Quick add supports income, expense, transfer, and bill flows.', title: 'Quick Add' },
          { target: '#tour-charts', content: 'Chart slices drill to detailed transactions.', title: 'Charts' }
        ] as any);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [data, startTour]);

  return (
    <div className="stack dashboard-page">
      <div className="dashboard-header">
        <div>
          <h2 className="muted dashboard-title">
            {tr("dashboard.title", locale)}
          </h2>
          <p className="muted-text dashboard-subtitle">
            {tr("dashboard.subtitle", locale)}
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => void refetchSnapshotForced()}>
          {tr("dashboard.refresh", locale)}
        </Button>
      </div>

      <div className="dashboard-root__quick">
        <HelpModeWrapper id="tour-quick-actions" title="Quick Add" content="Quick add supports income, expense, transfer, and bill flows.">
          <QuickActions baseCurrency={currency} sources={sourceQuery.data ?? []} />
        </HelpModeWrapper>
      </div>

      <section className="dashboard-section" aria-label={tr("dashboard.section.kpis", locale)}>
        <HelpModeWrapper id="tour-kpis" title="KPI Cards" content="Use KPI cards to spot period trends quickly.">
          <KPIRow
            currency={currency}
            summary={summary}
            totalIncome={data.total_income_for_month}
            totalExpenses={data.total_expenses_for_month}
            totalLeaks={data.total_leaks_for_month}
            transactionCount={txRows.length}
          />
        </HelpModeWrapper>
      </section>

      <section className="dashboard-section" aria-label={tr("dashboard.section.filters", locale)}>
        <HelpModeWrapper id="tour-filters" title="Dashboard Filters" content="Apply filters first, then refresh to compare snapshots.">
          <FilterRow
            key={appliedKey}
            initialDraft={initialFilterDraft}
            onApply={onApply}
            onRefresh={() => void refetchSnapshotForced()}
            onReset={onReset}
            topTagNames={topTagNames}
            allTagNames={tagsQuery.data ?? []}
            categoryNames={catQuery.data ?? []}
            sourceNames={sourceNameList}
            currencyOptions={currencyOptions}
            isRefetching={isFetching}
          />
        </HelpModeWrapper>
      </section>

      <div className="dashboard-root">
        <div className="dashboard-root__row">
          <HelpModeWrapper id="tour-charts" className="dashboard-root__main dashboard-col" title="Charts" content="Chart slices drill to detailed transactions.">
            <FlowChart
              data={data.flow_series}
              baseCurrency={currency}
              isLoading={chartLoading}
              isError={isError}
              onRetry={() => void refetchSnapshotForced()}
            />
            <SpendChart
              dailySpend={data.daily_spend}
              dailyIncome={data.daily_income}
              baseCurrency={currency}
              isLoading={chartLoading}
              isError={isError}
              onRetry={() => void refetchSnapshotForced()}
            />
            <CategoryPie
              expenseByCategory={data.expense_by_category}
              baseCurrency={currency}
              isLoading={chartLoading}
              isError={isError}
              onRetry={() => void refetchSnapshotForced()}
              onSelectCategory={onDrillCategory}
            />
            <TagPie
              transactions={txRows}
              baseCurrency={currency}
              isLoading={chartLoading}
              isError={isError}
              onRetry={() => void refetchSnapshotForced()}
              onSelectTag={onDrillTag}
            />
          </HelpModeWrapper>
          <aside className="dashboard-root__side dashboard-col">
            <SourceBalances rows={data.source_balances} />
            <ProfileOverview profile={profileQuery.data} isError={profileQuery.isError} />
          </aside>
        </div>
        <RecentTransactions rows={txRows} baseCurrency={currency} />
      </div>
    </div>
  );
}
