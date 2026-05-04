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

  // Trigger linear tour when data is loaded
  useEffect(() => {
    if (data) {
      const timer = setTimeout(() => {
        startTour('dashboard_linear_tour', [
          { 
            target: '#tour-kpis', 
            title: 'Period Summary',
            content: 'Summary of your Income, Expenses, and Net Flow for the selected period. Green indicates a surplus, Red a deficit.', 
            disableBeacon: true 
          },
          { 
            target: '#tour-filters', 
            title: 'Smart Filters',
            content: 'Filter data by date range, specific accounts, or categories. Click the Search icon to apply your changes.' 
          },
          { 
            target: '#tour-quick-actions', 
            title: 'Instant Logging',
            content: 'Record a new expense, income, or transfer in seconds. You can also pick from common bills here.' 
          },
          { 
            target: '#tour-flow-chart', 
            title: 'Income vs Expense Flow',
            content: 'This bar chart shows your daily income vs expenses. Use it to identify days where you overspend or when your biggest income hits arrive.' 
          },
          { 
            target: '#tour-spend-chart', 
            title: 'Spending Velocity',
            content: 'The line chart tracks your cumulative spending throughout the month. It helps you predict if you will stay within budget.' 
          },
          { 
            target: '#tour-category-chart', 
            title: 'Expense Breakdown',
            content: 'Visualize which categories consume most of your budget. Click any slice to see the exact transactions.' 
          },
          { 
            target: '#tour-tag-chart', 
            title: 'Spending by Tag',
            content: 'Tags help you group transactions across categories (e.g., #vacation). This pie shows your tagged spending distribution.' 
          },
          { 
            target: '#tour-source-balances', 
            title: 'Account Balances',
            content: 'Check the real-time balance of all your connected sources (Bank, Gcash, Cash, etc.) in one place.' 
          }
        ] as any);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [data, startTour]);

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



  return (
    <div className="stack dashboard-page">
      <div className="dashboard-header">
        <div>
          <h2 className="muted dashboard-title">
            {tr("dashboard.title", locale)}
          </h2>
          <h2 className="muted-text dashboard-subtitle">
            {tr("dashboard.subtitle", locale)}
          </h2>
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
          <div className="dashboard-root__main dashboard-col">
            <HelpModeWrapper id="tour-flow-chart" title="Income vs Expense Flow" content="Visualize your daily cash flow.">
              <FlowChart
                data={data.flow_series}
                baseCurrency={currency}
                isLoading={chartLoading}
                isError={isError}
                onRetry={() => void refetchSnapshotForced()}
              />
            </HelpModeWrapper>
            <HelpModeWrapper id="tour-spend-chart" title="Spending Velocity" content="Track your cumulative spending vs budget.">
              <SpendChart
                dailySpend={data.daily_spend}
                dailyIncome={data.daily_income}
                baseCurrency={currency}
                isLoading={chartLoading}
                isError={isError}
                onRetry={() => void refetchSnapshotForced()}
              />
            </HelpModeWrapper>
            <HelpModeWrapper id="tour-category-chart" title="Expense Breakdown" content="See where your money goes by category.">
              <CategoryPie
                expenseByCategory={data.expense_by_category}
                baseCurrency={currency}
                isLoading={chartLoading}
                isError={isError}
                onRetry={() => void refetchSnapshotForced()}
                onSelectCategory={onDrillCategory}
              />
            </HelpModeWrapper>
            <HelpModeWrapper id="tour-tag-chart" title="Spending by Tag" content="Distribution of tagged transactions.">
              <TagPie
                transactions={txRows}
                baseCurrency={currency}
                isLoading={chartLoading}
                isError={isError}
                onRetry={() => void refetchSnapshotForced()}
                onSelectTag={onDrillTag}
              />
            </HelpModeWrapper>
          </div>
          <aside className="dashboard-root__side dashboard-col">
            <HelpModeWrapper id="tour-source-balances" title="Account Balances" content="Real-time wealth distribution across sources.">
              <SourceBalances rows={data.source_balances} />
            </HelpModeWrapper>
            <ProfileOverview profile={profileQuery.data} isError={profileQuery.isError} />
          </aside>
        </div>
        <RecentTransactions rows={txRows} baseCurrency={currency} />
      </div>
    </div>
  );
}
