import { useEffect, useState, type ReactNode } from "react";
import { applyServiceWorkerUpdate } from "../registerPwa";
import { Button } from "./ui/Button";

const EVENT = "fm-sw-update-available";

export function SwUpdateBanner(): ReactNode {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onUpdate = (): void => setVisible(true);
    window.addEventListener(EVENT, onUpdate);
    return () => window.removeEventListener(EVENT, onUpdate);
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div
      className="fm-sync-banner"
      role="status"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.75rem",
        padding: "0.65rem 1rem",
        background: "var(--color-surface-elevated, #1e293b)",
        color: "#f8fafc",
        borderTop: "1px solid rgba(255,255,255,0.12)",
        fontSize: "var(--font-sm)",
      }}
    >
      <span>A new version is ready. Reload to update.</span>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setVisible(false);
          }}
        >
          Later
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={() => {
            void applyServiceWorkerUpdate?.(true);
          }}
        >
          Reload
        </Button>
      </div>
    </div>
  );
}
