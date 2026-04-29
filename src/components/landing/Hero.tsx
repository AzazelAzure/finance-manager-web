import { Link } from "react-router-dom";
import { Button } from "../ui/Button";
import { useSession } from "../../state/SessionContext";
import { tr, useLocale } from "../../lib/i18n";
import type { ReactNode } from "react";

export function Hero(): ReactNode {
  const { isAuthenticated } = useSession();
  const locale = useLocale();
  return (
    <header className="landing-hero">
      <p className="landing-hero__eyebrow">{tr("hero.eyebrow", locale)}</p>
      <h1>{tr("hero.title", locale)}</h1>
      <p>{tr("hero.body", locale)}</p>
      <div className="landing-hero__actions" role="group" aria-label="Primary actions">
        <Link to="/signup" style={{ textDecoration: "none" }}>
          <Button type="button">{tr("hero.getStarted", locale)}</Button>
        </Link>
        <Link
          to={isAuthenticated ? "/app/dashboard" : "/login"}
          state={isAuthenticated ? undefined : { from: { pathname: "/app/dashboard" } }}
          style={{ textDecoration: "none" }}
        >
          <Button type="button" variant="secondary">
            {isAuthenticated ? tr("hero.openApp", locale) : tr("hero.signIn", locale)}
          </Button>
        </Link>
      </div>
    </header>
  );
}
