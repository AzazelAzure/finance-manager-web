import { Link, Outlet } from "react-router-dom";
import { LocalePicker } from "../components/landing/LocalePicker";
import { ThemeToggle } from "../components/ThemeToggle";
import { tr, useLocale } from "../lib/i18n";
import { useSession } from "../state/SessionContext";
import type { ReactNode } from "react";

export function PublicShell(): ReactNode {
  const locale = useLocale();
  const { isAuthenticated } = useSession();
  return (
    <div className="public-root">
      <header className="public-header">
        <Link to="/" className="public-brand">
          <img src="/favicon.png" alt="" className="public-brand__mark" aria-hidden />
          <span>
            <strong>Hive Financial Manager</strong>
            <small>Web Beta</small>
          </span>
        </Link>
        <nav className="public-top-nav" aria-label="Public header actions">
          {isAuthenticated ? (
            <Link to="/app/dashboard" className="public-link-pill public-link-pill--primary">
              {tr("login.return_to_dashboard", locale)}
            </Link>
          ) : (
            <>
              <Link to="/login" className="public-link-pill">
                {tr("header.login", locale)}
              </Link>
              <Link to="/signup" className="public-link-pill public-link-pill--primary">
                {tr("header.getStarted", locale)}
              </Link>
            </>
          )}
          <ThemeToggle />
          <LocalePicker />
        </nav>
      </header>
      <div className="app-main app-main--public">
        <Outlet />
      </div>
      <footer className="public-footer">Hive Financial Manager — personal finance (web beta)</footer>
    </div>
  );
}
