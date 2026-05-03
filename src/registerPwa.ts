import { registerSW } from "virtual:pwa-register";

/** Invoked by `SwUpdateBanner` to activate the waiting worker and reload. */
export let applyServiceWorkerUpdate: ((reloadPage?: boolean) => Promise<void>) | undefined;

export function registerPwaServiceWorker(): void {
  applyServiceWorkerUpdate = registerSW({
    immediate: true,
    onNeedRefresh() {
      window.dispatchEvent(new CustomEvent("fm-sw-update-available"));
    },
    onOfflineReady() {
      window.dispatchEvent(new CustomEvent("fm-sw-offline-ready"));
    },
  });
}
