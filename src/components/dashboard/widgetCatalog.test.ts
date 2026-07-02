import { describe, expect, it } from "vitest";
import {
  DEFAULT_LAYOUTS,
  WIDGET_CATALOG,
  WIDGET_IDS,
  defaultLayoutFor,
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
});
