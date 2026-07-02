import { describe, expect, it } from "vitest";
import { defaultLayoutFor } from "../components/dashboard/widgetCatalog";
import {
  layoutItemsEqual,
  reorderLayoutItems,
  setWidgetSizeInLayout,
  visibleLayoutItems,
} from "../lib/dashboardLayoutEditor";

describe("dashboardLayoutEditor", () => {
  const desktop = defaultLayoutFor("desktop");

  it("reorders widgets by id", () => {
    const first = desktop[0]!.widget_id;
    const third = desktop[2]!.widget_id;
    const next = reorderLayoutItems(desktop, first, third);
    expect(next[0]!.widget_id).toBe(desktop[1]!.widget_id);
    expect(next[1]!.widget_id).toBe(third);
    expect(next[2]!.widget_id).toBe(first);
  });

  it("returns the same layout when ids are missing or equal", () => {
    expect(reorderLayoutItems(desktop, "KPIRow", "KPIRow")).toBe(desktop);
    expect(reorderLayoutItems(desktop, "KPIRow", "NotAWidget" as "KPIRow")).toBe(desktop);
  });

  it("updates size tier for one widget", () => {
    const target = desktop[4]!;
    const next = setWidgetSizeInLayout(desktop, target.widget_id, "full");
    expect(next[4]!.size).toBe("full");
    expect(next[4]!.widget_id).toBe(target.widget_id);
    expect(next[3]!.size).toBe(desktop[3]!.size);
  });

  it("filters visible layout items in order", () => {
    const mixed = desktop.map((item, index) => ({
      ...item,
      visible: index % 2 === 0,
    }));
    const visible = visibleLayoutItems(mixed);
    expect(visible).toHaveLength(Math.ceil(desktop.length / 2));
    expect(visible.every((item) => item.visible)).toBe(true);
  });

  it("compares layout item arrays", () => {
    const copy = desktop.map((item) => ({ ...item }));
    expect(layoutItemsEqual(desktop, copy)).toBe(true);
    copy[0] = { ...copy[0]!, size: "half" };
    expect(layoutItemsEqual(desktop, copy)).toBe(false);
  });
});
