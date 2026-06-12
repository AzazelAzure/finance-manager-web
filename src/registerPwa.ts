import { registerSW } from "virtual:pwa-register";
/** Invoked by `SwUpdateBanner` to activate the waiting worker and reload. */
export let applyServiceWorkerUpdate: ((reloadPage?: boolean) => Promise<void>) | undefined;

export function registerPwaServiceWorker(): void {
  registerSW({
    immediate: true,
    onOfflineReady() {
      window.dispatchEvent(new CustomEvent("fm-sw-offline-ready"));
    },
  });
}
