import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  resetDashboardLayout,
  saveDashboardLayout,
  type DashboardLayoutResponse,
} from "../../api/dashboardLayout";
import { tr, useLocale } from "../../lib/i18n";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import {
  WIDGET_CATALOG,
  type DashboardDeviceClass,
  type LayoutItem,
  type WidgetCategory,
  type WidgetId,
  getWidgetCatalogEntry,
  layoutWidgetIds,
} from "./widgetCatalog";
import "./manageWidgets.css";

type Props = {
  open: boolean;
  onClose: () => void;
  deviceClass: DashboardDeviceClass;
  layout: LayoutItem[];
};

function categoryLabelKey(category: WidgetCategory): string {
  return `dashboard.widgets.category.${category}`;
}

export function ManageWidgetsPanel({ open, onClose, deviceClass, layout }: Props): ReactNode {
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<LayoutItem[]>(layout);

  useEffect(() => {
    if (open) {
      setDraft(layout);
    }
  }, [open, layout]);

  const mutation = useMutation({
    mutationFn: (nextLayout: LayoutItem[]) => saveDashboardLayout(deviceClass, nextLayout),
    onSuccess: (data: DashboardLayoutResponse) => {
      queryClient.setQueryData(["dashboard-layout", deviceClass], data);
      setDraft(data.layout);
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => resetDashboardLayout(deviceClass),
    onSuccess: (data: DashboardLayoutResponse) => {
      queryClient.setQueryData(["dashboard-layout", deviceClass], data);
      setDraft(data.layout);
    },
  });

  const persist = useCallback(
    (nextLayout: LayoutItem[]) => {
      setDraft(nextLayout);
      mutation.mutate(nextLayout);
    },
    [mutation],
  );

  const inLayout = useMemo(() => layoutWidgetIds(draft), [draft]);

  const addable = useMemo(
    () => WIDGET_CATALOG.filter((entry) => !inLayout.has(entry.id)),
    [inLayout],
  );

  const groupedInLayout = useMemo(() => {
    const groups = new Map<WidgetCategory, LayoutItem[]>();
    for (const item of draft) {
      const entry = getWidgetCatalogEntry(item.widget_id);
      const category = entry?.category ?? "overview";
      const list = groups.get(category) ?? [];
      list.push(item);
      groups.set(category, list);
    }
    return groups;
  }, [draft]);

  const toggleVisible = (widgetId: WidgetId): void => {
    const next = draft.map((item) =>
      item.widget_id === widgetId ? { ...item, visible: !item.visible } : item,
    );
    persist(next);
  };

  const addWidget = (widgetId: WidgetId): void => {
    const entry = getWidgetCatalogEntry(widgetId);
    if (!entry || inLayout.has(widgetId)) {
      return;
    }
    persist([
      ...draft,
      { widget_id: widgetId, size: entry.defaultSize, visible: true },
    ]);
  };

  const deviceLabel =
    deviceClass === "desktop"
      ? tr("dashboard.widgets.manage.deviceClass.desktop", locale)
      : tr("dashboard.widgets.manage.deviceClass.mobile", locale);

  const busy = mutation.isPending || resetMutation.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tr("dashboard.widgets.manage.title", locale)}
      className="manage-widgets-modal"
    >
      <div className="manage-widgets stack">
        <p className="manage-widgets__device muted">{deviceLabel}</p>

        {Array.from(groupedInLayout.entries()).map(([category, items]) => (
          <section key={category} className="manage-widgets__section">
            <h3 className="manage-widgets__section-title">
              {tr(categoryLabelKey(category), locale)}
            </h3>
            <ul className="manage-widgets__list">
              {items.map((item) => {
                const entry = getWidgetCatalogEntry(item.widget_id);
                const label = entry
                  ? tr(entry.labelKey, locale)
                  : item.widget_id;
                const inputId = `manage-widget-${item.widget_id}`;
                return (
                  <li key={item.widget_id} className="manage-widgets__row">
                    <label htmlFor={inputId} className="manage-widgets__label">
                      <input
                        id={inputId}
                        className="ui-check"
                        type="checkbox"
                        checked={item.visible}
                        disabled={busy}
                        onChange={() => toggleVisible(item.widget_id)}
                      />
                      <span>{label}</span>
                    </label>
                    <span
                      className={clsx(
                        "manage-widgets__status",
                        item.visible ? "manage-widgets__status--on" : "manage-widgets__status--off",
                      )}
                    >
                      {item.visible
                        ? tr("dashboard.widgets.manage.visible", locale)
                        : tr("dashboard.widgets.manage.hidden", locale)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        {addable.length > 0 ? (
          <section className="manage-widgets__section">
            <h3 className="manage-widgets__section-title">
              {tr("dashboard.widgets.manage.addSection", locale)}
            </h3>
            <ul className="manage-widgets__list manage-widgets__list--add">
              {addable.map((entry) => (
                <li key={entry.id} className="manage-widgets__row manage-widgets__row--add">
                  <span>{tr(entry.labelKey, locale)}</span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="compact"
                    disabled={busy}
                    onClick={() => addWidget(entry.id)}
                  >
                    {tr("dashboard.widgets.manage.add", locale)}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="manage-widgets__empty muted">
            {tr("dashboard.widgets.manage.emptyAdd", locale)}
          </p>
        )}

        <div className="manage-widgets__actions">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => resetMutation.mutate()}
          >
            {tr("dashboard.widgets.manage.reset", locale)}
          </Button>
          {busy ? (
            <span className="manage-widgets__saving muted">
              {tr("dashboard.widgets.manage.saving", locale)}
            </span>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
