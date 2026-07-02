import { clsx } from "clsx";
import type { ReactNode } from "react";
import type {
  AppProfileResponse,
  BalanceHistoryPoint,
  BalanceHistoryRange,
  SnapshotResponse,
  SourceRow,
} from "../../api/types";
import { BalanceHistoryChart } from "./BalanceHistoryChart";
import { CategoryPie } from "./CategoryPie";
import { FlowChart } from "./FlowChart";
import { GoalsWidget } from "./GoalsWidget";
import { KPIRow } from "./KPIRow";
import { ProfileOverview } from "./ProfileOverview";
import { QuickActions } from "./QuickActions";
import { RecentTransactions } from "./RecentTransactions";
import { SourceBalances } from "./SourceBalances";
import { SpendChart } from "./SpendChart";
import { TagPie } from "./TagPie";
import { UpcomingBillsWidget } from "./UpcomingBillsWidget";
import { HelpModeWrapper } from "../tours/TourProvider";
import { tr, type AppLocale } from "../../lib/i18n";
import type { LayoutItem, WidgetId } from "./widgetCatalog";
import { getWidgetCatalogEntry } from "./widgetCatalog";
import type { UseQueryResult } from "@tanstack/react-query";

export type DashboardWidgetContext = {
  locale: AppLocale;
  currency: string;
  summary: SnapshotResponse["snapshot"];
  data: SnapshotResponse;
  txRows: SnapshotResponse["transactions_for_month"];
  chartLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onDrillCategory: (name: string) => void;
  onDrillTag: (name: string) => void;
  profileQuery: UseQueryResult<AppProfileResponse>;
  sourceRows: SourceRow[];
  balanceHistorySeries: BalanceHistoryPoint[];
  balanceHistoryCurrency: string;
  balanceRange: BalanceHistoryRange;
  onBalanceRangeChange: (range: BalanceHistoryRange) => void;
  balanceHistoryLoading: boolean;
  balanceHistoryError: boolean;
  onBalanceHistoryRetry: () => void;
};

function wrapWithHelp(
  entry: ReturnType<typeof getWidgetCatalogEntry>,
  locale: AppLocale,
  children: ReactNode,
  className?: string,
): ReactNode {
  if (!entry?.helpTitleKey || !entry.helpContentKey || !entry.tourTargetId) {
    return children;
  }
  return (
    <HelpModeWrapper
      id={entry.tourTargetId}
      className={className}
      title={tr(entry.helpTitleKey, locale)}
      content={tr(entry.helpContentKey, locale)}
    >
      {children}
    </HelpModeWrapper>
  );
}

export function renderDashboardWidget(widgetId: WidgetId, ctx: DashboardWidgetContext): ReactNode {
  const entry = getWidgetCatalogEntry(widgetId);
  const locale = ctx.locale;

  switch (widgetId) {
    case "QuickActions":
      return wrapWithHelp(
        entry,
        locale,
        <QuickActions baseCurrency={ctx.currency} sources={ctx.sourceRows} />,
      );
    case "KPIRow":
      return wrapWithHelp(
        entry,
        locale,
        <KPIRow
          currency={ctx.currency}
          summary={ctx.summary}
          totalIncome={ctx.data.total_income_for_month}
          totalExpenses={ctx.data.total_expenses_for_month}
          totalLeaks={ctx.data.total_leaks_for_month}
          transactionCount={ctx.txRows.length}
        />,
      );
    case "GoalsWidget":
      return wrapWithHelp(entry, locale, <GoalsWidget />);
    case "UpcomingBillsWidget":
      return wrapWithHelp(entry, locale, <UpcomingBillsWidget />);
    case "FlowChart":
      return wrapWithHelp(
        entry,
        locale,
        <FlowChart
          data={ctx.data.flow_series}
          baseCurrency={ctx.currency}
          isLoading={ctx.chartLoading}
          isError={ctx.isError}
          onRetry={ctx.onRetry}
        />,
      );
    case "SpendChart":
      return wrapWithHelp(
        entry,
        locale,
        <SpendChart
          dailySpend={ctx.data.daily_spend}
          dailyIncome={ctx.data.daily_income}
          baseCurrency={ctx.currency}
          isLoading={ctx.chartLoading}
          isError={ctx.isError}
          onRetry={ctx.onRetry}
        />,
      );
    case "CategoryPie":
      return wrapWithHelp(
        entry,
        locale,
        <CategoryPie
          expenseByCategory={ctx.data.expense_by_category}
          baseCurrency={ctx.currency}
          isLoading={ctx.chartLoading}
          isError={ctx.isError}
          onRetry={ctx.onRetry}
          onSelectCategory={ctx.onDrillCategory}
        />,
      );
    case "TagPie":
      return wrapWithHelp(
        entry,
        locale,
        <TagPie
          transactions={ctx.txRows}
          baseCurrency={ctx.currency}
          isLoading={ctx.chartLoading}
          isError={ctx.isError}
          onRetry={ctx.onRetry}
          onSelectTag={ctx.onDrillTag}
        />,
      );
    case "SourceBalances":
      return wrapWithHelp(
        entry,
        locale,
        <SourceBalances rows={ctx.data.source_balances} />,
      );
    case "BalanceHistoryChart":
      return wrapWithHelp(
        entry,
        locale,
        <BalanceHistoryChart
          series={ctx.balanceHistorySeries}
          baseCurrency={ctx.balanceHistoryCurrency}
          range={ctx.balanceRange}
          onRangeChange={ctx.onBalanceRangeChange}
          isLoading={ctx.balanceHistoryLoading}
          isError={ctx.balanceHistoryError}
          onRetry={ctx.onBalanceHistoryRetry}
        />,
      );
    case "ProfileOverview":
      return wrapWithHelp(
        entry,
        locale,
        <ProfileOverview profile={ctx.profileQuery.data} isError={ctx.profileQuery.isError} />,
      );
    case "RecentTransactions":
      return wrapWithHelp(
        entry,
        locale,
        <RecentTransactions rows={ctx.txRows} baseCurrency={ctx.currency} />,
      );
    default:
      return null;
  }
}

type SlotProps = {
  item: LayoutItem;
  ctx: DashboardWidgetContext;
};

export function DashboardWidgetSlot({ item, ctx }: SlotProps): ReactNode {
  if (!item.visible) {
    return null;
  }
  const entry = getWidgetCatalogEntry(item.widget_id);
  const content = renderDashboardWidget(item.widget_id, ctx);
  if (!content) {
    return null;
  }

  const sectionLabel = entry?.sectionAriaKey
    ? tr(entry.sectionAriaKey, ctx.locale)
    : entry
      ? tr(entry.labelKey, ctx.locale)
      : item.widget_id;

  return (
    <section
      className={clsx(
        "dashboard-widget-slot",
        item.size === "full" ? "dashboard-widget-slot--full" : "dashboard-widget-slot--half",
      )}
      aria-label={sectionLabel}
    >
      {content}
    </section>
  );
}
