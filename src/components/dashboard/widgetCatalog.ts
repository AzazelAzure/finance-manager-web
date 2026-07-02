/**
 * Static dashboard widget catalog (F-006 T02). IDs must match API `WIDGET_CATALOG_IDS`.
 */

export const WIDGET_IDS = [
  "KPIRow",
  "ProfileOverview",
  "SourceBalances",
  "RecentTransactions",
  "UpcomingBillsWidget",
  "GoalsWidget",
  "BalanceHistoryChart",
  "SpendChart",
  "FlowChart",
  "CategoryPie",
  "TagPie",
  "QuickActions",
] as const;

export type WidgetId = (typeof WIDGET_IDS)[number];

export type WidgetSize = "full" | "half";

export type WidgetCategory = "overview" | "analytics" | "accounts" | "actions";

export type DashboardDeviceClass = "mobile" | "desktop";

export type LayoutItem = {
  widget_id: WidgetId;
  size: WidgetSize;
  visible: boolean;
};

export type WidgetCatalogEntry = {
  id: WidgetId;
  labelKey: string;
  category: WidgetCategory;
  defaultSize: WidgetSize;
  tourTargetId?: string;
  helpTitleKey?: string;
  helpContentKey?: string;
  sectionAriaKey?: string;
};

function layoutItem(widget_id: WidgetId, size: WidgetSize = "full", visible = true): LayoutItem {
  return { widget_id, size, visible };
}

/** Desktop default mirrors API `DESKTOP_DEFAULT_LAYOUT`. */
export const DESKTOP_DEFAULT_LAYOUT: LayoutItem[] = [
  layoutItem("QuickActions", "full"),
  layoutItem("KPIRow", "full"),
  layoutItem("GoalsWidget", "full"),
  layoutItem("UpcomingBillsWidget", "full"),
  layoutItem("FlowChart", "half"),
  layoutItem("SpendChart", "half"),
  layoutItem("CategoryPie", "half"),
  layoutItem("TagPie", "half"),
  layoutItem("SourceBalances", "half"),
  layoutItem("BalanceHistoryChart", "half"),
  layoutItem("ProfileOverview", "half"),
  layoutItem("RecentTransactions", "full"),
];

/** Mobile default mirrors API `MOBILE_DEFAULT_LAYOUT` (STS-first). */
export const MOBILE_DEFAULT_LAYOUT: LayoutItem[] = [
  layoutItem("KPIRow", "full"),
  layoutItem("UpcomingBillsWidget", "full"),
  layoutItem("QuickActions", "full"),
  layoutItem("SourceBalances", "full"),
  layoutItem("RecentTransactions", "full"),
  layoutItem("GoalsWidget", "full"),
  layoutItem("ProfileOverview", "full"),
  layoutItem("BalanceHistoryChart", "full"),
  layoutItem("SpendChart", "half"),
  layoutItem("FlowChart", "half"),
  layoutItem("CategoryPie", "half"),
  layoutItem("TagPie", "half"),
];

export const DEFAULT_LAYOUTS: Record<DashboardDeviceClass, LayoutItem[]> = {
  desktop: DESKTOP_DEFAULT_LAYOUT,
  mobile: MOBILE_DEFAULT_LAYOUT,
};

export function defaultLayoutFor(deviceClass: DashboardDeviceClass): LayoutItem[] {
  return DEFAULT_LAYOUTS[deviceClass].map((item) => ({ ...item }));
}

export const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  {
    id: "KPIRow",
    labelKey: "dashboard.widgets.catalog.KPIRow",
    category: "overview",
    defaultSize: "full",
    tourTargetId: "tour-kpis",
    helpTitleKey: "tour.dashboard.kpis.title",
    helpContentKey: "tour.dashboard.kpis.content",
    sectionAriaKey: "dashboard.section.kpis",
  },
  {
    id: "ProfileOverview",
    labelKey: "dashboard.widgets.catalog.ProfileOverview",
    category: "accounts",
    defaultSize: "half",
    tourTargetId: "tour-profile-overview",
    helpTitleKey: "guide.dashboard.profileOverview.title",
    helpContentKey: "guide.dashboard.profileOverview.content",
  },
  {
    id: "SourceBalances",
    labelKey: "dashboard.widgets.catalog.SourceBalances",
    category: "accounts",
    defaultSize: "half",
    tourTargetId: "tour-source-balances",
    helpTitleKey: "guide.dashboard.sourceBalances.title",
    helpContentKey: "guide.dashboard.sourceBalances.content",
  },
  {
    id: "RecentTransactions",
    labelKey: "dashboard.widgets.catalog.RecentTransactions",
    category: "overview",
    defaultSize: "full",
    tourTargetId: "tour-recent-tx",
    helpTitleKey: "guide.dashboard.recentTx.title",
    helpContentKey: "guide.dashboard.recentTx.content",
  },
  {
    id: "UpcomingBillsWidget",
    labelKey: "dashboard.widgets.catalog.UpcomingBillsWidget",
    category: "overview",
    defaultSize: "full",
    tourTargetId: "tour-upcoming-bills",
    helpTitleKey: "guide.dashboard.upcomingBills.title",
    helpContentKey: "guide.dashboard.upcomingBills.content",
    sectionAriaKey: "bills.cadence.widgetHeading",
  },
  {
    id: "GoalsWidget",
    labelKey: "dashboard.widgets.catalog.GoalsWidget",
    category: "overview",
    defaultSize: "full",
    tourTargetId: "tour-goals-widget",
    helpTitleKey: "guide.dashboard.goalsWidget.title",
    helpContentKey: "guide.dashboard.goalsWidget.content",
    sectionAriaKey: "goals.heading",
  },
  {
    id: "BalanceHistoryChart",
    labelKey: "dashboard.widgets.catalog.BalanceHistoryChart",
    category: "analytics",
    defaultSize: "half",
    tourTargetId: "tour-balance-history",
    helpTitleKey: "guide.dashboard.balanceHistory.title",
    helpContentKey: "guide.dashboard.balanceHistory.content",
  },
  {
    id: "SpendChart",
    labelKey: "dashboard.widgets.catalog.SpendChart",
    category: "analytics",
    defaultSize: "half",
    tourTargetId: "tour-spend-chart",
    helpTitleKey: "tour.dashboard.spendChart.title",
    helpContentKey: "tour.dashboard.spendChart.content",
  },
  {
    id: "FlowChart",
    labelKey: "dashboard.widgets.catalog.FlowChart",
    category: "analytics",
    defaultSize: "half",
    tourTargetId: "tour-flow-chart",
    helpTitleKey: "tour.dashboard.flowChart.title",
    helpContentKey: "tour.dashboard.flowChart.content",
  },
  {
    id: "CategoryPie",
    labelKey: "dashboard.widgets.catalog.CategoryPie",
    category: "analytics",
    defaultSize: "half",
    tourTargetId: "tour-category-pie",
    helpTitleKey: "tour.dashboard.categoryPie.title",
    helpContentKey: "tour.dashboard.categoryPie.content",
  },
  {
    id: "TagPie",
    labelKey: "dashboard.widgets.catalog.TagPie",
    category: "analytics",
    defaultSize: "half",
    tourTargetId: "tour-tag-pie",
    helpTitleKey: "tour.dashboard.tagPie.title",
    helpContentKey: "tour.dashboard.tagPie.content",
  },
  {
    id: "QuickActions",
    labelKey: "dashboard.widgets.catalog.QuickActions",
    category: "actions",
    defaultSize: "full",
    tourTargetId: "tour-quick-actions",
    helpTitleKey: "tour.dashboard.quickActions.title",
    helpContentKey: "tour.dashboard.quickActions.content",
  },
];

const catalogById = new Map(WIDGET_CATALOG.map((entry) => [entry.id, entry]));

export function getWidgetCatalogEntry(widgetId: WidgetId): WidgetCatalogEntry | undefined {
  return catalogById.get(widgetId);
}

export function isWidgetId(value: string): value is WidgetId {
  return (WIDGET_IDS as readonly string[]).includes(value);
}

export function visibleWidgetIds(layout: LayoutItem[]): Set<WidgetId> {
  return new Set(layout.filter((item) => item.visible).map((item) => item.widget_id));
}

export function layoutWidgetIds(layout: LayoutItem[]): Set<WidgetId> {
  return new Set(layout.map((item) => item.widget_id));
}
