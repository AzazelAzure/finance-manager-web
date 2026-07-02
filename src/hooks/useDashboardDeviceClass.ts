import { useEffect, useRef } from "react";
import { getDashboardDeviceClass } from "../lib/deviceClass";
import { useBreakpoint } from "../lib/breakpoints";
import type { DashboardDeviceClass } from "../components/dashboard/widgetCatalog";

export type DeviceClassTransition = {
  previous: DashboardDeviceClass;
  current: DashboardDeviceClass;
};

/**
 * Current dashboard device class from viewport breakpoint, with optional
 * callback when mobile/desktop threshold is crossed mid-session.
 */
export function useDashboardDeviceClass(
  onTransition?: (transition: DeviceClassTransition) => void,
): DashboardDeviceClass {
  const { atOrAboveMd } = useBreakpoint();
  const deviceClass = getDashboardDeviceClass(atOrAboveMd);
  const prevRef = useRef<DashboardDeviceClass>(deviceClass);

  useEffect(() => {
    if (prevRef.current === deviceClass) {
      return;
    }
    const previous = prevRef.current;
    prevRef.current = deviceClass;
    onTransition?.({ previous, current: deviceClass });
  }, [deviceClass, onTransition]);

  return deviceClass;
}
