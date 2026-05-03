/** True when the app is running as an installed PWA (standalone / iOS full-screen). */
export function isPwaStandaloneDisplay(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  if (window.matchMedia("(display-mode: standalone)").matches) {
    return true;
  }
  if (window.matchMedia("(display-mode: window-controls-overlay)").matches) {
    return true;
  }
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone);
}
