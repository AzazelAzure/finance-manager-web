/** Suppress repeated SW "update available" for the same SPA build after user dismisses or stays on the same deploy. */
export const FM_SW_DISMISSED_BUILD_KEY = "fm_sw_last_dismissed_build";

export function shouldShowSwUpdateBanner(buildId: string): boolean {
  if (typeof navigator === "undefined" || !navigator.serviceWorker?.controller) {
    return false;
  }
  try {
    return localStorage.getItem(FM_SW_DISMISSED_BUILD_KEY) !== buildId;
  } catch {
    return true;
  }
}

export function dismissSwUpdateBannerForBuild(buildId: string): void {
  try {
    localStorage.setItem(FM_SW_DISMISSED_BUILD_KEY, buildId);
  } catch {
    /* ignore quota / private mode */
  }
}
