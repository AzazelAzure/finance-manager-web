import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";
import { tr, trFmt } from "../../lib/i18n";
import { HelpModeWrapper } from "../tours/TourProvider";
import { Button } from "../ui/Button";
import {
  DashboardWidgetSlot,
  type DashboardWidgetContext,
} from "./DashboardWidgetSlots";
import { dashboardWidgetSlotWrapClass } from "./dashboardWidgetSlotWrap";
import { getWidgetCatalogEntry, type LayoutItem, type WidgetSize } from "./widgetCatalog";

type Props = {
  item: LayoutItem;
  ctx: DashboardWidgetContext;
  sizeControlsEnabled: boolean;
  onResize: (widgetId: LayoutItem["widget_id"], size: WidgetSize) => void;
};

export function SortableDashboardWidgetSlot({
  item,
  ctx,
  sizeControlsEnabled,
  onResize,
}: Props): ReactNode {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.widget_id,
  });

  if (!item.visible) {
    return null;
  }

  const entry = getWidgetCatalogEntry(item.widget_id);
  const label = entry ? tr(entry.labelKey, ctx.locale) : item.widget_id;
  const isFull = item.size === "full";
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const toolbar = (
    <div className="dashboard-widget-slot__toolbar" data-no-dnd="true">
      <HelpModeWrapper
        id="tour-widget-drag-handle"
        title={tr("guide.dashboard.widgetDrag.title", ctx.locale)}
        content={tr("guide.dashboard.widgetDrag.content", ctx.locale)}
      >
        <button
          type="button"
          className="dashboard-widget-slot__drag-handle"
          ref={setActivatorNodeRef}
          aria-label={trFmt("dashboard.widgets.dragHandle", ctx.locale, { widget: label })}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} aria-hidden />
        </button>
      </HelpModeWrapper>
      {sizeControlsEnabled ? (
        <HelpModeWrapper
          id="tour-widget-resize"
          title={tr("guide.dashboard.widgetResize.title", ctx.locale)}
          content={tr("guide.dashboard.widgetResize.content", ctx.locale)}
        >
          <div className="dashboard-widget-slot__size-controls" role="group" aria-label={tr("dashboard.widgets.sizeControls", ctx.locale)}>
            <Button
              type="button"
              variant="secondary"
              size="compact"
              className="dashboard-widget-slot__size-btn"
              aria-label={trFmt("dashboard.widgets.resize.expand", ctx.locale, { widget: label })}
              disabled={isFull}
              onClick={() => onResize(item.widget_id, "full")}
            >
              {"<-->"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="compact"
              className="dashboard-widget-slot__size-btn"
              aria-label={trFmt("dashboard.widgets.resize.compress", ctx.locale, { widget: label })}
              disabled={!isFull}
              onClick={() => onResize(item.widget_id, "half")}
            >
              {"-><-"}
            </Button>
          </div>
        </HelpModeWrapper>
      ) : null}
    </div>
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={dashboardWidgetSlotWrapClass(item, {
        editing: true,
        dragging: isDragging,
      })}
    >
      {toolbar}
      <DashboardWidgetSlot item={item} ctx={ctx} />
    </div>
  );
}
