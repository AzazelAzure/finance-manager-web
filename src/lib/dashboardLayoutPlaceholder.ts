import type { QueryClient } from "@tanstack/react-query";
import type { DashboardLayoutResponse } from "../api/dashboardLayout";
import {
  defaultLayoutFor,
  type DashboardDeviceClass,
} from "../components/dashboard/widgetCatalog";

export function defaultLayoutResponse(
  deviceClass: DashboardDeviceClass,
): DashboardLayoutResponse {
  return {
    device_class: deviceClass,
    layout: defaultLayoutFor(deviceClass),
    is_default: true,
    updated_at: null,
  };
}

/**
 * Placeholder for a device-class layout query. Never returns another variant's
 * layout — prevents desktop/mobile flash during breakpoint transitions.
 */
export function layoutPlaceholderForDeviceClass(
  queryClient: QueryClient,
  deviceClass: DashboardDeviceClass,
  previousData: DashboardLayoutResponse | undefined,
): DashboardLayoutResponse {
  if (previousData?.device_class === deviceClass) {
    return previousData;
  }

  const cached = queryClient.getQueryData<DashboardLayoutResponse>([
    "dashboard-layout",
    deviceClass,
  ]);
  if (cached?.device_class === deviceClass) {
    return cached;
  }

  return defaultLayoutResponse(deviceClass);
}
