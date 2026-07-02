import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  saveDashboardLayout,
  type DashboardLayoutResponse,
} from "../api/dashboardLayout";
import type { DashboardDeviceClass, LayoutItem } from "../components/dashboard/widgetCatalog";
import { layoutItemsEqual } from "../lib/dashboardLayoutEditor";

export const DASHBOARD_LAYOUT_SAVE_DEBOUNCE_MS = 500;
const DASHBOARD_LAYOUT_SAVE_RETRY_MS = 2000;

export type LayoutSaveStatus = "idle" | "pending" | "saving" | "error";

/**
 * Debounced PATCH for dashboard layout edits (reorder/resize).
 * Optimistic cache update; on failure retries once then reverts to last committed layout.
 */
export function useDebouncedDashboardLayoutSave(deviceClass: DashboardDeviceClass) {
  const queryClient = useQueryClient();
  const lastCommittedRef = useRef<LayoutItem[] | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLayoutRef = useRef<LayoutItem[] | null>(null);
  const [status, setStatus] = useState<LayoutSaveStatus>("idle");

  const patchCache = useCallback(
    (layout: LayoutItem[]) => {
      queryClient.setQueryData<DashboardLayoutResponse>(
        ["dashboard-layout", deviceClass],
        (prev) =>
          prev
            ? {
                ...prev,
                layout,
                is_default: false,
              }
            : prev,
      );
    },
    [queryClient, deviceClass],
  );

  const syncCommitted = useCallback((layout: LayoutItem[]) => {
    lastCommittedRef.current = layout.map((item) => ({ ...item }));
    pendingLayoutRef.current = null;
    setStatus("idle");
  }, []);

  const revertToCommitted = useCallback(() => {
    if (!lastCommittedRef.current) {
      return;
    }
    patchCache(lastCommittedRef.current);
    pendingLayoutRef.current = null;
    setStatus("error");
  }, [patchCache]);

  const flushSave = useCallback(
    async (layout: LayoutItem[], isRetry = false) => {
      if (
        lastCommittedRef.current &&
        layoutItemsEqual(layout, lastCommittedRef.current)
      ) {
        pendingLayoutRef.current = null;
        setStatus("idle");
        return;
      }

      pendingLayoutRef.current = layout;
      setStatus("saving");

      try {
        const data = await saveDashboardLayout(deviceClass, layout);
        queryClient.setQueryData(["dashboard-layout", deviceClass], data);
        syncCommitted(data.layout);
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
      } catch {
        if (!isRetry) {
          retryTimerRef.current = setTimeout(() => {
            if (pendingLayoutRef.current) {
              void flushSave(pendingLayoutRef.current, true);
            }
          }, DASHBOARD_LAYOUT_SAVE_RETRY_MS);
          return;
        }
        revertToCommitted();
      }
    },
    [deviceClass, queryClient, revertToCommitted, syncCommitted],
  );

  const scheduleSave = useCallback(
    (layout: LayoutItem[]) => {
      patchCache(layout);
      pendingLayoutRef.current = layout;
      setStatus("pending");

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        void flushSave(layout);
      }, DASHBOARD_LAYOUT_SAVE_DEBOUNCE_MS);
    },
    [flushSave, patchCache],
  );

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  return { scheduleSave, syncCommitted, status };
}
