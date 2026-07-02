import { preferOfflineCaches, preferPwaLocalFirstReads } from "../offline/connectivity";
import { readCachePayload, writeCachePayload } from "../offline/cache";
import { offlineDb } from "../offline/db";
import { isPwaBackgroundStale, schedulePwaBackgroundWork } from "../offline/pwaLocalFirstBg";
import { shouldBypassPwaDataCache, type PwaReadBypassOpts } from "../offline/pwaReadBypass";
import type { DashboardDeviceClass, LayoutItem } from "../components/dashboard/widgetCatalog";
import { defaultLayoutFor } from "../components/dashboard/widgetCatalog";
import { api } from "./client";

export type DashboardLayoutResponse = {
  device_class: DashboardDeviceClass;
  layout: LayoutItem[];
  is_default: boolean;
  updated_at?: string | null;
};

export function dashboardLayoutCacheId(deviceClass: DashboardDeviceClass): string {
  return `dashboard-layout:${deviceClass}`;
}

function offlineFallbackLayout(deviceClass: DashboardDeviceClass): DashboardLayoutResponse {
  return {
    device_class: deviceClass,
    layout: defaultLayoutFor(deviceClass),
    is_default: true,
    updated_at: null,
  };
}

export async function getDashboardLayout(
  deviceClass: DashboardDeviceClass,
  opts?: PwaReadBypassOpts,
): Promise<DashboardLayoutResponse> {
  const cacheId = dashboardLayoutCacheId(deviceClass);

  if (preferOfflineCaches()) {
    const raw = await readCachePayload(cacheId);
    if (raw && typeof raw === "object" && "layout" in raw) {
      return raw as DashboardLayoutResponse;
    }
    return offlineFallbackLayout(deviceClass);
  }

  if (preferPwaLocalFirstReads() && !shouldBypassPwaDataCache(opts)) {
    const row = await offlineDb.caches.get(cacheId);
    const raw = row?.payload;
    const fetchedAt = row?.fetchedAt ?? 0;
    if (raw && typeof raw === "object" && "layout" in raw) {
      if (isPwaBackgroundStale(fetchedAt)) {
        schedulePwaBackgroundWork(cacheId, async () => {
          const { data } = await api.get<DashboardLayoutResponse>("/finance/dashboard-layout/", {
            params: { device_class: deviceClass },
          });
          await writeCachePayload(cacheId, data, Date.now());
          const { queryClient } = await import("../lib/queryClient");
          await queryClient.invalidateQueries({
            queryKey: ["dashboard-layout", deviceClass],
            refetchType: "all",
          });
        });
      }
      return raw as DashboardLayoutResponse;
    }
  }

  const { data } = await api.get<DashboardLayoutResponse>("/finance/dashboard-layout/", {
    params: { device_class: deviceClass },
  });
  await writeCachePayload(cacheId, data, Date.now());
  return data;
}

export async function saveDashboardLayout(
  deviceClass: DashboardDeviceClass,
  layout: LayoutItem[],
): Promise<DashboardLayoutResponse> {
  // Callers that need debounced reorder/resize persistence should use
  // `useDebouncedDashboardLayoutSave` (500ms debounce, single retry, revert on failure).
  const { data } = await api.patch<DashboardLayoutResponse>("/finance/dashboard-layout/", {
    device_class: deviceClass,
    layout,
  });
  await writeCachePayload(dashboardLayoutCacheId(deviceClass), data, Date.now());
  return data;
}

export async function resetDashboardLayout(
  deviceClass: DashboardDeviceClass,
): Promise<DashboardLayoutResponse> {
  const { data } = await api.post<DashboardLayoutResponse>("/finance/dashboard-layout/reset/", {
    device_class: deviceClass,
  });
  await writeCachePayload(dashboardLayoutCacheId(deviceClass), data, Date.now());
  return data;
}
