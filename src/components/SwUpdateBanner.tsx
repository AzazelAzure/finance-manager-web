import { useEffect, useState, type ReactNode } from "react";
import { applyServiceWorkerUpdate } from "../registerPwa";
import { useLocale, tr } from "../lib/i18n";
import { Button } from "./ui/Button";
import { drainOutbox } from "../offline/drain";

export function SwUpdateBanner(): ReactNode {
  const locale = useLocale();
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const onRefresh = (): void => setNeedRefresh(true);
    window.addEventListener("fm-sw-need-refresh", onRefresh);
    return () => window.removeEventListener("fm-sw-need-refresh", onRefresh);
  }, []);

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      style={{
        padding: "0.5rem 0.75rem",
        background: "var(--primary)",
        color: "white",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: "var(--font-sm)",
        zIndex: 50,
      }}
    >
      <span>{tr("pwa.updateAvailable", locale) || "A new version of the app is available!"}</span>
      <Button
        type="button"
        variant="secondary"
        disabled={updating}
        onClick={() => {
          setUpdating(true);
          void drainOutbox().finally(() => {
            if (applyServiceWorkerUpdate) {
              void applyServiceWorkerUpdate(true);
            } else {
              window.location.reload();
            }
          });
        }}
      >
        {updating ? (tr("pwa.updating", locale) || "Updating...") : (tr("pwa.updateNow", locale) || "Update Now")}
      </Button>
    </div>
  );
}
