import { Link } from "react-router-dom";
import { Button } from "../ui/Button";
import { useSession } from "../../state/SessionContext";
import type { ReactNode } from "react";

export function Hero(): ReactNode {
  const { isAuthenticated } = useSession();
  return (
    <header className="landing-hero">
      <p className="landing-hero__eyebrow">Finance clarity, built for daily use</p>
      <h1>Know your money. Plan with confidence.</h1>
      <p>Dashboards, transactions, bills, and a data hub — tuned for how you really spend and save.</p>
      <div className="landing-hero__actions" role="group" aria-label="Primary actions">
        <Link to="/signup" style={{ textDecoration: "none" }}>
          <Button type="button">Get started</Button>
        </Link>
        <Link
          to={isAuthenticated ? "/app/dashboard" : "/login"}
          state={isAuthenticated ? undefined : { from: { pathname: "/app/dashboard" } }}
          style={{ textDecoration: "none" }}
        >
          <Button type="button" variant="secondary">
            {isAuthenticated ? "Open app" : "Sign in"}
          </Button>
        </Link>
      </div>
    </header>
  );
}
