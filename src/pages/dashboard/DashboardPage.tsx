import { keepPreviousData, useQuery, useQueryClient, type QueryFunctionContext } from "@tanstack/react-query";
import { m, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchBalanceHistory } from "../../api/balanceHistory";
import { getAppProfile } from "../../api/profile";
import { fetchAppSnapshot } from "../../api/snapshot";
import { listCategories, listSourceNames, listTags } from "../../api/lookups";
import type { BalanceHistoryRange, SnapshotResponse } from "../../api/types";
import { DashboardWidgetGrid } from "../../components/dashboard/DashboardWidgetGrid";
import { FilterRow } from "../../components/dashboard/FilterRow";
import { ManageWidgetsPanel } from "../../components/dashboard/ManageWidgetsPanel";
import { topTagNamesFromTransactions } from "../../components/dashboard/tagAggregates";
import { visibleWidgetIds } from "../../components/dashboard/widgetCatalog";
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
import { useDashboardDeviceClass } from "../../hooks/useDashboardDeviceClass";
import { useDashboardLayoutQuery } from "../../hooks/useDashboardLayoutQuery";
import { useDebouncedDashboardLayoutSave } from "../../hooks/useDebouncedDashboardLayoutSave";
import type { LayoutItem } from "../../components/dashboard/widgetCatalog";
import "../../components/dashboard/dashboard.css";

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
  const [manageOpen, setManageOpen] = useState(false);
  const [layoutEditMode, setLayoutEditMode] = useState(false);
  const cancelLayoutSaveRef = useRef<(() => void) | null>(null);
  const layoutServerKeyRef = useRef<string | null>(null);

  const handleDeviceClassTransition = useCallback(() => {
    setManageOpen(false);
    setLayoutEditMode(false);
    cancelLayoutSaveRef.current?.();
    layoutServerKeyRef.current = null;
  }, []);

  const deviceClass = useDashboardDeviceClass(handleDeviceClassTransition);

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

  const { activeLayout, data: layoutData } = useDashboardLayoutQuery(deviceClass);

  const visibleWidgets = useMemo(() => visibleWidgetIds(activeLayout), [activeLayout]);
  const { scheduleSave, syncCommitted, cancelPendingSaves, status: layoutSaveStatus } =
    useDebouncedDashboardLayoutSave(deviceClass);

  useEffect(() => {
    cancelLayoutSaveRef.current = cancelPendingSaves;
  }, [cancelPendingSaves]);

  useEffect(() => {
    const data = layoutData;
    if (!data?.layout || data.device_class !== deviceClass) {
      return;
    }
    const serverKey = `${data.device_class}:${data.updated_at ?? "default"}:${data.is_default}`;
    if (layoutServerKeyRef.current === serverKey) {
      return;
    }
    layoutServerKeyRef.current = serverKey;
    syncCommitted(data.layout);
  }, [layoutData, deviceClass, syncCommitted]);

  const handleLayoutChange = useCallback(
    (nextLayout: LayoutItem[]) => {
      scheduleSave(nextLayout);
    },
    [scheduleSave],
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

  const needsBalanceHistory = visibleWidgets.has("BalanceHistoryChart");

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

  const [balanceRange, setBalanceRange] = useState<BalanceHistoryRange>("30d");
  const balanceHistoryQuery = useQuery({
    queryKey: ["balance-history", balanceRange] as const,
    queryFn: (ctx) => fetchBalanceHistory({ range: balanceRange }, readOptsFromQuery(ctx)),
    enabled: needsBalanceHistory,
  });

  const currency = balanceCurrency(data, profileQuery.data);
  const summary = data?.snapshot ?? null;
  const safeToSpend = summary != null ? toNumber(summary.safe_to_spend) : null;
  const remainingExpenses = summary != null ? toNumber(summary.total_remaining_expenses) : null;
  const usesPayCycleSts = profileQuery.data?.sts_window_mode === "pay_cycle" && !preferOfflineCaches();
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

  const widgetCtx = useMemo(
    () =>
      data
        ? {
            locale,
            currency,
            summary,
            data,
            txRows,
            chartLoading,
            isError,
            onRetry: () => void refetchSnapshotForced(),
            onDrillCategory,
            onDrillTag,
            profileQuery,
            sourceRows: sourceQuery.data ?? [],
            balanceHistorySeries: balanceHistoryQuery.data?.series ?? [],
            balanceHistoryCurrency: balanceHistoryQuery.data?.base_currency ?? currency,
            balanceRange,
            onBalanceRangeChange: setBalanceRange,
            balanceHistoryLoading: balanceHistoryQuery.isLoading,
            balanceHistoryError: balanceHistoryQuery.isError,
            onBalanceHistoryRetry: () => void balanceHistoryQuery.refetch(),
          }
        : null,
    [
      locale,
      currency,
      summary,
      data,
      txRows,
      chartLoading,
      isError,
      refetchSnapshotForced,
      onDrillCategory,
      onDrillTag,
      profileQuery,
      sourceQuery.data,
      balanceHistoryQuery,
      balanceRange,
    ],
  );

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

  if (!data || !widgetCtx) {
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
      <WelcomeTourModal dataReady={!!data} />
      <ManageWidgetsPanel
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        deviceClass={deviceClass}
        layout={activeLayout}
      />
      <div className="dashboard-header">
        <div>
          <h2 className="muted dashboard-title">
            {tr("dashboard.title", locale)}
          </h2>
          <h2 className="muted-text dashboard-subtitle">
            {tr("dashboard.subtitle", locale)}
          </h2>
        </div>
        <div className="dashboard-header__actions">
          <HelpModeWrapper
            id="tour-layout-edit"
            title={tr("guide.dashboard.layoutEdit.title", locale)}
            content={tr("guide.dashboard.layoutEdit.content", locale)}
          >
            <Button
              id="tour-layout-edit-btn"
              type="button"
              variant={layoutEditMode ? "primary" : "secondary"}
              size="compact"
              aria-pressed={layoutEditMode}
              onClick={() => setLayoutEditMode((on) => !on)}
            >
              {layoutEditMode
                ? tr(
                    deviceClass === "mobile"
                      ? "dashboard.widgets.layoutEdit.on.mobile"
                      : "dashboard.widgets.layoutEdit.on",
                    locale,
                  )
                : tr(
                    deviceClass === "mobile"
                      ? "dashboard.widgets.layoutEdit.off.mobile"
                      : "dashboard.widgets.layoutEdit.off",
                    locale,
                  )}
            </Button>
          </HelpModeWrapper>
          <HelpModeWrapper
            id="tour-manage-widgets"
            title={tr("guide.dashboard.manageWidgets.title", locale)}
            content={tr("guide.dashboard.manageWidgets.content", locale)}
          >
            <Button
              id="tour-manage-widgets-btn"
              type="button"
              variant="secondary"
              size="compact"
              onClick={() => setManageOpen(true)}
            >
              {tr(
                deviceClass === "mobile" ? "dashboard.widgets.manage.mobile" : "dashboard.widgets.manage",
                locale,
              )}
            </Button>
          </HelpModeWrapper>
          <Button
            id="tour-replay-btn"
            type="button"
            variant="secondary"
            size="compact"
            onClick={() => {
              startTour(`welcome_replay_${Date.now()}`, buildWelcomeSteps(locale));
            }}
          >
            {tr(deviceClass === "mobile" ? "tour.replayTour.mobile" : "tour.replayTour", locale)}
          </Button>
          <Button
            id="tour-refresh-btn"
            type="button"
            variant="secondary"
            size="compact"
            onClick={() => void refetchSnapshotForced()}
          >
            {tr("dashboard.refresh", locale)}
          </Button>
        </div>
      </div>

      <HelpModeWrapper
        id="tour-safe-to-spend"
        title={tr("guide.dashboard.safeToSpend.title", locale)}
        content={tr("guide.dashboard.safeToSpend.content", locale)}
      >
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
      </HelpModeWrapper>

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

      <DashboardWidgetGrid
        key={deviceClass}
        layout={activeLayout}
        ctx={widgetCtx}
        deviceClass={deviceClass}
        editMode={layoutEditMode}
        onLayoutChange={handleLayoutChange}
        saveStatus={layoutSaveStatus}
      />
    </div>
  );
}
