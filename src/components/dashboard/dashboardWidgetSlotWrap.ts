import { clsx } from "clsx";
import type { LayoutItem } from "./widgetCatalog";

export function dashboardWidgetSlotWrapClass(
  item: LayoutItem,
  options?: { editing?: boolean; dragging?: boolean; overlay?: boolean },
): string {
  return clsx(
    "dashboard-widget-slot-wrap",
    item.size === "full"
      ? "dashboard-widget-slot-wrap--full"
      : "dashboard-widget-slot-wrap--half",
    options?.editing && "dashboard-widget-slot-wrap--editing",
    options?.dragging && "dashboard-widget-slot-wrap--dragging",
    options?.overlay && "dashboard-widget-slot-wrap--overlay",
  );
}
