const THEME_KEY = "fm_ui_theme";
export type DataTheme = "light" | "dark";

function root(): HTMLElement | null {
  return typeof document !== "undefined" ? document.documentElement : null;
}

export function getDataTheme(): DataTheme {
  const v = localStorage.getItem(THEME_KEY);
  return v === "dark" || v === "light" ? v : "light";
}

/** Persists to `localStorage` and sets `html[data-theme]`. UI toggle ships in a later task. */
export function setDataTheme(t: DataTheme): void {
  localStorage.setItem(THEME_KEY, t);
  root()?.setAttribute("data-theme", t);
}

export function initDataThemeFromStorage(): void {
  root()?.setAttribute("data-theme", getDataTheme());
}
