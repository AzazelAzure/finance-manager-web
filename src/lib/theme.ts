const THEME_KEY = "fm_theme";
const THEME_COOKIE = "fm_theme";
export type DataTheme = "light" | "dark";
export type ThemePreference = DataTheme | "system";

function root(): HTMLElement | null {
  return typeof document !== "undefined" ? document.documentElement : null;
}

function systemTheme(): DataTheme {
  if (typeof window === "undefined") {
    return "light";
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function writeThemeCookie(value: ThemePreference): void {
  if (typeof document === "undefined") {
    return;
  }
  document.cookie = `${THEME_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
}

export function getThemePreference(): ThemePreference {
  const v = localStorage.getItem(THEME_KEY);
  return v === "dark" || v === "light" || v === "system" ? v : "system";
}

export function getDataTheme(): DataTheme {
  const pref = getThemePreference();
  return pref === "system" ? systemTheme() : pref;
}

/** Persists preference and sets resolved `html[data-theme]`. */
export function setThemePreference(pref: ThemePreference): void {
  localStorage.setItem(THEME_KEY, pref);
  writeThemeCookie(pref);
  root()?.setAttribute("data-theme", pref === "system" ? systemTheme() : pref);
}

/** Backward-compatible setter used by old callers. */
export function setDataTheme(t: DataTheme): void {
  setThemePreference(t);
}

export function initDataThemeFromStorage(): void {
  const pref = getThemePreference();
  root()?.setAttribute("data-theme", pref === "system" ? systemTheme() : pref);
}
