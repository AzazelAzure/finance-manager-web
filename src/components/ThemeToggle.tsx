import { useEffect, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { getDataTheme, setThemePreference, type DataTheme } from "../lib/theme";
import { tr, useLocale } from "../lib/i18n";
import "./ThemeToggle.css";

/**
 * Compact light/dark toggle usable anywhere — including logged-out surfaces
 * (landing/splash, legal, auth) where the only theme control previously lived
 * behind authentication on the Settings page.
 *
 * Toggling sets an explicit `light`/`dark` preference (persisted via
 * `setThemePreference`) and reflects the current resolved theme. It stays in
 * sync with other surfaces (e.g. Settings) and OS changes via the
 * `fm-theme-changed` event and the `prefers-color-scheme` media query.
 */
export function ThemeToggle(): ReactNode {
  const locale = useLocale();
  const [theme, setTheme] = useState<DataTheme>(() => getDataTheme());

  useEffect(() => {
    const sync = (): void => setTheme(getDataTheme());
    window.addEventListener("fm-theme-changed", sync);
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    mq?.addEventListener?.("change", sync);
    return () => {
      window.removeEventListener("fm-theme-changed", sync);
      mq?.removeEventListener?.("change", sync);
    };
  }, []);

  const isDark = theme === "dark";

  function toggle(): void {
    const next: DataTheme = isDark ? "light" : "dark";
    setThemePreference(next);
    setTheme(next);
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={tr("theme.toggle.aria", locale)}
      title={isDark ? tr("theme.toLight", locale) : tr("theme.toDark", locale)}
    >
      {isDark ? (
        <Sun className="theme-toggle__icon" aria-hidden size={18} />
      ) : (
        <Moon className="theme-toggle__icon" aria-hidden size={18} />
      )}
    </button>
  );
}
