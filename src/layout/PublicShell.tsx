import { Link, Outlet } from "react-router-dom";
import { LocalePicker } from "../components/landing/LocalePicker";
import type { ReactNode } from "react";

export function PublicShell(): ReactNode {
  return (
    <div className="public-root">
      <header className="public-header">
        <Link to="/" className="public-brand" style={{ textDecoration: "none", color: "var(--fg)" }}>
          Hive Manager
        </Link>
        <nav style={{ display: "flex", gap: "0.75rem", alignItems: "center" }} aria-label="Language">
          <LocalePicker />
        </nav>
      </header>
      <div className="app-main" style={{ maxWidth: 1200, margin: "0 auto" }}>
        <Outlet />
      </div>
      <footer className="public-footer">Hive — personal finance (web beta)</footer>
    </div>
  );
}
