import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { SYNC_STATE_EVENT, type SyncStatePayload } from "../offline/syncEvents";

export function SyncIndicator() {
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    function handleSyncState(e: Event) {
      const customEvent = e as CustomEvent<SyncStatePayload>;
      setIsSyncing(customEvent.detail.phase === "syncing");
    }

    window.addEventListener(SYNC_STATE_EVENT, handleSyncState);
    return () => window.removeEventListener(SYNC_STATE_EVENT, handleSyncState);
  }, []);

  if (!isSyncing) {
    return null;
  }

  return (
    <div 
      className="sync-indicator" 
      style={{ 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        color: "var(--color-primary, #6b7280)",
        opacity: 0.8,
        marginRight: "8px"
      }}
      title="Syncing..."
      aria-label="Syncing data..."
    >
      <RefreshCw size={18} className="sync-progress-overlay__spinner" />
    </div>
  );
}
