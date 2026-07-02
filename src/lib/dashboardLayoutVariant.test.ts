import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import type { DashboardLayoutResponse } from "../api/dashboardLayout";
import { dashboardLayoutCacheId } from "../api/dashboardLayout";
import {
  defaultLayoutFor,
  isStsFirstMobileLayout,
  MOBILE_DEFAULT_LAYOUT,
  MOBILE_STS_LEADING_WIDGET_IDS,
  MOBILE_STS_TRAILING_ANALYTICS_IDS,
} from "../components/dashboard/widgetCatalog";
import {
  defaultLayoutResponse,
  layoutPlaceholderForDeviceClass,
} from "./dashboardLayoutPlaceholder";

function mobileCustomLayout(): DashboardLayoutResponse {
  const layout = defaultLayoutFor("mobile").map((item, index) =>
    index === 0
      ? { ...item, visible: false }
      : index === 1
        ? { ...item, size: "half" as const }
        : item,
  );
  return {
    device_class: "mobile",
    layout,
    is_default: false,
    updated_at: "2026-07-02T12:00:00Z",
  };
}

function desktopCustomLayout(): DashboardLayoutResponse {
  const layout = defaultLayoutFor("desktop").map((item, index) =>
    index === 0 ? { ...item, widget_id: "KPIRow" as const } : item,
  );
  return {
    device_class: "desktop",
    layout,
    is_default: false,
    updated_at: "2026-07-02T12:00:00Z",
  };
}

describe("dashboard layout variant isolation", () => {
  it("uses separate Dexie/cache ids per device class", () => {
    expect(dashboardLayoutCacheId("mobile")).not.toBe(dashboardLayoutCacheId("desktop"));
    expect(dashboardLayoutCacheId("mobile")).toBe("dashboard-layout:mobile");
    expect(dashboardLayoutCacheId("desktop")).toBe("dashboard-layout:desktop");
  });

  it("mobile default is STS-first and differs from desktop order", () => {
    expect(isStsFirstMobileLayout(MOBILE_DEFAULT_LAYOUT)).toBe(true);
    const mobileOrder = MOBILE_DEFAULT_LAYOUT.map((item) => item.widget_id);
    const desktopOrder = defaultLayoutFor("desktop").map((item) => item.widget_id);
    expect(mobileOrder).not.toEqual(desktopOrder);
    expect(mobileOrder[0]).toBe("KPIRow");
    expect(mobileOrder[1]).toBe("UpcomingBillsWidget");
  });

  it("STS-leading widgets are defined before analytics on mobile default", () => {
    const positions = new Map(
      MOBILE_DEFAULT_LAYOUT.map((item, index) => [item.widget_id, index]),
    );
    const leadingMax = Math.max(
      ...MOBILE_STS_LEADING_WIDGET_IDS.map((id) => positions.get(id) ?? -1),
    );
    const trailingMin = Math.min(
      ...MOBILE_STS_TRAILING_ANALYTICS_IDS.map(
        (id) => positions.get(id) ?? Number.MAX_SAFE_INTEGER,
      ),
    );
    expect(leadingMax).toBeLessThan(trailingMin);
  });

  it("placeholder never returns the wrong device class during transition", () => {
    const queryClient = new QueryClient();
    const desktop = desktopCustomLayout();
    queryClient.setQueryData(["dashboard-layout", "desktop"], desktop);

    const mobilePlaceholder = layoutPlaceholderForDeviceClass(
      queryClient,
      "mobile",
      desktop,
    );
    expect(mobilePlaceholder.device_class).toBe("mobile");
    expect(mobilePlaceholder.layout).toEqual(defaultLayoutFor("mobile"));
    expect(mobilePlaceholder.layout).not.toEqual(desktop.layout);
  });

  it("cached variant is used when crossing breakpoint mid-session", () => {
    const queryClient = new QueryClient();
    const mobile = mobileCustomLayout();
    queryClient.setQueryData(["dashboard-layout", "mobile"], mobile);

    const placeholder = layoutPlaceholderForDeviceClass(
      queryClient,
      "mobile",
      undefined,
    );
    expect(placeholder).toEqual(mobile);
    expect(placeholder.layout).not.toEqual(defaultLayoutFor("desktop"));
  });

  it("editing mobile layout does not mutate desktop query cache", () => {
    const queryClient = new QueryClient();
    const desktop = defaultLayoutResponse("desktop");
    const mobile = mobileCustomLayout();
    queryClient.setQueryData(["dashboard-layout", "desktop"], desktop);
    queryClient.setQueryData(["dashboard-layout", "mobile"], mobile);

    const patchedMobile = {
      ...mobile,
      layout: mobile.layout.map((item, index) =>
        index === 2 ? { ...item, visible: false } : item,
      ),
    };
    queryClient.setQueryData(["dashboard-layout", "mobile"], patchedMobile);

    const desktopAfter = queryClient.getQueryData<DashboardLayoutResponse>([
      "dashboard-layout",
      "desktop",
    ]);
    const mobileAfter = queryClient.getQueryData<DashboardLayoutResponse>([
      "dashboard-layout",
      "mobile",
    ]);

    expect(desktopAfter?.layout).toEqual(desktop.layout);
    expect(mobileAfter?.layout).toEqual(patchedMobile.layout);
    expect(mobileAfter?.layout).not.toEqual(desktopAfter?.layout);
  });

  it("defaultLayoutResponse is scoped to the requested device class", () => {
    const mobile = defaultLayoutResponse("mobile");
    const desktop = defaultLayoutResponse("desktop");
    expect(mobile.device_class).toBe("mobile");
    expect(desktop.device_class).toBe("desktop");
    expect(mobile.layout[0]?.widget_id).toBe("KPIRow");
    expect(desktop.layout[0]?.widget_id).toBe("QuickActions");
  });
});
