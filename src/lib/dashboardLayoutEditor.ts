import { arrayMove } from "@dnd-kit/sortable";
import type { LayoutItem, WidgetId, WidgetSize } from "../components/dashboard/widgetCatalog";

/** Reorder layout items by widget id (full layout, including hidden widgets). */
export function reorderLayoutItems(
  layout: LayoutItem[],
  activeId: WidgetId,
  overId: WidgetId,
): LayoutItem[] {
  const activeIndex = layout.findIndex((item) => item.widget_id === activeId);
  const overIndex = layout.findIndex((item) => item.widget_id === overId);
  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) {
    return layout;
  }
  return arrayMove(layout, activeIndex, overIndex);
}

/** Update a single widget's size tier within the layout. */
export function setWidgetSizeInLayout(
  layout: LayoutItem[],
  widgetId: WidgetId,
  size: WidgetSize,
): LayoutItem[] {
  return layout.map((item) =>
    item.widget_id === widgetId ? { ...item, size } : item,
  );
}

/** Visible widgets in layout order (for sortable context). */
export function visibleLayoutItems(layout: LayoutItem[]): LayoutItem[] {
  return layout.filter((item) => item.visible);
}

export function layoutItemsEqual(a: LayoutItem[], b: LayoutItem[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every(
    (item, index) =>
      item.widget_id === b[index]?.widget_id &&
      item.size === b[index]?.size &&
      item.visible === b[index]?.visible,
  );
}
