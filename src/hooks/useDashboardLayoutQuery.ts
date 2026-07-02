import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useEffect } from "react";
import { getDashboardLayout, type DashboardLayoutResponse } from "../api/dashboardLayout";
import { defaultLayoutFor, type DashboardDeviceClass } from "../components/dashboard/widgetCatalog";
import { layoutPlaceholderForDeviceClass } from "../lib/dashboardLayoutPlaceholder";
import { readOptsFromQuery } from "../offline/pwaReadBypass";

const OPPOSITE_DEVICE_CLASS: Record<DashboardDeviceClass, DashboardDeviceClass> = {
  mobile: "desktop",
  desktop: "mobile",
};

export type DashboardLayoutQueryResult = UseQueryResult<DashboardLayoutResponse> & {
  activeLayout: DashboardLayoutResponse["layout"];
};

/**
 * Per-device-class dashboard layout with breakpoint-safe placeholders and
 * background prefetch of the opposite variant for mid-session resize.
 */
export function useDashboardLayoutQuery(
  deviceClass: DashboardDeviceClass,
): DashboardLayoutQueryResult {
  const queryClient = useQueryClient();

  const layoutQuery = useQuery({
    queryKey: ["dashboard-layout", deviceClass] as const,
    queryFn: (ctx) => getDashboardLayout(deviceClass, readOptsFromQuery(ctx)),
    placeholderData: (previousData) =>
      layoutPlaceholderForDeviceClass(queryClient, deviceClass, previousData),
  });

  useEffect(() => {
    const other = OPPOSITE_DEVICE_CLASS[deviceClass];
    void queryClient.prefetchQuery({
      queryKey: ["dashboard-layout", other] as const,
      queryFn: () => getDashboardLayout(other),
      staleTime: 60_000,
    });
  }, [deviceClass, queryClient]);

  const activeLayout =
    layoutQuery.data?.device_class === deviceClass
      ? layoutQuery.data.layout
      : defaultLayoutFor(deviceClass);

  return { ...layoutQuery, activeLayout };
}
