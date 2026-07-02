import { describe, expect, it } from "vitest";
import {
  DEFAULT_LAYOUTS,
  MOBILE_DEFAULT_LAYOUT,
  MOBILE_STS_LEADING_WIDGET_IDS,
  MOBILE_STS_TRAILING_ANALYTICS_IDS,
  WIDGET_CATALOG,
  WIDGET_IDS,
  defaultLayoutFor,
  isStsFirstMobileLayout,
  isWidgetId,
  visibleWidgetIds,
} from "./widgetCatalog";

describe("widgetCatalog", () => {
  it("lists every catalog widget id exactly once", () => {
    const catalogIds = WIDGET_CATALOG.map((entry) => entry.id);
    expect(catalogIds).toHaveLength(WIDGET_IDS.length);
    expect(new Set(catalogIds).size).toBe(WIDGET_IDS.length);
    for (const id of WIDGET_IDS) {
      expect(catalogIds).toContain(id);
    }
  });

  it("default layouts only reference known widget ids", () => {
    for (const deviceClass of ["desktop", "mobile"] as const) {
      const layout = defaultLayoutFor(deviceClass);
      expect(layout).toEqual(DEFAULT_LAYOUTS[deviceClass]);
      for (const item of layout) {
        expect(isWidgetId(item.widget_id)).toBe(true);
      }
    }
  });

  it("visibleWidgetIds returns only visible entries", () => {
    const layout = defaultLayoutFor("desktop").map((item, index) => ({
      ...item,
      visible: index % 2 === 0,
    }));
    const visible = visibleWidgetIds(layout);
    expect(visible.size).toBe(Math.ceil(layout.length / 2));
    for (const item of layout) {
      expect(visible.has(item.widget_id)).toBe(item.visible);
    }
  });

  it("mobile default is STS-first with survival widgets before analytics", () => {
    expect(isStsFirstMobileLayout(MOBILE_DEFAULT_LAYOUT)).toBe(true);
    const order = MOBILE_DEFAULT_LAYOUT.map((item) => item.widget_id);
    expect(order.slice(0, MOBILE_STS_LEADING_WIDGET_IDS.length)).toEqual([
      ...MOBILE_STS_LEADING_WIDGET_IDS,
    ]);
    const analyticsStart = order.findIndex((id) =>
      (MOBILE_STS_TRAILING_ANALYTICS_IDS as readonly string[]).includes(id),
    );
    expect(analyticsStart).toBeGreaterThan(
      order.indexOf(MOBILE_STS_LEADING_WIDGET_IDS.at(-1)!),
    );
  });
});
