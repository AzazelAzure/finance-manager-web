import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { clsx } from "clsx";
import { Columns2, GripVertical, Maximize2 } from "lucide-react";
import type { ReactNode } from "react";
import { tr, trFmt } from "../../lib/i18n";
import { HelpModeWrapper } from "../tours/TourProvider";
import { Button } from "../ui/Button";
import {
  DashboardWidgetSlot,
  type DashboardWidgetContext,
} from "./DashboardWidgetSlots";
import { getWidgetCatalogEntry, type LayoutItem, type WidgetSize } from "./widgetCatalog";

type Props = {
  item: LayoutItem;
  ctx: DashboardWidgetContext;
  editsEnabled: boolean;
  onResize: (widgetId: LayoutItem["widget_id"], size: WidgetSize) => void;
};

export function SortableDashboardWidgetSlot({
  item,
  ctx,
  editsEnabled,
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
    disabled: !editsEnabled,
  });

  if (!item.visible) {
    return null;
  }

  const entry = getWidgetCatalogEntry(item.widget_id);
  const label = entry ? tr(entry.labelKey, ctx.locale) : item.widget_id;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const toggleSize = (): void => {
    onResize(item.widget_id, item.size === "full" ? "half" : "full");
  };

  const toolbar = editsEnabled ? (
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
      <HelpModeWrapper
        id="tour-widget-resize"
        title={tr("guide.dashboard.widgetResize.title", ctx.locale)}
        content={tr("guide.dashboard.widgetResize.content", ctx.locale)}
      >
        <Button
          type="button"
          variant="secondary"
          size="compact"
          className="dashboard-widget-slot__resize-btn"
          aria-label={
            item.size === "full"
              ? trFmt("dashboard.widgets.resize.half", ctx.locale, { widget: label })
              : trFmt("dashboard.widgets.resize.full", ctx.locale, { widget: label })
          }
          onClick={toggleSize}
        >
          {item.size === "full" ? (
            <Columns2 size={14} aria-hidden />
          ) : (
            <Maximize2 size={14} aria-hidden />
          )}
          <span className="dashboard-widget-slot__resize-label">
            {item.size === "full"
              ? tr("dashboard.widgets.size.half", ctx.locale)
              : tr("dashboard.widgets.size.full", ctx.locale)}
          </span>
        </Button>
      </HelpModeWrapper>
    </div>
  ) : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        "dashboard-widget-slot-wrap",
        item.size === "full"
          ? "dashboard-widget-slot-wrap--full"
          : "dashboard-widget-slot-wrap--half",
        isDragging && "dashboard-widget-slot-wrap--dragging",
      )}
    >
      {toolbar}
      <DashboardWidgetSlot item={item} ctx={ctx} />
    </div>
  );
}
