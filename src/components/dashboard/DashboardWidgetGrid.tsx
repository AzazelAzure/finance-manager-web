import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { useMemo, useState, type ReactNode } from "react";
import type { LayoutSaveStatus } from "../../hooks/useDebouncedDashboardLayoutSave";
import { tr, trFmt } from "../../lib/i18n";
import {
  reorderLayoutItems,
  setWidgetSizeInLayout,
  visibleLayoutItems,
} from "../../lib/dashboardLayoutEditor";
import { shouldTreatAsDisconnectedForMutations } from "../../offline/connectivity";
import { DashboardWidgetSlot, type DashboardWidgetContext } from "./DashboardWidgetSlots";
import { SortableDashboardWidgetSlot } from "./SortableDashboardWidgetSlot";
import { dashboardWidgetSlotWrapClass } from "./dashboardWidgetSlotWrap";
import type { DashboardDeviceClass, LayoutItem, WidgetId, WidgetSize } from "./widgetCatalog";
import { getWidgetCatalogEntry } from "./widgetCatalog";

type Props = {
  layout: LayoutItem[];
  ctx: DashboardWidgetContext;
  deviceClass: DashboardDeviceClass;
  editMode: boolean;
  onLayoutChange: (layout: LayoutItem[]) => void;
  saveStatus: LayoutSaveStatus;
};

export function DashboardWidgetGrid({
  layout,
  ctx,
  deviceClass,
  editMode,
  onLayoutChange,
  saveStatus,
}: Props): ReactNode {
  const editsBlocked = shouldTreatAsDisconnectedForMutations();
  const editsEnabled = editMode && !editsBlocked;
  const sizeControlsEnabled = deviceClass === "desktop";
  const visibleItems = useMemo(() => visibleLayoutItems(layout), [layout]);
  const sortableIds = useMemo(
    () => visibleItems.map((item) => item.widget_id),
    [visibleItems],
  );
  const [activeId, setActiveId] = useState<WidgetId | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const activeItem = activeId
    ? visibleItems.find((item) => item.widget_id === activeId) ?? null
    : null;

  const handleDragStart = (event: DragStartEvent): void => {
    setActiveId(event.active.id as WidgetId);
  };

  const handleDragEnd = (event: DragEndEvent): void => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const next = reorderLayoutItems(
      layout,
      active.id as WidgetId,
      over.id as WidgetId,
    );
    onLayoutChange(next);
  };

  const handleDragCancel = (): void => {
    setActiveId(null);
  };

  const handleResize = (widgetId: WidgetId, size: WidgetSize): void => {
    if (!editsEnabled) {
      return;
    }
    onLayoutChange(setWidgetSizeInLayout(layout, widgetId, size));
  };

  const activeLabel = activeItem
    ? (() => {
        const entry = getWidgetCatalogEntry(activeItem.widget_id);
        return entry
          ? tr(entry.labelKey, ctx.locale)
          : activeItem.widget_id;
      })()
    : "";

  const statusMessages = (
    <>
      {editMode && editsBlocked ? (
        <p className="dashboard-widget-grid__offline muted" role="status">
          {tr("dashboard.widgets.layout.offline", ctx.locale)}
        </p>
      ) : null}
      {saveStatus === "error" ? (
        <p className="dashboard-widget-grid__error" role="alert">
          {tr("dashboard.widgets.layout.saveError", ctx.locale)}
        </p>
      ) : null}
    </>
  );

  if (!editsEnabled) {
    return (
      <div className="dashboard-widget-grid-host">
        {statusMessages}
        <div className="dashboard-widget-grid">
          {visibleItems.map((item) => (
            <div
              key={item.widget_id}
              className={dashboardWidgetSlotWrapClass(item)}
            >
              <DashboardWidgetSlot item={item} ctx={ctx} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-widget-grid-host">
      {statusMessages}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
          <div
            className="dashboard-widget-grid dashboard-widget-grid--edit-mode"
            data-drag-active={activeId != null ? "true" : undefined}
          >
            {visibleItems.map((item) => (
              <SortableDashboardWidgetSlot
                key={item.widget_id}
                item={item}
                ctx={ctx}
                sizeControlsEnabled={sizeControlsEnabled}
                onResize={handleResize}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay className="dashboard-widget-drag-overlay" zIndex={1000}>
          {activeItem ? (
            <div
              className={dashboardWidgetSlotWrapClass(activeItem, { overlay: true })}
              aria-label={trFmt("dashboard.widgets.dragging", ctx.locale, {
                widget: activeLabel,
              })}
            >
              <DashboardWidgetSlot item={activeItem} ctx={ctx} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
