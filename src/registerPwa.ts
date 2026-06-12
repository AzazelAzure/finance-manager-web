import { registerSW } from "virtual:pwa-register";

/** Invoked by `SwUpdateBanner` to activate the waiting worker and reload. */
export let applyServiceWorkerUpdate: ((reloadPage?: boolean) => Promise<void>) | undefined;

const APP_START_TIME = Date.now();
const AUTO_APPLY_THRESHOLD_MS = 10000; // 10 seconds

export function registerPwaServiceWorker(): void {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // If the app was opened very recently, it means the update was fetched on startup.
      // Auto-apply the update immediately to ensure they start on the newest code.
      if (Date.now() - APP_START_TIME < AUTO_APPLY_THRESHOLD_MS) {
        void updateSW(true);
      } else {
        // Otherwise, the app has been open. Dispatch an event to show the banner.
        window.dispatchEvent(new CustomEvent("fm-sw-need-refresh"));
      }
    },
    onOfflineReady() {
      window.dispatchEvent(new CustomEvent("fm-sw-offline-ready"));
    },
    onRegisteredSW(_swUrl, r) {
      if (r) {
        // Poll for updates every hour
        setInterval(() => {
          if (navigator.onLine) {
            void r.update();
          }
        }, 60 * 60 * 1000);

        // Check for updates when app comes to foreground
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible" && navigator.onLine) {
            void r.update();
          }
        });
      }
    },
  });

  applyServiceWorkerUpdate = updateSW;
}
