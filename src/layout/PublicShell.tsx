import { Link, Outlet } from "react-router-dom";
import { LocalePicker } from "../components/landing/LocalePicker";
import { tr, useLocale } from "../lib/i18n";
import type { ReactNode } from "react";

export function PublicShell(): ReactNode {
  const locale = useLocale();
  return (
    <div className="public-root">
      <header className="public-header">
        <Link to="/" className="public-brand">
          <span className="public-brand__mark" aria-hidden>
            <i />
            <i />
          </span>
          <span>
            <strong>Hive Manager</strong>
            <small>Web Beta</small>
          </span>
        </Link>
        <nav className="public-top-nav" aria-label="Public header actions">
          <Link to="/login" className="public-link-pill">
            {tr("header.login", locale)}
          </Link>
          <Link to="/signup" className="public-link-pill public-link-pill--primary">
            {tr("header.getStarted", locale)}
          </Link>
          <LocalePicker />
        </nav>
      </header>
      <div className="app-main app-main--public">
        <Outlet />
      </div>
      <footer className="public-footer">Hive — personal finance (web beta)</footer>
    </div>
  );
}
