import { useState, type ReactNode } from "react";
import { useSessionOptional } from "../state/SessionContext";
import { Button } from "./ui/Button";

const ACK = "fm_offline_history_disclaimer_ack";

export function OfflineHistoryBanner(): ReactNode {
  const session = useSessionOptional();
  const [dismissed, setDismissed] = useState(
    () => typeof localStorage !== "undefined" && localStorage.getItem(ACK) === "1",
  );

  if (!session?.isAuthenticated || dismissed) {
    return null;
  }

  return (
    <div
      role="note"
      style={{
        margin: "0 0 0.5rem",
        padding: "0.5rem 0.75rem",
        borderRadius: 8,
        fontSize: "var(--font-sm)",
        background: "rgba(59, 130, 246, 0.08)",
        border: "1px solid rgba(59, 130, 246, 0.25)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.75rem",
      }}
    >
      <span>
        Offline lists show a <strong>limited window</strong> (about three months) cached on this device. Totals may
        differ from live data until you are back online.
      </span>
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          localStorage.setItem(ACK, "1");
          setDismissed(true);
        }}
      >
        OK
      </Button>
    </div>
  );
}
