import { Link, Outlet } from "react-router-dom";
import { LocalePicker } from "../components/landing/LocalePicker";
import type { ReactNode } from "react";

export function PublicShell(): ReactNode {
  return (
    <div className="public-root">
      <header className="public-header">
        <Link to="/" className="public-brand">
          Hive Manager
        </Link>
        <nav className="public-top-nav" aria-label="Language">
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
