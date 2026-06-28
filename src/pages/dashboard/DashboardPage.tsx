import { keepPreviousData, useQuery, useQueryClient, type QueryFunctionContext } from "@tanstack/react-query";
import { m, useReducedMotion } from "motion/react";
import { useCallback, useMemo, type ReactNode } from "react";
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
import { formatMoney, toNumber } from "../../lib/money";
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
import { WelcomeTourModal, buildWelcomeSteps } from "../../components/tours/WelcomeTourModal";

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
  const shouldReduceMotion = useReducedMotion();
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
  const safeToSpend = summary != null ? toNumber(summary.safe_to_spend) : null;
  const remainingExpenses = summary != null ? toNumber(summary.total_remaining_expenses) : null;
  const usesPayCycleSts = profileQuery.data?.sts_window_mode === "pay_cycle";
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

  // Welcome tour is now handled by WelcomeTourModal (modal gate + Joyride)

  return (
    <div className="stack dashboard-page">
      <WelcomeTourModal dataReady={!!data} />
      <div className="dashboard-header">
        <div>
          <h2 className="muted dashboard-title">
            {tr("dashboard.title", locale)}
          </h2>
          <h2 className="muted-text dashboard-subtitle">
            {tr("dashboard.subtitle", locale)}
          </h2>
        </div>
        <div className="dashboard-header__actions" style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <Button
            id="tour-replay-btn"
            type="button"
            variant="secondary"
            onClick={() => {
              startTour(`welcome_replay_${Date.now()}`, buildWelcomeSteps(locale));
            }}
          >
            {tr("tour.replayTour", locale)}
          </Button>
          <Button id="tour-refresh-btn" type="button" variant="secondary" onClick={() => void refetchSnapshotForced()}>
            {tr("dashboard.refresh", locale)}
          </Button>
        </div>
      </div>

      <m.section
        className="dashboard-hero"
        aria-labelledby="dashboard-safe-to-spend-title"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
        animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={shouldReduceMotion ? undefined : { duration: 0.3, ease: "easeOut" }}
      >
        <div>
          <p id="dashboard-safe-to-spend-title" className="dashboard-hero__eyebrow">
            {tr("dashboard.hero.safeToSpend", locale)}
          </p>
          <p className="dashboard-hero__value money-value">
            {safeToSpend == null ? tr("dashboard.na", locale) : formatMoney(safeToSpend, currency)}
          </p>
          <p className="dashboard-hero__description">
            {tr(usesPayCycleSts ? "dashboard.hero.safeToSpendPayCycleDescription" : "dashboard.hero.safeToSpendDescription", locale)}
          </p>
        </div>
        <div>
          <p className="dashboard-hero__support-label">
            {tr(usesPayCycleSts ? "dashboard.hero.remainingPayPeriodExpenses" : "dashboard.hero.remainingExpenses", locale)}
          </p>
          <p className="dashboard-hero__support-value money-value">
            {remainingExpenses == null ? tr("dashboard.na", locale) : formatMoney(remainingExpenses, currency)}
          </p>
        </div>
      </m.section>

      <div className="dashboard-root__quick">
        <HelpModeWrapper id="tour-quick-actions" title={tr("tour.dashboard.quickActions.title", locale)} content={tr("tour.dashboard.quickActions.content", locale)}>
          <QuickActions baseCurrency={currency} sources={sourceQuery.data ?? []} />
        </HelpModeWrapper>
      </div>

      <section className="dashboard-section" aria-label={tr("dashboard.section.kpis", locale)}>
        <HelpModeWrapper id="tour-kpis" title={tr("tour.dashboard.kpis.title", locale)} content={tr("tour.dashboard.kpis.content", locale)}>
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
        <HelpModeWrapper id="tour-filters" title={tr("tour.dashboard.filters.title", locale)} content={tr("tour.dashboard.filters.content", locale)}>
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
          <HelpModeWrapper id="tour-charts" className="dashboard-root__main dashboard-col" title={tr("tour.dashboard.flowChart.title", locale)} content={tr("tour.dashboard.flowChart.content", locale)}>
            <div id="tour-flow-chart">
              <FlowChart
                data={data.flow_series}
                baseCurrency={currency}
                isLoading={chartLoading}
                isError={isError}
                onRetry={() => void refetchSnapshotForced()}
              />
            </div>
            <div id="tour-spend-chart">
              <SpendChart
                dailySpend={data.daily_spend}
                dailyIncome={data.daily_income}
                baseCurrency={currency}
                isLoading={chartLoading}
                isError={isError}
                onRetry={() => void refetchSnapshotForced()}
              />
            </div>
            <div id="tour-category-pie">
              <CategoryPie
                expenseByCategory={data.expense_by_category}
                baseCurrency={currency}
                isLoading={chartLoading}
                isError={isError}
                onRetry={() => void refetchSnapshotForced()}
                onSelectCategory={onDrillCategory}
              />
            </div>
            <div id="tour-tag-pie">
              <TagPie
                transactions={txRows}
                baseCurrency={currency}
                isLoading={chartLoading}
                isError={isError}
                onRetry={() => void refetchSnapshotForced()}
                onSelectTag={onDrillTag}
              />
            </div>
          </HelpModeWrapper>
          <aside className="dashboard-root__side dashboard-col">
            <div id="tour-source-balances">
              <SourceBalances rows={data.source_balances} />
            </div>
            <div id="tour-profile-overview">
              <ProfileOverview profile={profileQuery.data} isError={profileQuery.isError} />
            </div>
          </aside>
        </div>
        <div id="tour-recent-tx">
          <RecentTransactions rows={txRows} baseCurrency={currency} />
        </div>
      </div>
    </div>
  );
}
