import type { DashboardDeviceClass } from "../components/dashboard/widgetCatalog";

/**
 * Map viewport breakpoint to dashboard layout device class.
 * Aligns with protected shell sidebar threshold (`BP.md` = 900px).
 */
export function getDashboardDeviceClass(atOrAboveMd: boolean): DashboardDeviceClass {
  return atOrAboveMd ? "desktop" : "mobile";
}
